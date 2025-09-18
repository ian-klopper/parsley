/**
 * Phase 3: Modifier and Size Enrichment
 * Uses Gemini Pro to structure modifiers and sizes from raw menu items
 * 
 * OPTIMIZATION: This phase has been optimized to reduce token usage by:
 * 1. Only requesting enrichment data (sizes and modifiers) from the AI
 * 2. Using a simple ID reference system to map enrichment data back to original items
 * 3. Implementing robust JSON parsing with recovery for truncated responses
 * 4. Reducing output token usage by eliminating duplicate data in responses
 */

import { debugLogger } from '../utils/debug-logger';
import { RealTokenTracker } from '../utils/token-tracker';
import { models, estimateTextTokens } from '../models/gemini-models';
import { allowedCategories, allowedSizes } from '../types';
import { proRateLimiter } from '../../gemini-rate-limiter';
import { getFileManager, UploadedFile } from '../gemini-file-manager';
import { getCacheManager } from '../cache-manager';
import { globalCacheTracker } from '../utils/cache-tracker';
import type {
  PreparedDocument,
  RawMenuItem,
  FinalMenuItem,
  SizeOption,
  ModifierGroup
} from '../types';

/**
 * Interface for tracking accumulated modifiers across sequential batches
 */
interface AccumulatedModifiers {
  modifierGroups: ModifierGroup[];
  usedNames: Set<string>;
}

/**
 * Create enrichment batches (group items for Pro processing)
 */
function createEnrichmentBatches(items: RawMenuItem[], itemsPerBatch = 30): RawMenuItem[][] {
  const batches: RawMenuItem[][] = [];

  for (let i = 0; i < items.length; i += itemsPerBatch) {
    const batch = items.slice(i, i + itemsPerBatch);
    batches.push(batch);
  }

  debugLogger.debug(3, 'ENRICHMENT_BATCHES_CREATED',
    `${batches.length} batches, ${itemsPerBatch} items per batch`);

  return batches;
}

/**
 * Find relevant context from original documents for a batch of items
 * Enhanced to include text content even from image-classified PDFs for mixed content
 */
function findRelevantContext(
  itemBatch: RawMenuItem[],
  documents: PreparedDocument[],
  maxTokens = 2000
): string {
  let context = '';
  let currentTokens = 0;

  // Get document IDs referenced by items in this batch
  const referencedDocIds = new Set(itemBatch.map(item => item.sourceInfo.documentId));

  for (const docId of Array.from(referencedDocIds)) {
    const doc = documents.find(d => d.id === docId);
    if (!doc) continue;

    let docContext = `\n--- ${doc.name} ---\n`;

    if (doc.type === 'pdf' && doc.pages) {
      // Include relevant pages - now with enhanced context for mixed PDFs
      const referencedPages = new Set(
        itemBatch
          .filter(item => item.sourceInfo.documentId === docId && item.sourceInfo.page)
          .map(item => item.sourceInfo.page!)
      );

      for (const page of doc.pages) {
        if (referencedPages.size === 0 || referencedPages.has(page.pageNumber)) {
          if (!page.isImage && page.content) {
            // Include a sample of the text content for text-based pages
            const sample = page.content.substring(0, 500);
            docContext += `Page ${page.pageNumber}: ${sample}...\n`;
          } else if (page.isImage) {
            // Enhanced context for image-based pages - try to extract any available text
            // This helps with mixed PDFs that have some text content
            if (page.content && typeof page.content === 'string') {
              // Check if this is mixed content (has both text and image data)
              if (page.content.startsWith('[MIXED_CONTENT_PDF]')) {
                // Extract the text portion from mixed content using a more compatible regex
                const textStart = page.content.indexOf('Extracted Text (');
                const imageDataStart = page.content.indexOf('\n\n[IMAGE_DATA]');
                
                if (textStart !== -1 && imageDataStart !== -1 && imageDataStart > textStart) {
                  const textSection = page.content.substring(textStart, imageDataStart);
                  const textMatch = textSection.match(/Extracted Text \(\d+ words\):\n(.*)/);
                  if (textMatch && textMatch[1] && textMatch[1].trim().length > 10) {
                    const extractedText = textMatch[1].trim();
                    const sample = extractedText.substring(0, 300);
                    docContext += `Page ${page.pageNumber}: [Mixed content PDF - extracted text available] ${sample}...\n`;
                    debugLogger.debug(3, 'MIXED_CONTENT_FOUND', `Found ${extractedText.length} chars of text in mixed PDF`);
                  } else {
                    docContext += `Page ${page.pageNumber}: [Mixed content PDF - limited text available]\n`;
                  }
                } else {
                  docContext += `Page ${page.pageNumber}: [Mixed content PDF - limited text available]\n`;
                }
              } else if (page.content.length > 100 && !page.content.includes('data:image')) {
                // If we have substantial text content (not just base64 image), include a sample
                const sample = page.content.substring(0, 300);
                docContext += `Page ${page.pageNumber}: [Partial text content] ${sample}...\n`;
              } else {
                // For true image pages, add a note but also include any OCR context if available
                docContext += `Page ${page.pageNumber}: [Image-based content - context extracted from items only]\n`;
              }
            } else {
              // For true image pages, add a note so Phase 3 knows context is limited
              docContext += `Page ${page.pageNumber}: [Image-based content - context extracted from items only]\n`;
            }
          }
        }
      }
    } else if (doc.type === 'spreadsheet' && doc.sheets) {
      // Include relevant sheets
      const referencedSheets = new Set(
        itemBatch
          .filter(item => item.sourceInfo.documentId === docId && item.sourceInfo.sheet)
          .map(item => item.sourceInfo.sheet!)
      );

      for (const sheet of doc.sheets) {
        if (referencedSheets.size === 0 || referencedSheets.has(sheet.name)) {
          // Include a sample of the sheet content
          const lines = sheet.content.split('\n').slice(0, 10); // First 10 lines
          docContext += `Sheet "${sheet.name}":\n${lines.join('\n')}\n`;
        }
      }
    } else if (doc.type === 'image') {
      // For image documents, add a note so Phase 3 knows context is limited
      docContext += `[Image document - context extracted from items only]\n`;
    }

    // Check if adding this document context would exceed token limit
    const docTokens = estimateTextTokens(docContext);
    if (currentTokens + docTokens > maxTokens) {
      context += '\n... (additional context truncated)\n';
      break;
    }

    context += docContext;
    currentTokens += docTokens;
  }

  return context;
}

/**
 * Create optimized enrichment prompt that only returns sizes and modifiers
 * Now supports multimodal input for full document context
 */
function createEnrichmentPrompt(itemBatch: RawMenuItem[], documents: PreparedDocument[], uploadedFiles: Map<string, UploadedFile>): any {
  const parts: any[] = [
    {
      text: `You are an expert menu consultant. Add sizes and modifiers to these menu items.

PREDEFINED CATEGORIES (use exact names):
${allowedCategories.join(', ')}

PREDEFINED SIZES (use exact names):
${allowedSizes.join(', ')}

TASKS:
1. Find size options mentioned in descriptions and structure them
2. Find modifier groups (toppings, sides, add-ons) and structure them
3. Check original context for general rules about sizes/modifiers
4. Ensure consistent naming and remove duplicates

SIZE RULES:
- Extract sizes from item descriptions (Small, Large, 6 oz, etc.)
- Use ONLY predefined sizes
- Create size options with prices if mentioned
- If no sizes mentioned, create one default size with the base price

MODIFIER RULES:
- Look for choices like "choose X, Y, Z" or "add X for $Y"
- Group related modifiers (all toppings together, all sides together)
- Mark as required/optional and single/multi-select
- Extract pricing for modifiers when available

IMPORTANT: DO NOT repeat item names, descriptions, or categories in your response.
ONLY return the ID, sizes and modifier groups for each item.

Raw menu items to structure:
${itemBatch.map((item, index) => `
ITEM ID: ${index + 1}
Name: ${item.name}
Category: ${item.category || 'Unknown'}
Price: ${item.price || '$0.00'}
Description: ${item.description || 'None'}
Section: ${item.section || 'Unknown'}
`).join('\n')}

Return ONLY a JSON array with this EXACT structure:
[
  {
    "id": "1", 
    "sizes": [
      {
        "size": "N/A",
        "price": "12.99",
        "isDefault": true
      }
    ],
    "modifierGroups": [
      {
        "name": "Add Protein",
        "options": ["Grilled Chicken (+$5)", "Salmon (+$8)"],
        "required": false,
        "multiSelect": false
      }
    ]
  }
]`
    }
  ];

  // Add file references for all uploaded documents to provide full context
  for (const doc of documents) {
    const uploadedFile = uploadedFiles.get(doc.id);
    if (uploadedFile) {
      parts.push({
        fileData: {
          mimeType: uploadedFile.mimeType,
          fileUri: uploadedFile.uri
        }
      });
    }
  }

  return { contents: [{ parts }] };
}

/**
 * Create enrichment prompt with accumulated modifier context for sequential batching
 */
function createEnrichmentPromptWithContext(
  itemBatch: RawMenuItem[],
  documents: PreparedDocument[],
  uploadedFiles: Map<string, UploadedFile>,
  accumulatedModifiers: AccumulatedModifiers
): any {
  const existingModifiersText = accumulatedModifiers.modifierGroups.length > 0
    ? `\n\nEXISTING MODIFIER GROUPS (maintain consistency - avoid duplicates):\n${JSON.stringify(accumulatedModifiers.modifierGroups, null, 2)}`
    : '';

  const parts: any[] = [
    {
      text: `You are an expert menu consultant. Add sizes and modifiers to these menu items.

PREDEFINED CATEGORIES (use exact names):
${allowedCategories.join(', ')}

PREDEFINED SIZES (use exact names):
${allowedSizes.join(', ')}

TASKS:
1. Find size options mentioned in descriptions and structure them
2. Find modifier groups (toppings, sides, add-ons) and structure them
3. IMPORTANT: Check existing modifier groups and maintain consistency - use similar naming for similar modifiers
4. If creating new modifier groups, ensure they don't duplicate existing ones
5. Extract pricing for modifiers when available

${existingModifiersText}

Raw menu items to structure:
${itemBatch.map((item, index) => `
ITEM ID: ${index + 1}
Name: ${item.name}
Category: ${item.category || 'Unknown'}
Price: ${item.price || '$0.00'}
Description: ${item.description || 'None'}
Section: ${item.section || 'Unknown'}
`).join('\n')}

Return ONLY a JSON array with this EXACT structure:
[
  {
    "id": "1",
    "sizes": [
      {
        "size": "N/A",
        "price": "12.99",
        "isDefault": true
      }
    ],
    "modifierGroups": [
      {
        "name": "Add Protein",
        "options": ["Grilled Chicken (+$5)", "Salmon (+$8)"],
        "required": false,
        "multiSelect": false
      }
    ]
  }
]`
    }
  ];

  // Add file references for all uploaded documents to provide full context
  for (const doc of documents) {
    const uploadedFile = uploadedFiles.get(doc.id);
    if (uploadedFile) {
      parts.push({
        fileData: {
          mimeType: uploadedFile.mimeType,
          fileUri: uploadedFile.uri
        }
      });
    }
  }

  return { contents: [{ parts }] };
}

/**
 * Update accumulated modifiers from batch results
 */
function updateAccumulatedModifiers(
  current: AccumulatedModifiers,
  newItems: FinalMenuItem[]
): AccumulatedModifiers {
  const updated = { ...current };

  for (const item of newItems) {
    for (const modifierGroup of item.modifierGroups) {
      // Check for duplicates by name similarity
      const existingGroup = updated.modifierGroups.find(g =>
        g.name.toLowerCase() === modifierGroup.name.toLowerCase() ||
        calculateSimilarity(g.name, modifierGroup.name) > 0.8
      );

      if (!existingGroup) {
        updated.modifierGroups.push(modifierGroup);
        updated.usedNames.add(modifierGroup.name.toLowerCase());
      }
    }
  }

  return updated;
}

/**
 * Calculate similarity between two strings for duplicate detection
 */
function calculateSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;

  if (longer.length === 0) return 1.0;

  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

/**
 * Calculate Levenshtein distance for string similarity
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

/**
 * Parse and validate enrichment response
 * Now optimized to handle ID-based enrichment data
 */
function parseEnrichmentResponse(responseText: string): Array<{
  id: string;
  sizes: SizeOption[];
  modifierGroups: ModifierGroup[];
}> {
  try {
    // Debug: Log what Phase 3 AI actually returned
    console.log('🔍 PHASE 3 RESPONSE DEBUG:');
    console.log(`Response length: ${responseText.length} chars`);
    console.log(`First 500 chars: ${responseText.substring(0, 500)}`);

    // Clean response
    let cleanResponse = responseText.trim();
    if (cleanResponse.startsWith('```json')) {
      cleanResponse = cleanResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleanResponse.startsWith('```')) {
      cleanResponse = cleanResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    try {
      const parsed = JSON.parse(cleanResponse);
      
      if (!Array.isArray(parsed)) {
        throw new Error('Response is not an array');
      }

      // Validate each enrichment item has an ID
      const enrichmentItems = parsed.map((item: any, index: number) => {
        if (!item.id) {
          debugLogger.warn(3, 'MISSING_ID',
            `Enrichment item at index ${index} missing ID, assigning ID "${index + 1}"`);
          item.id = String(index + 1);
        }

        // Validate and clean sizes
        const sizes: SizeOption[] = (item.sizes || []).map((size: any) => {
          let sizeValue = size.size || 'N/A';

          // Check if size is in allowed list
          if (!allowedSizes.includes(sizeValue)) {
            debugLogger.warn(3, 'INVALID_SIZE_FIXED',
              `Item ID "${item.id}" had invalid size "${sizeValue}", using "N/A"`);
            sizeValue = 'N/A';
          }

          return {
            size: sizeValue,
            price: (size.price || '0').toString(),
            isDefault: size.isDefault || false
          };
        });

        // Ensure at least one size
        if (sizes.length === 0) {
          sizes.push({
            size: 'N/A',
            price: '0',
            isDefault: true
          });
        }

        // Clean modifier groups
        const modifierGroups: ModifierGroup[] = (item.modifierGroups || []).map((group: any) => ({
          name: group.name || 'Options',
          options: Array.isArray(group.options) ? group.options : [],
          required: Boolean(group.required),
          multiSelect: Boolean(group.multiSelect)
        }));

        // Debug: Log modifier processing for this item
        if (index < 5) { // Only log first 5 items to avoid spam
          console.log(`Item ${item.id}: ${(item.modifierGroups || []).length} raw modifiers → ${modifierGroups.length} valid modifiers`);
          if (modifierGroups.length > 0) {
            modifierGroups.forEach((group, i) => {
              console.log(`  Group ${i}: "${group.name}" with ${group.options.length} options: [${group.options.slice(0, 3).join(', ')}${group.options.length > 3 ? '...' : ''}]`);
            });
          }
        }

        return {
          id: String(item.id),
          sizes,
          modifierGroups
        };
      });

      return enrichmentItems;
    } catch (error) {
      // Try to recover from truncated JSON
      debugLogger.warn(3, 'JSON_PARSE_ERROR',
        `Initial parse failed: ${(error as Error).message}. Attempting to recover...`);

      // Try to find and fix the most common truncation issues
      if (cleanResponse.endsWith(',')) {
        cleanResponse = cleanResponse + ' {}]';
      }
      
      if (!cleanResponse.endsWith(']')) {
        cleanResponse = cleanResponse + ']';
      }

      // Find the last valid object in a potentially truncated array
      const objRegex = /\{[^{}]*\}/g;
      const matches = cleanResponse.match(objRegex);

      if (matches && matches.length > 0) {
        // Extract all complete objects we can find
        const validObjects = [];
        
        for (const match of matches) {
          try {
            const obj = JSON.parse(match);
            // Add ID if missing
            if (!obj.id) {
              obj.id = String(validObjects.length + 1);
            }
            validObjects.push(obj);
          } catch (e) {
            // Skip invalid objects
          }
        }
        
        if (validObjects.length > 0) {
          debugLogger.debug(3, 'JSON_RECOVERY',
            `Recovered ${validObjects.length} valid objects from truncated JSON`);
          
          // Process these recovered objects
          return validObjects.map((item, index) => {
            // Ensure each recovered object has required fields
            return {
              id: String(item.id || index + 1),
              sizes: Array.isArray(item.sizes) ? item.sizes.map((size: any) => ({
                size: allowedSizes.includes(size.size) ? size.size : 'N/A',
                price: (size.price || '0').toString(),
                isDefault: Boolean(size.isDefault)
              })) : [{
                size: 'N/A',
                price: '0',
                isDefault: true
              }],
              modifierGroups: Array.isArray(item.modifierGroups) ? item.modifierGroups.map((group: any) => ({
                name: group.name || 'Options',
                options: Array.isArray(group.options) ? group.options : [],
                required: Boolean(group.required),
                multiSelect: Boolean(group.multiSelect)
              })) : []
            };
          });
        }
      }

      // If recovery failed, rethrow
      throw error;
    }

  } catch (error) {
    debugLogger.error(3, 'ENRICHMENT_PARSE_FAILED', (error as Error).message, { responseText });
    throw new Error(`Failed to parse enrichment response: ${(error as Error).message}`);
  }
}

/**
 * Try to use cached extraction data to perform enrichment
 * This references the master cache created by Phase 2
 */
async function tryUseCachedExtraction(
  rawItems: RawMenuItem[],
  documents: PreparedDocument[],
  uploadedFiles: Map<string, UploadedFile>,
  tokenTracker: RealTokenTracker,
  masterCacheKey: string
): Promise<FinalMenuItem[] | null> {
  try {
    const cacheManager = getCacheManager();
    const jobId = masterCacheKey.replace('master-', '');

    // Try to get the cached extraction data
    const cachedExtraction = await cacheManager.getCachedContent(`extraction-${jobId}`);

    if (!cachedExtraction) {
      debugLogger.debug(3, 'CACHE_MISS', 'No cached extraction data found');
      globalCacheTracker.recordCacheMiss(`extraction-${jobId}`, 3, jobId);
      return null;
    }

    debugLogger.debug(3, 'CACHE_HIT', `Found cached extraction: ${cachedExtraction.tokenCount} tokens`);
    globalCacheTracker.recordCacheHit(`extraction-${jobId}`, cachedExtraction.tokenCount, 0.002, 3, jobId);

    // Create enrichment prompt that references the cached data
    const enrichmentPrompt = `You are an expert menu consultant. Using the cached extraction data, add sizes and modifiers to these menu items.

PREDEFINED CATEGORIES (use exact names):
${allowedCategories.join(', ')}

PREDEFINED SIZES (use exact names):
${allowedSizes.join(', ')}

CACHED EXTRACTION REFERENCE: ${cachedExtraction.uri}

TASKS:
1. Use the cached extraction data to understand all menu items
2. Find size options mentioned in descriptions and structure them
3. Find modifier groups (toppings, sides, add-ons) and structure them
4. Extract pricing for modifiers when available
5. Maintain consistency across all items

Return ONLY a JSON array with enrichment data for the first ${Math.min(rawItems.length, 50)} items:
[
  {
    "id": "1",
    "sizes": [{"size": "Regular", "price": "12.99", "isDefault": true}],
    "modifierGroups": [
      {
        "name": "Add Protein",
        "options": ["Grilled Chicken (+$5)", "Salmon (+$8)"],
        "required": false,
        "multiSelect": false
      }
    ]
  }
]`;

    // Add document file references
    const parts: any[] = [{ text: enrichmentPrompt }];
    for (const doc of documents) {
      const uploadedFile = uploadedFiles.get(doc.id);
      if (uploadedFile) {
        parts.push({
          fileData: {
            mimeType: uploadedFile.mimeType,
            fileUri: uploadedFile.uri
          }
        });
      }
    }

    // Make API call using cached context
    debugLogger.apiCallStart(3, 1, 'gemini-pro', estimateTextTokens(enrichmentPrompt));
    const startTime = Date.now();

    await proRateLimiter.acquire();
    const response = await models.pro.generateContent({
      contents: [{ role: 'user', parts }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 8000,
        stopSequences: [],
      }
    });

    const responseTime = Date.now() - startTime;
    const responseText = response.response.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Track token usage
    const tokenUsage = tokenTracker.recordApiCall(3, 'pro', response);
    debugLogger.apiCallComplete(3, 1, 'gemini-pro', tokenUsage.input, tokenUsage.output, responseTime, tokenUsage.cost);

    // Parse the enriched items
    const enrichedItems = parseEnrichmentResponse(responseText, rawItems.slice(0, 50));

    debugLogger.success(3, 'CACHE_ENRICHMENT_PARSED',
      `Successfully parsed ${enrichedItems.length} enriched items from cached data`);

    return enrichedItems;

  } catch (error) {
    debugLogger.warn(3, 'CACHE_ENRICHMENT_FAILED',
      `Cache-based enrichment failed: ${(error as Error).message}`);
    return null;
  }
}

/**
 * Process all items in a single enrichment call for full context
 * Falls back to batching only if the single call fails
 */
async function processSingleEnrichmentCall(
  items: RawMenuItem[],
  documents: PreparedDocument[],
  uploadedFiles: Map<string, UploadedFile>,
  tokenTracker: RealTokenTracker
): Promise<FinalMenuItem[]> {
  debugLogger.debug(3, 'SINGLE_CALL_ATTEMPT',
    `Attempting single enrichment call for ${items.length} items`);

  try {
    // Create multimodal prompt with full document context using file references
    const prompt = createEnrichmentPrompt(items, documents, uploadedFiles);
    const promptTokens = estimateTextTokens(JSON.stringify(prompt));

    debugLogger.debug(3, 'SINGLE_CALL_PROMPT_SIZE',
      `Prompt tokens: ${promptTokens}, Items: ${items.length}, Documents: ${documents.length}`);

    // Debug: Log prompt structure
    console.log('🔍 PHASE 3 PROMPT DEBUG:');
    console.log(`Text parts: ${prompt.contents[0].parts.filter((p: any) => p.text).length}`);
    console.log(`File refs: ${prompt.contents[0].parts.filter((p: any) => p.fileData).length}`);

    // Make API call to Gemini 2.5 Pro with thinking disabled
    debugLogger.apiCallStart(3, 1, 'gemini-2.5-pro', promptTokens);
    const startTime = Date.now();

    // Use rate limiter for Pro model (2 req/min)
    const response = await proRateLimiter.enqueue(async () => {
      return models.pro.generateContent({
        contents: [{
          role: 'user',
          parts: prompt.contents[0].parts
        }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 20000, // Increased for full context
          stopSequences: [],
        }
      });
    });

    const responseTime = Date.now() - startTime;

    // Extract response text from Google AI SDK response format
    const responseText = response.response.candidates?.[0]?.content?.parts?.[0]?.text || '';

    console.log(`DEBUG: Phase 3 Single call response text length:`, responseText.length);
    if (responseText.length === 0) {
      console.log(`DEBUG: Phase 3 Single call full response:`, JSON.stringify(response, null, 2));
    }

    // Track real tokens and cost
    const tokenUsage = tokenTracker.recordApiCall(3, 'pro', response);
    debugLogger.apiCallComplete(3, 1, 'gemini-2.5-pro', tokenUsage.input, tokenUsage.output, responseTime, tokenUsage.cost);

    // Parse response to get only the enrichment data
    const enrichmentData = parseEnrichmentResponse(responseText);
    
    // Map the enrichment data back to the original items
    const enrichedItems: FinalMenuItem[] = items.map((item, idx) => {
      const id = String(idx + 1);
      // Find matching enrichment data by ID
      const enrichment = enrichmentData.find(e => e.id === id);
      
      // If we found enrichment data for this item, use it; otherwise provide defaults
      const sizes = enrichment?.sizes || [{
        size: 'N/A',
        price: item.price,
        isDefault: true
      }];
      
      const modifierGroups = enrichment?.modifierGroups || [];
      
      return {
        name: item.name,
        description: item.description,
        category: allowedCategories.includes(item.category) ? item.category : 'Open Food',
        section: item.section,
        sizes,
        modifierGroups,
        sourceInfo: item.sourceInfo
      };
    });
    
    debugLogger.success(3, 'SINGLE_CALL_SUCCESS',
      `Successfully processed ${enrichedItems.length} items in single call`);
    
    return enrichedItems;

  } catch (error) {
    debugLogger.warn(3, 'SINGLE_CALL_FAILED', 
      `Single call failed for ${items.length} items: ${(error as Error).message}. Will fall back to batching.`);
    debugLogger.apiCallError(3, 1, 'gemini-2.5-pro', (error as Error).message);
    
    // Rethrow to trigger fallback
    throw error;
  }
}

/**
 * Process a single enrichment batch (fallback for when single call fails)
 * Now optimized to only request and handle enrichment data (sizes & modifiers)
 */
async function processEnrichmentBatch(
  itemBatch: RawMenuItem[],
  documents: PreparedDocument[],
  uploadedFiles: Map<string, UploadedFile>,
  tokenTracker: RealTokenTracker,
  batchIndex: number,
  totalBatches: number
): Promise<FinalMenuItem[]> {
  debugLogger.batchStart(3, batchIndex, totalBatches, 0, 'gemini-2.5-pro');

  try {
    // Create multimodal prompt with document context
    const prompt = createEnrichmentPrompt(itemBatch, documents, uploadedFiles);
    const promptTokens = estimateTextTokens(JSON.stringify(prompt));

    // Debug: Log prompt structure
    console.log(`🔍 PHASE 3 BATCH ${batchIndex} PROMPT DEBUG:`);
    console.log(`Text parts: ${prompt.contents[0].parts.filter((p: any) => p.text).length}`);
    console.log(`Image parts: ${prompt.contents[0].parts.filter((p: any) => p.inlineData).length}`);

    // Make API call to Gemini 2.5 Pro with thinking disabled
    debugLogger.apiCallStart(3, batchIndex, 'gemini-2.5-pro', promptTokens);
    const startTime = Date.now();

    const response = await models.pro.generateContent({
      contents: [{
        role: 'user',
        parts: prompt.contents[0].parts
      }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 10000, // Standard size for batches
        stopSequences: [],
      }
    });

    const responseTime = Date.now() - startTime;

    // Extract response text from Google AI SDK response format
    const responseText = response.response.candidates?.[0]?.content?.parts?.[0]?.text || '';

    console.log(`DEBUG: Phase 3 Batch ${batchIndex} response text length:`, responseText.length);
    if (responseText.length === 0) {
      console.log(`DEBUG: Phase 3 Batch ${batchIndex} full response:`, JSON.stringify(response, null, 2));
    }

    // Track real tokens and cost
    const tokenUsage = tokenTracker.recordApiCall(3, 'pro', response);
    debugLogger.apiCallComplete(3, batchIndex, 'gemini-2.5-pro', tokenUsage.input, tokenUsage.output, responseTime, tokenUsage.cost);

    // Parse response to get only the enrichment data
    const enrichmentData = parseEnrichmentResponse(responseText);
    
    // Map the enrichment data back to the original items
    const enrichedItems: FinalMenuItem[] = itemBatch.map((item, idx) => {
      const id = String(idx + 1);
      // Find matching enrichment data by ID
      const enrichment = enrichmentData.find(e => e.id === id);
      
      // If we found enrichment data for this item, use it; otherwise provide defaults
      const sizes = enrichment?.sizes || [{
        size: 'N/A',
        price: item.price,
        isDefault: true
      }];
      
      const modifierGroups = enrichment?.modifierGroups || [];
      
      return {
        name: item.name,
        description: item.description,
        category: allowedCategories.includes(item.category) ? item.category : 'Open Food',
        section: item.section,
        sizes,
        modifierGroups,
        sourceInfo: item.sourceInfo
      };
    });
    
    debugLogger.batchComplete(3, batchIndex, enrichedItems.length, responseTime);
    return enrichedItems;

  } catch (error) {
    debugLogger.error(3, 'BATCH_ENRICHMENT_FAILED', `Batch ${batchIndex}: ${(error as Error).message}`);
    debugLogger.apiCallError(3, batchIndex, 'gemini-2.5-pro', (error as Error).message);

    // Return minimal structured versions of original items
    return itemBatch.map(item => ({
      name: item.name,
      description: item.description,
      category: allowedCategories.includes(item.category) ? item.category : 'Open Food',
      section: item.section,
      sizes: [{
        size: 'N/A',
        price: item.price,
        isDefault: true
      }],
      modifierGroups: [],
      sourceInfo: item.sourceInfo
    }));
  }
}

/**
 * Main Phase 3: Enrich menu items with modifiers and sizes
 * Now starts with a single call for full context, falls back to batching if needed
 */
export async function enrichMenuItems(
  rawItems: RawMenuItem[],
  documents: PreparedDocument[],
  tokenTracker: RealTokenTracker,
  masterCacheKey?: string
): Promise<FinalMenuItem[]> {
  debugLogger.startPhase(3, 'Modifier and Size Enrichment with Gemini Pro');

  if (rawItems.length === 0) {
    debugLogger.warn(3, 'NO_ITEMS_TO_ENRICH', 'No raw items provided for enrichment');
    debugLogger.endPhase(3, 'Enrichment Skipped', 0);
    return [];
  }

  let enrichedItems: FinalMenuItem[] = [];

  try {
    // Get file manager and ensure all documents are uploaded
    const fileManager = getFileManager();
    const uploadedFiles = await fileManager.uploadAllDocuments(documents);
    debugLogger.debug(3, 'FILES_READY', `Using ${uploadedFiles.size} uploaded files for enrichment`);

    // STEP 0: Skip explicit caching - use implicit caching for Gemini 2.5 models
    debugLogger.debug(3, 'CACHE_SKIP', 'Using implicit caching for Gemini 2.5 models instead of explicit cache');

    // STEP 1: Try single call for full context (fallback approach)
    debugLogger.debug(3, 'ENRICHMENT_STRATEGY',
      `Cache unavailable, attempting single call for ${rawItems.length} items for full context`);

    try {
      enrichedItems = await processSingleEnrichmentCall(rawItems, documents, uploadedFiles, tokenTracker);
      
      // Log enrichment summary for single call success
      const sizeCounts = enrichedItems.reduce((acc, item) => acc + item.sizes.length, 0);
      const modifierCounts = enrichedItems.reduce((acc, item) => acc + item.modifierGroups.length, 0);

      debugLogger.success(3, 'SINGLE_CALL_ENRICHMENT_COMPLETE',
        `${enrichedItems.length} items enriched in single call, ${sizeCounts} sizes, ${modifierCounts} modifier groups`);

    } catch (singleCallError) {
      // STEP 2: Fall back to batching if single call fails
      debugLogger.warn(3, 'FALLBACK_TO_BATCHING',
        `Single call failed, falling back to batch processing: ${(singleCallError as Error).message}`);

      // Create batches for Pro processing - reduced batch size to avoid truncation
      const batches = createEnrichmentBatches(rawItems, 15);

      debugLogger.debug(3, 'ENRICHMENT_BATCHING_START',
        `Processing ${rawItems.length} items in ${batches.length} batches (fallback)`);

      // Process batches SEQUENTIALLY with accumulating context to maintain modifier consistency
      debugLogger.debug(3, 'SEQUENTIAL_BATCHING_START',
        `Processing ${rawItems.length} items in ${batches.length} sequential batches`);

      let accumulatedModifiers: AccumulatedModifiers = {
        modifierGroups: [],
        usedNames: new Set()
      };

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        const batchIndex = i + 1;

        debugLogger.debug(3, 'SEQUENTIAL_BATCH_PROCESSING',
          `Batch ${batchIndex}/${batches.length}: ${batch.length} items`);

        const enrichedBatch = await proRateLimiter.enqueue(async () => {
          debugLogger.batchStart(3, batchIndex, batches.length, 0, 'gemini-2.5-pro');
          const startTime = Date.now();

          try {
            // Create multimodal prompt with document context AND accumulated modifiers
            const prompt = createEnrichmentPromptWithContext(batch, documents, uploadedFiles, accumulatedModifiers);
            const promptTokens = estimateTextTokens(JSON.stringify(prompt));

            // Debug: Log prompt structure
            console.log(`🔍 PHASE 3 SEQUENTIAL BATCH ${batchIndex} PROMPT DEBUG:`);
            console.log(`Text parts: ${prompt.contents[0].parts.filter((p: any) => p.text).length}`);
            console.log(`File refs: ${prompt.contents[0].parts.filter((p: any) => p.fileData).length}`);
            console.log(`Accumulated modifiers: ${accumulatedModifiers.modifierGroups.length} groups`);

            // Make API call to Gemini 2.5 Pro
            debugLogger.apiCallStart(3, batchIndex, 'gemini-2.5-pro', promptTokens);

            const response = await models.pro.generateContent({
              contents: [{
                role: 'user',
                parts: prompt.contents[0].parts
              }],
              generationConfig: {
                temperature: 0.1,
                maxOutputTokens: 10000,
                stopSequences: [],
              }
            });

            const responseTime = Date.now() - startTime;

            // Extract response text
            const responseText = response.response.candidates?.[0]?.content?.parts?.[0]?.text || '';

            console.log(`DEBUG: Phase 3 Sequential Batch ${batchIndex} response text length:`, responseText.length);

            // Track tokens and cost
            const tokenUsage = tokenTracker.recordApiCall(3, 'pro', response);
            debugLogger.apiCallComplete(3, batchIndex, 'gemini-2.5-pro', tokenUsage.input, tokenUsage.output, responseTime, tokenUsage.cost);

            // Parse response
            const enrichmentData = parseEnrichmentResponse(responseText);

            // Map enrichment data back to items
            const enrichedItems: FinalMenuItem[] = batch.map((item, idx) => {
              const id = String(idx + 1);
              const enrichment = enrichmentData.find(e => e.id === id);

              const sizes = enrichment?.sizes || [{
                size: 'N/A',
                price: item.price,
                isDefault: true
              }];

              const modifierGroups = enrichment?.modifierGroups || [];

              return {
                name: item.name,
                description: item.description,
                category: allowedCategories.includes(item.category) ? item.category : 'Open Food',
                section: item.section,
                sizes,
                modifierGroups,
                sourceInfo: item.sourceInfo
              };
            });

            debugLogger.batchComplete(3, batchIndex, enrichedItems.length, responseTime);
            return enrichedItems;

          } catch (error) {
            debugLogger.error(3, 'SEQUENTIAL_BATCH_ENRICHMENT_FAILED', `Batch ${batchIndex}: ${(error as Error).message}`);
            debugLogger.apiCallError(3, batchIndex, 'gemini-2.5-pro', (error as Error).message);

            // Return minimal structured versions
            return batch.map(item => ({
              name: item.name,
              description: item.description,
              category: allowedCategories.includes(item.category) ? item.category : 'Open Food',
              section: item.section,
              sizes: [{
                size: 'N/A',
                price: item.price,
                isDefault: true
              }],
              modifierGroups: [],
              sourceInfo: item.sourceInfo
            }));
          }
        });

        enrichedItems.push(...enrichedBatch);

        // Update accumulated modifiers from this batch's results
        accumulatedModifiers = updateAccumulatedModifiers(accumulatedModifiers, enrichedBatch);

        // Memory management
        debugLogger.logMemoryUsage(`After sequential batch ${batchIndex}`, 3);
      }

      // Log enrichment summary for batch processing
      const sizeCounts = enrichedItems.reduce((acc, item) => acc + item.sizes.length, 0);
      const modifierCounts = enrichedItems.reduce((acc, item) => acc + item.modifierGroups.length, 0);

      debugLogger.success(3, 'BATCH_ENRICHMENT_COMPLETE',
        `${enrichedItems.length} items enriched via batching, ${sizeCounts} sizes, ${modifierCounts} modifier groups`);
    }

    // Validate enrichment quality
    const itemsWithSizes = enrichedItems.filter(item => item.sizes.length > 1);
    const itemsWithModifiers = enrichedItems.filter(item => item.modifierGroups.length > 0);

    debugLogger.debug(3, 'ENRICHMENT_STATS',
      `${itemsWithSizes.length} items have multiple sizes, ${itemsWithModifiers.length} items have modifiers`);

    // Log phase cost
    tokenTracker.logPhaseCost(3, 'Modifier Enrichment');

    debugLogger.endPhase(3, 'Modifier and Size Enrichment Complete', enrichedItems.length);

    return enrichedItems;

  } catch (error) {
    debugLogger.error(3, 'ENRICHMENT_FAILED', (error as Error).message);
    tokenTracker.logPhaseCost(3, 'Modifier Enrichment (Failed)');
    throw error;
  }
}

/**
 * Validate enrichment results
 */
export function validateEnrichment(
  items: FinalMenuItem[]
): { isValid: boolean; warnings: string[] } {
  const warnings: string[] = [];
  let isValid = true;

  // Check if we have any items
  if (items.length === 0) {
    warnings.push('No items after enrichment');
    isValid = false;
    return { isValid, warnings };
  }

  // Check category compliance
  const invalidCategories = items.filter(item => !allowedCategories.includes(item.category));
  if (invalidCategories.length > 0) {
    warnings.push(`${invalidCategories.length} items have invalid categories`);
  }

  // Check size compliance
  const invalidSizes = items.flatMap(item =>
    item.sizes.filter(size => !allowedSizes.includes(size.size))
  );
  if (invalidSizes.length > 0) {
    warnings.push(`${invalidSizes.length} size options use invalid sizes`);
  }

  // Check for items without sizes
  const itemsWithoutSizes = items.filter(item => item.sizes.length === 0);
  if (itemsWithoutSizes.length > 0) {
    warnings.push(`${itemsWithoutSizes.length} items have no size options`);
  }

  // Check enrichment quality
  const enrichedItems = items.filter(item =>
    item.sizes.length > 1 || item.modifierGroups.length > 0
  );
  const enrichmentRate = enrichedItems.length / items.length;

  if (enrichmentRate < 0.1) {
    warnings.push(`Low enrichment rate: only ${Math.round(enrichmentRate * 100)}% of items were enhanced`);
  }

  // Log warnings
  warnings.forEach(warning => debugLogger.warn(3, 'ENRICHMENT_WARNING', warning));

  return { isValid, warnings };
}