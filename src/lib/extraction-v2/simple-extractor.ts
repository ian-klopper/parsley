/**
 * Simple Menu Extraction System
 * Handles PDFs (text/image), spreadsheets, and images in one pipeline
 * Uses only Gemini Flash, Files API, and progressive caching
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleAIFileManager } from '@google/generative-ai/server';
import * as dotenv from 'dotenv';
import * as crypto from 'crypto';
import * as fs from 'fs';
import { allowedCategories, allowedSizes } from '../menu-data';
import { parseSpreadsheetToMenuItems, isSpreadsheet, analyzeSpreadsheet } from './spreadsheet-parser';

// Load environment variables
dotenv.config({ path: '.env.local' });

/**
 * Process items with controlled concurrency to avoid rate limits
 */
async function processWithConcurrency<T, R>(
  items: T[],
  processor: (item: T, index: number) => Promise<R>,
  maxConcurrency: number = 3
): Promise<R[]> {
  const results: R[] = [];
  
  for (let i = 0; i < items.length; i += maxConcurrency) {
    const batch = items.slice(i, i + maxConcurrency);
    const batchPromises = batch.map((item, batchIndex) => 
      processor(item, i + batchIndex)
    );
    
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
    
    // Add a small delay between batches to be gentle on the API
    if (i + maxConcurrency < items.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  return results;
}

// Initialize API clients lazily to avoid build-time errors
let genAI: GoogleGenerativeAI | null = null;
let fileManager: GoogleAIFileManager | null = null;
let model: any = null;

function initializeClients() {
  if (genAI && fileManager && model) return { genAI, fileManager, model };
  
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    throw new Error('GOOGLE_AI_API_KEY environment variable is required');
  }

  genAI = new GoogleGenerativeAI(apiKey);
  fileManager = new GoogleAIFileManager(apiKey);

  // Initialize Gemini Flash model with simple configuration (no structured output)
  model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 8000
    }
  });

  return { genAI, fileManager, model };
}

// Types
export interface SimpleMenuItem {
  name: string;
  description: string;
  category: string; // Must be from allowedCategories
  section: string;
  sizes: SizeOption[];
  modifierGroups: ModifierGroup[];
  sourceInfo: {
    documentId: string;
    page?: number;
    sheet?: string;
  };
}

export interface SizeOption {
  size: string; // Must be from allowedSizes
  price: string;
  isDefault?: boolean;
}

export interface ModifierGroup {
  name: string;
  options: string[];
  required: boolean;
  multiSelect: boolean;
}

export interface ExtractionCache {
  items: SimpleMenuItem[];
  processedFiles: string[];
  totalFiles: number;
  lastUpdated: string;
  totalCost: number;
}

export interface UploadedFile {
  uri: string;
  mimeType: string;
  displayName: string;
  documentId: string;
  originalPath: string;
}

export interface ProcessingResult {
  newItems: SimpleMenuItem[];
  confidence: number;
  documentType: string;
  tokenUsage: {
    input: number;
    output: number;
    cost: number;
  };
}

/**
 * Upload a document to Gemini Files API
 */
async function uploadDocument(filePath: string, documentId: string): Promise<UploadedFile> {
  console.log(`📤 Uploading: ${documentId}`);
  
  const { fileManager } = initializeClients();

  // Determine MIME type from file extension
  const extension = filePath.toLowerCase().split('.').pop();
  const mimeTypeMap: Record<string, string> = {
    'pdf': 'application/pdf',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'xls': 'application/vnd.ms-excel',
    'csv': 'text/csv',
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'webp': 'image/webp'
  };

  const mimeType = mimeTypeMap[extension || ''] || 'application/octet-stream';
  const displayName = filePath.split('/').pop() || documentId;

  try {
    const uploadResult = await fileManager.uploadFile(filePath, {
      mimeType,
      displayName: `${documentId}-${displayName}`
    });

    // Wait for processing to complete
    let file = await fileManager.getFile(uploadResult.file.name);
    let attempts = 0;
    const maxAttempts = 30; // 30 seconds timeout

    while (file.state === 'PROCESSING' && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      file = await fileManager.getFile(uploadResult.file.name);
      attempts++;
    }

    if (file.state === 'FAILED') {
      throw new Error(`File processing failed: ${displayName}`);
    }

    if (file.state === 'PROCESSING') {
      throw new Error(`File processing timeout: ${displayName}`);
    }

    console.log(`✅ Uploaded: ${documentId} -> ${file.uri}`);

    return {
      uri: file.uri,
      mimeType: file.mimeType,
      displayName,
      documentId,
      originalPath: filePath
    };

  } catch (error) {
    console.error(`❌ Upload failed for ${documentId}:`, error);
    throw error;
  }
}

/**
 * Find the position of the last complete JSON object in a string
 */
function findLastCompleteObject(jsonText: string): number {
  let bracketCount = 0;
  let inString = false;
  let lastCompleteObjectEnd = -1;
  
  for (let i = 0; i < jsonText.length; i++) {
    const char = jsonText[i];
    const prevChar = i > 0 ? jsonText[i - 1] : '';
    
    // Track string boundaries
    if (char === '"' && prevChar !== '\\') {
      inString = !inString;
      continue;
    }
    
    // Skip characters inside strings
    if (inString) continue;
    
    // Track bracket pairs
    if (char === '{') {
      bracketCount++;
    } else if (char === '}') {
      bracketCount--;
      // Found complete object
      if (bracketCount === 0) {
        lastCompleteObjectEnd = i;
      }
    }
  }
  
  return lastCompleteObjectEnd;
}

/**
 * Extract valid JSON objects using regex patterns
 */
function extractValidJsonObjects(jsonText: string): any[] {
  const items: any[] = [];
  
  // Pattern to match complete JSON objects
  const objectPattern = /\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g;
  const matches = jsonText.match(objectPattern);
  
  if (matches) {
    for (const match of matches) {
      try {
        const item = JSON.parse(match);
        if (item && typeof item === 'object' && item.name) {
          items.push(item);
        }
      } catch (e) {
        // Skip invalid objects
        continue;
      }
    }
  }
  
  console.log(`🔧 Extracted ${items.length} valid objects using regex`);
  return items;
}

/**
 * Normalize size option
 */
function normalizeSize(size: any): any {
  return {
    size: String(size.size || 'Default').trim(),
    price: String(size.price || '0').trim(),
    isDefault: Boolean(size.isDefault)
  };
}

/**
 * Enhanced JSON parsing with better error recovery
 */
function parseGeminiResponse(responseText: string, documentId: string): SimpleMenuItem[] {
  console.log(`🔧 Processing response for ${documentId} (${responseText.length} chars)`);
  
  try {
    let jsonText = responseText.trim();

    // Remove markdown wrappers
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.slice(7).trim();
    }
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.slice(3).trim();
    }
    if (jsonText.endsWith('```')) {
      jsonText = jsonText.slice(0, -3).trim();
    }

    console.log(`🔧 Cleaned JSON length: ${jsonText.length}`);

    // Advanced JSON cleaning
    jsonText = jsonText
      .replace(/,\s*([}\]])/g, '$1') // Remove trailing commas
      .replace(/:\s*null/g, ': null') // Normalize null values
      .replace(/:\s*undefined/g, ': null') // Convert undefined to null
      .replace(/:\s*true/g, ': true') // Normalize booleans
      .replace(/:\s*false/g, ': false')
      .replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":') // Quote unquoted keys
      .replace(/\\"/g, '"') // Fix escaped quotes
      .replace(/\n\s*\n/g, '\n'); // Remove extra newlines

    // Handle truncated JSON arrays
    if (jsonText.startsWith('[')) {
      // Find the last complete object
      const lastCompleteObject = findLastCompleteObject(jsonText);
      if (lastCompleteObject > 0) {
        jsonText = jsonText.substring(0, lastCompleteObject + 1) + ']';
        console.log(`🔧 Fixed truncated array, new length: ${jsonText.length}`);
      }
    }

    // Try parsing the cleaned JSON
    let parsedData;
    try {
      parsedData = JSON.parse(jsonText);
      console.log(`✅ Successfully parsed JSON with ${Array.isArray(parsedData) ? parsedData.length : 'unknown'} items`);
    } catch (parseError) {
      console.log(`⚠️ JSON parsing failed, attempting recovery...`);
      // Try to extract valid JSON objects using regex
      parsedData = extractValidJsonObjects(jsonText);
    }

    // Normalize to array format
    let items = Array.isArray(parsedData) ? parsedData : (parsedData?.items || []);
    
    // Normalize each item
    const normalizedItems = items.map((item: any) => ({
      name: String(item.name || '').trim(),
      description: String(item.description || '').trim(),
      category: String(item.category || 'Uncategorized').trim(),
      section: String(item.section || 'Main Menu').trim(),
      sizes: Array.isArray(item.sizes) ? item.sizes.map(normalizeSize) : [],
      modifierGroups: Array.isArray(item.modifierGroups) ? item.modifierGroups : [],
      sourceInfo: {
        documentId: item.sourceInfo?.documentId || documentId,
        page: item.sourceInfo?.page || null,
        sheet: item.sourceInfo?.sheet || null
      }
    }));
    
    console.log(`✅ Successfully processed ${normalizedItems.length} items`);
    return normalizedItems;

  } catch (error) {
    console.error(`❌ All parsing methods failed for ${documentId}:`, error);
    return [];
  }
}

/**
 * Normalize menu item to ensure consistent structure
 */
function normalizeMenuItem(item: any): SimpleMenuItem {
  return {
    name: item.name || '',
    description: item.description || '',
    category: item.category || 'Uncategorized',
    section: item.section || 'Main Menu',
    sizes: Array.isArray(item.sizes) ? item.sizes : [],
    modifierGroups: Array.isArray(item.modifierGroups) ? item.modifierGroups : [],
    sourceInfo: {
      documentId: item.sourceInfo?.documentId || 'unknown',
      page: item.sourceInfo?.page || null,
      sheet: item.sourceInfo?.sheet || null
    }
  };
}

/**
 * Extract partial items from incomplete JSON responses
 */
function extractPartialItems(responseText: string): SimpleMenuItem[] {
  const items: SimpleMenuItem[] = [];

  try {
    // First, try to extract complete JSON objects
    const jsonMatches = responseText.match(/\{[^}]*\}/g);

    if (jsonMatches) {
      for (const match of jsonMatches) {
        try {
          const item = JSON.parse(match);

          // Check if this looks like a menu item
          if (item.name && typeof item.name === 'string') {
            const menuItem: SimpleMenuItem = {
              name: item.name,
              description: item.description || '',
              category: item.category || 'Uncategorized',
              section: item.section || 'Main Menu',
              sizes: Array.isArray(item.sizes) ? item.sizes : [],
              modifierGroups: Array.isArray(item.modifierGroups) ? item.modifierGroups : [],
              sourceInfo: item.sourceInfo || { documentId: 'unknown' }
            };
            items.push(menuItem);
          }
        } catch (e) {
          // Skip invalid JSON objects
          continue;
        }
      }
    }

    // If no complete objects found, try to extract from truncated JSON array
    if (items.length === 0) {
      // Look for patterns like "name": "value" to extract individual fields
      const nameMatches = responseText.match(/"name"\s*:\s*"([^"]+)"/g);
      const descriptionMatches = responseText.match(/"description"\s*:\s*"([^"]*)"/g);
      const categoryMatches = responseText.match(/"category"\s*:\s*"([^"]+)"/g);
      const sectionMatches = responseText.match(/"section"\s*:\s*"([^"]*)"/g);

      if (nameMatches && nameMatches.length > 0) {
        const maxItems = Math.max(
          nameMatches.length,
          descriptionMatches?.length || 0,
          categoryMatches?.length || 0,
          sectionMatches?.length || 0
        );

        for (let i = 0; i < maxItems; i++) {
          const nameMatch = nameMatches[i]?.match(/"name"\s*:\s*"([^"]+)"/);
          const descriptionMatch = descriptionMatches?.[i]?.match(/"description"\s*:\s*"([^"]*)"/);
          const categoryMatch = categoryMatches?.[i]?.match(/"category"\s*:\s*"([^"]+)"/);
          const sectionMatch = sectionMatches?.[i]?.match(/"section"\s*:\s*"([^"]*)"/);

          if (nameMatch) {
            const menuItem: SimpleMenuItem = {
              name: nameMatch[1],
              description: descriptionMatch ? descriptionMatch[1] : '',
              category: categoryMatch ? categoryMatch[1] : 'Uncategorized',
              section: sectionMatch ? sectionMatch[1] : 'Main Menu',
              sizes: [],
              modifierGroups: [],
              sourceInfo: { documentId: 'unknown' }
            };
            items.push(menuItem);
          }
        }
      }
    }

    // Remove duplicates based on name
    const uniqueItems = items.filter((item, index, self) =>
      index === self.findIndex(i => i.name === item.name)
    );

    return uniqueItems;
  } catch (error) {
    console.error('Error extracting partial items:', error);
    return [];
  }
}

/**
 * Process spreadsheet files directly without using Gemini Files API
 */
async function processSpreadsheet(
  filePath: string,
  documentId: string,
  cache: ExtractionCache,
  fileIndex: number
): Promise<ProcessingResult> {
  console.log(`\n📊 Processing spreadsheet ${fileIndex + 1}/${cache.totalFiles}: ${documentId}`);

  if (cache.items.length > 0) {
    console.log(`📊 Current cache: ${cache.items.length} items from ${cache.processedFiles.length} files`);
  }

  try {
    const startTime = Date.now();

    // Analyze spreadsheet structure
    const analysis = await analyzeSpreadsheet(filePath);
    console.log(`📋 Spreadsheet analysis: ${analysis.format.toUpperCase()} with ${analysis.rowCount} rows, ${analysis.columnCount} columns`);
    console.log(`📋 Headers: ${analysis.headers.join(', ')}`);

    // Parse spreadsheet to menu items
    const newItems = await parseSpreadsheetToMenuItems(filePath, documentId);

    const processingTime = Date.now() - startTime;

    // No cost for spreadsheet processing since we don't use Gemini
    const tokenUsage = {
      input: 0,
      output: 0,
      cost: 0
    };

    console.log(`✅ Extracted ${newItems.length} new items from spreadsheet ${documentId}`);
    console.log(`📊 Document type: spreadsheet, Confidence: ${newItems.length > 0 ? 0.9 : 0}`);
    console.log(`⏱️  Processing time: ${processingTime}ms`);
    console.log(`💰 Cost: $0.000000 (direct parsing, no AI tokens used)`);

    return {
      newItems,
      confidence: newItems.length > 0 ? 0.9 : 0,
      documentType: 'spreadsheet',
      tokenUsage
    };

  } catch (error) {
    console.error(`❌ Error processing spreadsheet ${documentId}:`, error);
    return {
      newItems: [],
      confidence: 0,
      documentType: 'error',
      tokenUsage: { input: 0, output: 0, cost: 0 }
    };
  }
}

async function processDocument(
  file: UploadedFile,
  cache: ExtractionCache,
  fileIndex: number
): Promise<ProcessingResult> {
  console.log(`\n🔍 Processing ${fileIndex + 1}/${cache.totalFiles}: ${file.documentId}`);

  if (cache.items.length > 0) {
    console.log(`📊 Current cache: ${cache.items.length} items from ${cache.processedFiles.length} files`);
  }

  // Build context from existing cache (simplified for now)
  let cacheContext = '';
  if (cache.items.length > 0) {
    cacheContext = `PREVIOUSLY EXTRACTED ITEMS: ${cache.items.length} items from ${cache.processedFiles.length} files.`;
  } else {
    cacheContext = 'This is the first document being processed.';
  }

  // Create a comprehensive extraction prompt
  const prompt = `You are a menu extraction expert. Extract ALL menu items from this document.

${cacheContext}

AVAILABLE CATEGORIES: ${allowedCategories.join(', ')}
AVAILABLE SIZES: ${allowedSizes.join(', ')}

TASK: Extract NEW menu items from this document that are NOT already in the cache.
For each item, provide:
- name: Item name
- description: Item description (if available, otherwise empty string)
- category: Choose from available categories
- section: Menu section (e.g., "Beverages", "Appetizers", "Main Course", etc.)
- sizes: Array of size options with price (use available sizes)
- modifierGroups: Array of modifier groups - LOOK FOR CUSTOMIZATION OPTIONS LIKE:
  * Add-ons (extra cheese, bacon, etc.)
  * Cooking preferences (rare, medium, well-done)
  * Side choices (fries, salad, soup)
  * Size upgrades
  * Sauce options
  * Substitutions available
  * Any text mentioning "add", "extra", "choice of", "substitute", "upgrade", "with/without"
- sourceInfo: {
  documentId: "${file.documentId}",
  page: page number for PDFs (if applicable, otherwise null),
  sheet: "sheet name" for spreadsheets (if applicable, otherwise null)
}

Return ONLY a JSON array like this:
[
  {
    "name": "Caesar Salad",
    "description": "Fresh romaine lettuce with parmesan cheese and croutons",
    "category": "Salad",
    "section": "Appetizers",
    "sizes": [
      {"size": "Small", "price": "8.99", "isDefault": false},
      {"size": "Large", "price": "12.99", "isDefault": true}
    ],
    "modifierGroups": [
      {
        "name": "Add Protein",
        "options": ["Grilled Chicken +$4", "Shrimp +$6", "Tofu +$3"],
        "required": false,
        "multiSelect": true
      },
      {
        "name": "Dressing Choice",
        "options": ["Caesar", "Ranch", "Balsamic", "Italian"],
        "required": true,
        "multiSelect": false
      }
    ],
    "sourceInfo": {
      "documentId": "${file.documentId}",
      "page": 2,
      "sheet": null
    }
  }
]

IMPORTANT:
- Use empty arrays [] for missing sizes/modifierGroups
- Use empty string "" for missing descriptions
- Ensure the JSON array is complete and properly closed
- Extract ALL items you can find
- Return valid JSON only
- PAY SPECIAL ATTENTION TO MODIFIERS: Look for any text that indicates customization options, add-ons, sides, cooking preferences, substitutions, or choices
- Common modifier indicators: "add", "extra", "choice of", "substitute", "upgrade", "with/without", "served with", "comes with", "option to"

Extract ALL items you can find from this document, including any customization options as modifiers. Return valid JSON only.`;

  try {
    const startTime = Date.now();

    // Generate content with file reference
    const result = await model.generateContent({
      contents: [{
        role: 'user',
        parts: [
          { text: prompt },
          {
            fileData: {
              mimeType: file.mimeType,
              fileUri: file.uri
            }
          }
        ]
      }]
    });

    const processingTime = Date.now() - startTime;
    const response = result.response;
    const responseText = response.text();

    // Use the enhanced parsing function
    const parsedItems = parseGeminiResponse(responseText, file.documentId);

    const extractedData = {
      items: parsedItems,
      summary: {
        newItemsFound: parsedItems.length,
        documentType: 'menu',
        confidence: parsedItems.length > 0 ? 0.8 : 0
      }
    };

    const newItems = extractedData.items || [];
    const summary = extractedData.summary || {
      newItemsFound: newItems.length,
      documentType: 'unknown',
      confidence: 0.8
    };

    // Calculate cost
    const usage = response.usageMetadata;
    const tokenUsage = {
      input: usage?.promptTokenCount || 0,
      output: usage?.candidatesTokenCount || 0,
      cost: 0
    };

    if (usage) {
      const inputCost = tokenUsage.input * 0.075 / 1_000_000;  // Flash pricing
      const outputCost = tokenUsage.output * 0.30 / 1_000_000;
      tokenUsage.cost = inputCost + outputCost;
    }

    console.log(`✅ Extracted ${newItems.length} new items from ${file.documentId}`);
    console.log(`📊 Document type: ${summary.documentType}, Confidence: ${summary.confidence}`);
    console.log(`⏱️  Processing time: ${processingTime}ms`);
    console.log(`💰 Cost: $${tokenUsage.cost.toFixed(6)} (${tokenUsage.input} input + ${tokenUsage.output} output tokens)`);

    return {
      newItems,
      confidence: summary.confidence,
      documentType: summary.documentType,
      tokenUsage
    };

  } catch (error) {
    console.error(`❌ Error processing ${file.documentId}:`, error);
    return {
      newItems: [],
      confidence: 0,
      documentType: 'error',
      tokenUsage: { input: 0, output: 0, cost: 0 }
    };
  }
}

/**
 * Generate unique document ID with file extension and content hash
 */
function generateUniqueDocumentId(filePath: string, index: number): string {
  try {
    // Get base filename without extension
    const fileName = filePath.split('/').pop() || `doc-${index + 1}`;
    const baseName = fileName.replace(/\.[^/.]+$/, '');

    // Get file extension
    const extension = filePath.toLowerCase().split('.').pop() || '';

    // Generate content hash for uniqueness
    const fileContent = fs.readFileSync(filePath);
    const contentHash = crypto.createHash('md5').update(fileContent).digest('hex').substring(0, 8);

    // Create unique ID: basename-extension-hash
    const uniqueId = `${baseName}-${extension}-${contentHash}`;

    console.log(`📝 Generated unique document ID: ${fileName} → ${uniqueId}`);
    return uniqueId;
  } catch (error) {
    console.warn(`⚠️  Failed to generate unique ID for ${filePath}, using fallback:`, error);
    const fileName = filePath.split('/').pop() || `doc-${index + 1}`;
    const baseName = fileName.replace(/\.[^/.]+$/, '');
    const extension = filePath.toLowerCase().split('.').pop() || '';
    return `${baseName}-${extension}-${Date.now()}`;
  }
}

/**
 * Calculate similarity between two strings for fuzzy duplicate detection
 */
function calculateStringSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;

  if (longer.length === 0) return 1.0;

  const editDistance = calculateLevenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

/**
 * Calculate Levenshtein distance between two strings
 */
function calculateLevenshteinDistance(str1: string, str2: string): number {
  const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

  for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,     // insertion
        matrix[j - 1][i] + 1,     // deletion
        matrix[j - 1][i - 1] + indicator // substitution
      );
    }
  }

  return matrix[str2.length][str1.length];
}

/**
 * Enhanced duplicate detection for spreadsheet items with fuzzy matching
 */
function findDuplicateInCache(item: SimpleMenuItem, cache: ExtractionCache): boolean {
  const itemNameNorm = item.name.toLowerCase().trim();
  const itemPrice = item.sizes[0]?.price || '0';

  return cache.items.some(existingItem => {
    const existingNameNorm = existingItem.name.toLowerCase().trim();
    const existingPrice = existingItem.sizes[0]?.price || '0';

    // Exact name and category match
    if (existingNameNorm === itemNameNorm && existingItem.category === item.category) {
      console.log(`🔍 EXACT DUPLICATE: "${item.name}" (exact match)`);
      return true;
    }

    // Fuzzy name match with same category and similar price
    const nameSimilarity = calculateStringSimilarity(existingNameNorm, itemNameNorm);
    const priceMatch = Math.abs(parseFloat(existingPrice) - parseFloat(itemPrice)) < 0.01;

    if (nameSimilarity > 0.85 && existingItem.category === item.category && priceMatch) {
      console.log(`🔍 FUZZY DUPLICATE: "${item.name}" ≈ "${existingItem.name}" (similarity: ${(nameSimilarity * 100).toFixed(1)}%, same price)`);
      return true;
    }

    // Same source location (spreadsheet row-level duplicate)
    if (item.sourceInfo && existingItem.sourceInfo &&
        item.sourceInfo.documentId === existingItem.sourceInfo.documentId &&
        item.sourceInfo.sheet === existingItem.sourceInfo.sheet) {
      console.log(`🔍 SOURCE DUPLICATE: "${item.name}" (same spreadsheet source)`);
      return true;
    }

    return false;
  });
}

/**
 * Main extraction function
 */
export async function extractMenuSimple(
  filePaths: string[],
  documentIds?: string[]
): Promise<ExtractionCache> {
  console.log('🚀 Starting Simple Menu Extraction Pipeline');
  console.log(`📁 Processing ${filePaths.length} documents`);

  // Generate document IDs if not provided - now with enhanced uniqueness
  const docIds = documentIds || filePaths.map((path, i) => generateUniqueDocumentId(path, i));

  // Initialize master cache
  const cache: ExtractionCache = {
    items: [],
    processedFiles: [],
    totalFiles: filePaths.length,
    lastUpdated: new Date().toISOString(),
    totalCost: 0
  };

  // Separate files into spreadsheets and others
  const spreadsheetFiles: { path: string; id: string }[] = [];
  const regularFiles: { path: string; id: string }[] = [];

  for (let i = 0; i < filePaths.length; i++) {
    if (isSpreadsheet(filePaths[i])) {
      spreadsheetFiles.push({ path: filePaths[i], id: docIds[i] });
    } else {
      regularFiles.push({ path: filePaths[i], id: docIds[i] });
    }
  }

  console.log(`\n📊 File type breakdown: ${spreadsheetFiles.length} spreadsheets, ${regularFiles.length} regular files`);

  // Process spreadsheets directly (no upload needed)
  console.log('\n📊 Step 1: Processing spreadsheets directly...');
  for (let i = 0; i < spreadsheetFiles.length; i++) {
    const { path, id } = spreadsheetFiles[i];

    try {
      // Process spreadsheet with current cache context
      const result = await processSpreadsheet(path, id, cache, i);

      // Update master cache with deduplication
      if (result.newItems.length > 0) {
        const uniqueItems = result.newItems.filter(item => !findDuplicateInCache(item, cache));
        const duplicateCount = result.newItems.length - uniqueItems.length;

        cache.items.push(...uniqueItems);
        cache.processedFiles.push(id);
        cache.lastUpdated = new Date().toISOString();
        cache.totalCost += result.tokenUsage.cost;

        console.log(`📊 Cache updated: ${uniqueItems.length} new items added, ${duplicateCount} duplicates skipped`);
        console.log(`📊 Total cache: ${cache.items.length} unique items`);
      } else {
        cache.processedFiles.push(id);
        cache.totalCost += result.tokenUsage.cost;
        console.log(`📝 No new items found in ${id}`);
      }
    } catch (error) {
      console.error(`❌ Failed to process spreadsheet ${id}:`, error);
      // Try fallback: attempt to process as regular file through Gemini
      console.log(`🔄 Attempting fallback: processing ${id} through Gemini Files API...`);

      try {
        const uploaded = await uploadDocument(path, id);
        const fallbackResult = await processDocument(uploaded, cache, i);

        if (fallbackResult.newItems.length > 0) {
          const uniqueItems = fallbackResult.newItems.filter(item => !findDuplicateInCache(item, cache));
          const duplicateCount = fallbackResult.newItems.length - uniqueItems.length;

          cache.items.push(...uniqueItems);
          cache.processedFiles.push(id);
          cache.lastUpdated = new Date().toISOString();
          cache.totalCost += fallbackResult.tokenUsage.cost;
          console.log(`✅ Fallback successful: ${uniqueItems.length} new items added, ${duplicateCount} duplicates skipped`);
        } else {
          cache.processedFiles.push(id);
          cache.totalCost += fallbackResult.tokenUsage.cost;
          console.log(`📝 Fallback completed but no items found in ${id}`);
        }
      } catch (fallbackError) {
        console.error(`❌ Fallback also failed for ${id}:`, fallbackError);
        cache.processedFiles.push(id);
        console.log(`⚠️  Skipping ${id} - both direct parsing and Gemini processing failed`);
      }
    }
  }

  // Upload and process regular files through Gemini
  console.log('\n📤 Step 2: Uploading regular documents to Files API...');
  const uploadedFiles: UploadedFile[] = [];

  // Process uploads with controlled concurrency to avoid rate limits
  const uploadResults = await processWithConcurrency(
    regularFiles,
    async ({ path, id }: { path: string; id: string }, index: number) => {
      try {
        console.log(`📤 Uploading: ${id}`);
        const uploaded = await uploadDocument(path, id);
        return uploaded;
      } catch (error) {
        console.error(`⚠️  Skipping ${id} due to upload failure:`, error);
        cache.totalFiles--;
        return null;
      }
    },
    3 // Max 3 concurrent uploads to respect API rate limits
  );
  
  // Filter out failed uploads
  uploadedFiles.push(...uploadResults.filter((result): result is UploadedFile => result !== null));

  console.log(`\n✅ Successfully uploaded ${uploadedFiles.length}/${regularFiles.length} regular documents`);

  // Process regular documents one by one
    console.log('\n🔄 Step 3: Processing regular documents with progressive caching...');

  // Process documents with controlled concurrency to avoid rate limits
  await processWithConcurrency(
    uploadedFiles,
    async (file: UploadedFile, index: number) => {
      // Process document with current cache context
      const result = await processDocument(file, cache, index + spreadsheetFiles.length);

      // Update master cache with deduplication
      if (result.newItems.length > 0) {
        const uniqueItems = result.newItems.filter(item => !findDuplicateInCache(item, cache));
        const duplicateCount = result.newItems.length - uniqueItems.length;

        cache.items.push(...uniqueItems);
        cache.processedFiles.push(file.documentId);
        cache.lastUpdated = new Date().toISOString();

        console.log(`✅ [${index + 1 + spreadsheetFiles.length}/${cache.totalFiles}] ${file.documentId}: +${uniqueItems.length} items (${duplicateCount} duplicates filtered)`);
      } else {
        console.log(`📝 [${index + 1 + spreadsheetFiles.length}/${cache.totalFiles}] ${file.documentId}: No new items found`);
      }

      return result;
    },
    2 // Max 2 concurrent document processing to avoid overwhelming the API
  );

  for (let i = 0; i < uploadedFiles.length; i++) {
    const file = uploadedFiles[i];

    // Process document with current cache context
    const result = await processDocument(file, cache, i + spreadsheetFiles.length);

    // Update master cache with deduplication
    if (result.newItems.length > 0) {
      const uniqueItems = result.newItems.filter(item => !findDuplicateInCache(item, cache));
      const duplicateCount = result.newItems.length - uniqueItems.length;

      cache.items.push(...uniqueItems);
      cache.processedFiles.push(file.documentId);
      cache.lastUpdated = new Date().toISOString();
      cache.totalCost += result.tokenUsage.cost;

      console.log(`📊 Cache updated: ${uniqueItems.length} new items added, ${duplicateCount} duplicates skipped`);
      console.log(`📊 Total cache: ${cache.items.length} unique items`);
    } else {
      cache.processedFiles.push(file.documentId);
      cache.totalCost += result.tokenUsage.cost;
      console.log(`📝 No new items found in ${file.documentId}`);
    }

    // Small delay to avoid rate limiting
    if (i < uploadedFiles.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  // Final summary
  console.log('\n🎉 Extraction Complete!');
  console.log(`✅ Total items extracted: ${cache.items.length}`);
  console.log(`📁 Documents processed: ${cache.processedFiles.length}/${cache.totalFiles}`);
  console.log(`💰 Total cost: $${cache.totalCost.toFixed(6)}`);

  // Category breakdown
  const categoryStats = cache.items.reduce((acc, item) => {
    const cat = item.category || 'Uncategorized';
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log('\n📊 Category Breakdown:');
  Object.entries(categoryStats)
    .sort(([,a], [,b]) => b - a)
    .forEach(([category, count]) => {
      console.log(`  - ${category}: ${count} items`);
    });

  return cache;
}

/**
 * Save extraction results to file
 */
export async function saveResults(cache: ExtractionCache, outputPath: string = './extraction-results.json'): Promise<void> {
  const fs = await import('fs');
  const results = {
    ...cache,
    exportedAt: new Date().toISOString(),
    summary: {
      totalItems: cache.items.length,
      totalDocuments: cache.processedFiles.length,
      totalCost: cache.totalCost,
      averageItemsPerDocument: Math.round(cache.items.length / cache.processedFiles.length * 100) / 100
    }
  };

  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`💾 Results saved to ${outputPath}`);
}

/**
 * Test function to see what Gemini sees in the document
 */
export async function testDocumentContent(filePath: string): Promise<void> {
  console.log(`🧪 Testing document: ${filePath}`);

  const uploaded = await uploadDocument(filePath, 'test-doc');
  const { genAI } = initializeClients();

  const testModel = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 2000
    }
  });

  const result = await testModel.generateContent({
    contents: [{
      role: 'user',
      parts: [
        { text: `Analyze this document and tell me:
1. What type of document is this? (PDF, image, spreadsheet, etc.)
2. What content do you see? Describe the main elements.
3. Are there any menu items, food items, or product listings?
4. If yes, list 5-10 examples of what you find.
5. What format are the items in? (tables, lists, paragraphs, etc.)
6. Can you see any prices or categories?` },
        {
          fileData: {
            mimeType: uploaded.mimeType,
            fileUri: uploaded.uri
          }
        }
      ]
    }]
  });

  const response = result.response.text();
  console.log(`📋 Gemini's analysis:\n${response}`);

  // Clean up the test file
  try {
    const fs = await import('fs');
    fs.unlinkSync(filePath);
  } catch (e) {
    // Ignore cleanup errors
  }
}