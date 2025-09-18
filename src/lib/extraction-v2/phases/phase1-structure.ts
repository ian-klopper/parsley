/**
 * Phase 1: Menu Structure Analysis
 * Uses Gemini 2.5 Flash to analyze menu structure and create table of contents
 */

import { debugLogger } from '../utils/debug-logger';
import { RealTokenTracker } from '../utils/token-tracker';
import { models, estimateTextTokens } from '../models/gemini-models';
import { allowedCategories } from '../types';
import { getFileManager } from '../gemini-file-manager';
import { getCacheManager } from '../cache-manager';
import { globalCacheTracker } from '../utils/cache-tracker';
import type { PreparedDocument, MenuStructure, MenuSection } from '../types';

// System instruction for menu structure analysis (cacheable)
const STRUCTURE_ANALYSIS_SYSTEM_INSTRUCTION = `You are a menu analysis expert. Analyze the menu document(s) and return ONLY a valid JSON response.

TASK: Identify menu sections from the provided document(s).

AVAILABLE CATEGORIES: ${allowedCategories.join(', ')}

RESPONSE FORMAT: Return ONLY this JSON structure (no thinking, no explanation):
{
  "sections": [
    {
      "name": "Appetizers",
      "documentLocations": [
        {
          "documentId": "USE_ACTUAL_DOCUMENT_ID_FROM_REFERENCE_INFO",
          "pageNumbers": [1, 2],
          "sheetNames": ["Menu"]
        }
      ],
      "description": "Starter dishes and small plates",
      "estimatedItems": 15,
      "isSuperBig": false,
      "confidence": 0.95
    }
  ],
  "overallConfidence": 0.9
}

IMPORTANT: Use the exact documentId values from the DOCUMENT REFERENCE INFO provided in the user message, not placeholder values.`;

/**
 * Parse and validate the structure response
 */
function parseStructureResponse(responseText: string): MenuStructure {
  try {
    // Clean response in case it has markdown formatting
    let cleanResponse = responseText.trim();
    if (cleanResponse.startsWith('```json')) {
      cleanResponse = cleanResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleanResponse.startsWith('```')) {
      cleanResponse = cleanResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    const parsed = JSON.parse(cleanResponse);

    // Validate structure
    if (!parsed.sections || !Array.isArray(parsed.sections)) {
      throw new Error('Invalid response: missing or invalid sections array');
    }

    // Validate each section
    for (const section of parsed.sections) {
      if (!section.name || !section.documentLocations || !Array.isArray(section.documentLocations)) {
        throw new Error(`Invalid section: ${JSON.stringify(section)}`);
      }
    }

    // Calculate total estimated items
    const totalEstimatedItems = parsed.sections.reduce(
      (sum: number, section: MenuSection) => sum + (section.estimatedItems || 0),
      0
    );

    return {
      sections: parsed.sections,
      overallConfidence: parsed.overallConfidence || 0.8,
      totalEstimatedItems
    };

  } catch (error) {
    debugLogger.error(1, 'STRUCTURE_PARSE_FAILED', (error as Error).message, { responseText });
    throw new Error(`Failed to parse structure response: ${(error as Error).message}`);
  }
}

/**
 * Main Phase 1: Analyze menu structure using Gemini 2.5 Flash with caching
 */
export async function analyzeMenuStructure(
  documents: PreparedDocument[],
  tokenTracker: RealTokenTracker,
  masterCacheKey?: string
): Promise<MenuStructure> {
  debugLogger.startPhase(1, 'Menu Structure Analysis with Gemini 2.5 Flash + Caching');

  try {
    // Upload all documents first for cost optimization
    debugLogger.debug(1, 'UPLOADING_DOCUMENTS', 'Uploading documents to Gemini for reuse');
    const fileManager = getFileManager();
    const uploadedFiles = await fileManager.uploadAllDocuments(documents);

    // Try to create/use document cache (system prompt is too small for caching)
    const cacheManager = getCacheManager();
    let useCache = false;

    try {
      // For now, skip system prompt caching due to 1024 token minimum
      // Future: combine system instruction with documents for caching
      debugLogger.debug(1, 'CACHE_SKIP_SYSTEM_PROMPT', 'System prompt too small for caching (< 1024 tokens)');
    } catch (error) {
      debugLogger.warn(1, 'CACHE_SETUP_FAILED', `Cache setup failed, proceeding without cache: ${(error as Error).message}`);
    }

    // Create document reference info for the user message
    const documentInfo = documents.map(doc => {
      if (doc.type === 'pdf' && doc.pages) {
        return `Document "${doc.id}" (${doc.name}): PDF with pages ${doc.pages.map(p => p.pageNumber).join(', ')}`;
      } else if (doc.type === 'spreadsheet' && doc.sheets) {
        return `Document "${doc.id}" (${doc.name}): Spreadsheet with sheets ${doc.sheets.map(s => `"${s.name}"`).join(', ')}`;
      } else if (doc.type === 'image') {
        return `Document "${doc.id}" (${doc.name}): Image file`;
      }
      return `Document "${doc.id}" (${doc.name}): ${doc.type}`;
    }).join('\n');

    // Create user message with document references
    const userMessage = `DOCUMENT REFERENCE INFO:
${documentInfo}

Please analyze these menu documents and identify all menu sections.`;

    // Create multimodal content for analysis
    debugLogger.debug(1, 'CREATING_CONTENT', 'Preparing documents for multimodal analysis with cached system prompt');

    const parts: any[] = [];
    parts.push({ text: userMessage });

    // Add file references instead of inline data
    for (const doc of documents) {
      const uploadedFile = uploadedFiles.get(doc.id);
      if (uploadedFile) {
        parts.push({
          fileData: {
            mimeType: uploadedFile.mimeType,
            fileUri: uploadedFile.uri
          }
        });
        debugLogger.debug(1, 'FILE_REFERENCE_ADDED', `Added file reference: ${doc.name} -> ${uploadedFile.uri}`);
      } else {
        debugLogger.warn(1, 'FILE_REFERENCE_MISSING', `No uploaded file found for ${doc.id}`);
      }
    }

    const estimatedTokens = estimateTextTokens(userMessage) + (documents.length * 100); // Much lower token count with file references
    debugLogger.debug(1, 'MULTIMODAL_CONTENT_CREATED', `${parts.length} parts, ~${estimatedTokens} tokens (using cached system prompt)`);

    // Make API call to Gemini 2.5 Flash with cached system instruction
    debugLogger.apiCallStart(1, 1, 'gemini-2.5-flash', estimatedTokens);
    const startTime = Date.now();

    const response = await models.flash.generateContent({
      contents: [{
        role: 'user',
        parts: parts
      }],
      systemInstruction: STRUCTURE_ANALYSIS_SYSTEM_INSTRUCTION,
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 8000,
        stopSequences: [],
      }
    });

    const responseTime = Date.now() - startTime;
    debugLogger.debug(1, 'API_RESPONSE_RECEIVED', `Response received from Gemini 2.5 Flash`);

    // Extract response text from Google AI SDK response format
    const responseText = response.response.candidates?.[0]?.content?.parts?.[0]?.text || '';

    console.log('DEBUG: Extracted response text length:', responseText.length);
    if (responseText.length === 0) {
      console.log('DEBUG: Full response object:', JSON.stringify(response, null, 2));
    }

    // Track real tokens and cost
    const tokenUsage = tokenTracker.recordApiCall(1, 'flash', response);
    debugLogger.apiCallComplete(1, 1, 'gemini-2.5-flash', tokenUsage.input, tokenUsage.output, responseTime, tokenUsage.cost);

    // Parse the structure response
    debugLogger.debug(1, 'PARSING_STRUCTURE', 'Extracting menu structure from response');
    const structure = parseStructureResponse(responseText);

    // ENHANCEMENT: Ensure all spreadsheet documents are included in at least one section
    const enhancedStructure = ensureSpreadsheetCoverage(structure, documents);

    // Log structure analysis results
    const sectionsInfo = enhancedStructure.sections.map(s =>
      `${s.name} (${s.estimatedItems} items, confidence: ${s.confidence})`
    ).join(', ');

    debugLogger.success(1, 'STRUCTURE_ANALYZED',
      `Found ${enhancedStructure.sections.length} sections: ${sectionsInfo}`);

    // Log super big sections
    const superBigSections = enhancedStructure.sections.filter(s => s.isSuperBig);
    if (superBigSections.length > 0) {
      debugLogger.warn(1, 'SUPER_BIG_SECTIONS',
        `${superBigSections.length} sections have >100 items: ${superBigSections.map(s => s.name).join(', ')}`);
    }

    // Cache the structure results for Phase 2 and 3
    await cacheStructureResults(enhancedStructure, masterCacheKey);

    // Log phase cost
    tokenTracker.logPhaseCost(1, 'Structure Analysis');

    debugLogger.endPhase(1, 'Menu Structure Analysis Complete', enhancedStructure.sections.length);

    return enhancedStructure;

  } catch (error) {
    debugLogger.error(1, 'STRUCTURE_ANALYSIS_FAILED', (error as Error).message);
    tokenTracker.logPhaseCost(1, 'Structure Analysis (Failed)');
    throw error;
  }
}

/**
 * Cache structure results for later phases
 */
async function cacheStructureResults(structure: MenuStructure, masterCacheKey?: string): Promise<void> {
  if (!masterCacheKey) {
    debugLogger.debug(1, 'STRUCTURE_CACHE_SKIP', 'No master cache key provided, skipping structure cache');
    return;
  }

  try {
    const cacheManager = getCacheManager();
    const jobId = masterCacheKey.replace('master-', '');

    // Create structure cache with comprehensive structure data
    const structureData = {
      structure: structure,
      timestamp: new Date().toISOString(),
      phase: 1,
      cacheVersion: '1.0'
    };

    const structureText = JSON.stringify(structureData);

    // Skip explicit structure caching - Gemini 2.5 models use implicit caching automatically
    debugLogger.debug(1, 'STRUCTURE_CACHE_SKIP',
      `Using implicit caching for Gemini 2.5 models (${structure.sections.length} sections)`);

  } catch (error) {
    debugLogger.warn(1, 'STRUCTURE_CACHE_FAILED',
      `Could not cache structure: ${(error as Error).message}`);
  }
}

/**
 * Ensure all spreadsheet documents are included in at least one section
 * This prevents spreadsheets from being missed during extraction
 */
function ensureSpreadsheetCoverage(structure: MenuStructure, documents: PreparedDocument[]): MenuStructure {
  const spreadsheetDocs = documents.filter(doc => doc.type === 'spreadsheet');

  if (spreadsheetDocs.length === 0) {
    debugLogger.debug(1, 'NO_SPREADSHEETS', 'No spreadsheet documents to check coverage for');
    return structure;
  }

  console.log(`🔍 SPREADSHEET COVERAGE CHECK: Checking ${spreadsheetDocs.length} spreadsheet documents`);

  // Check which spreadsheets are already covered in sections
  const coveredSpreadsheets = new Set<string>();
  for (const section of structure.sections) {
    for (const location of section.documentLocations) {
      const doc = spreadsheetDocs.find(d => d.id === location.documentId);
      if (doc) {
        coveredSpreadsheets.add(doc.id);
        console.log(`🔍 SPREADSHEET COVERED: "${doc.name}" is covered in section "${section.name}"`);
      }
    }
  }

  // Find uncovered spreadsheets
  const uncoveredSpreadsheets = spreadsheetDocs.filter(doc => !coveredSpreadsheets.has(doc.id));

  if (uncoveredSpreadsheets.length === 0) {
    debugLogger.success(1, 'SPREADSHEET_COVERAGE_COMPLETE', 'All spreadsheet documents are covered in sections');
    return structure;
  }

  // Add uncovered spreadsheets to a fallback section
  console.log(`🔍 SPREADSHEET COVERAGE GAP: ${uncoveredSpreadsheets.length} spreadsheets not covered, adding fallback section`);

  const fallbackSection = {
    name: 'Menu Items',
    documentLocations: uncoveredSpreadsheets.map(doc => ({
      documentId: doc.id,
      sheetNames: doc.sheets?.map(s => s.name) || ['Sheet1']
    })),
    description: 'Menu items from spreadsheet data',
    estimatedItems: uncoveredSpreadsheets.reduce((sum, doc) => {
      return sum + (doc.sheets?.reduce((sheetSum, sheet) => sheetSum + Math.max(1, sheet.rows - 1), 0) || 10);
    }, 0),
    isSuperBig: false,
    confidence: 0.8
  };

  debugLogger.warn(1, 'SPREADSHEET_FALLBACK_SECTION',
    `Created fallback section for ${uncoveredSpreadsheets.length} uncovered spreadsheets`);

  return {
    ...structure,
    sections: [...structure.sections, fallbackSection],
    totalEstimatedItems: structure.totalEstimatedItems + fallbackSection.estimatedItems
  };
}

/**
 * Validate structure quality and provide warnings
 */
export function validateStructure(structure: MenuStructure): { isValid: boolean; warnings: string[] } {
  const warnings: string[] = [];
  let isValid = true;

  // Check if we found any sections
  if (structure.sections.length === 0) {
    warnings.push('No menu sections found - extraction may fail');
    isValid = false;
  }

  // Check confidence levels
  const lowConfidenceSections = structure.sections.filter(s => s.confidence < 0.5);
  if (lowConfidenceSections.length > 0) {
    warnings.push(`${lowConfidenceSections.length} sections have low confidence`);
  }

  // Check for very large sections
  const hugeSections = structure.sections.filter(s => s.estimatedItems > 500);
  if (hugeSections.length > 0) {
    warnings.push(`${hugeSections.length} sections are extremely large (>500 items)`);
  }

  // Check overall confidence
  if (structure.overallConfidence < 0.6) {
    warnings.push('Overall structure confidence is low');
  }

  // Check total estimated items
  if (structure.totalEstimatedItems > 2000) {
    warnings.push(`Very large menu (${structure.totalEstimatedItems} estimated items)`);
  }

  // Log warnings
  if (warnings.length > 0) {
    warnings.forEach(warning => debugLogger.warn(1, 'STRUCTURE_WARNING', warning));
  }

  return { isValid, warnings };
}