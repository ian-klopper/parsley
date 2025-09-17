/**
 * Phase 1: Menu Structure Analysis
 * Uses Gemini 2.5 Flash to analyze menu structure and create table of contents
 */

import { debugLogger } from '../utils/debug-logger';
import { RealTokenTracker } from '../utils/token-tracker';
import { models, estimateTextTokens } from '../models/gemini-models';
import { allowedCategories } from '../types';
import type { PreparedDocument, MenuStructure, MenuSection } from '../types';


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
 * Main Phase 1: Analyze menu structure using Gemini 2.5 Flash
 */
export async function analyzeMenuStructure(
  documents: PreparedDocument[],
  tokenTracker: RealTokenTracker
): Promise<MenuStructure> {
  debugLogger.startPhase(1, 'Menu Structure Analysis with Gemini 2.5 Flash');

  try {
    // Create multimodal content for analysis
    debugLogger.debug(1, 'CREATING_CONTENT', 'Preparing documents for multimodal analysis');

    const parts: any[] = [];

    // Create document reference info for the prompt
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

    // Add the instruction prompt first
    const promptText = `SYSTEM: You are a menu analysis expert. Analyze the menu document(s) and return ONLY a valid JSON response.

TASK: Identify menu sections from these document(s).

DOCUMENT REFERENCE INFO:
${documentInfo}

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

IMPORTANT: Use the exact documentId values from the DOCUMENT REFERENCE INFO above, not placeholder values.`;

    parts.push({ text: promptText });

    // Add actual document content (images, text, etc.)
    for (const doc of documents) {
      if (doc.type === 'image') {
        // For images, send the actual base64 image data
        parts.push({
          inlineData: {
            mimeType: 'image/jpeg',
            data: doc.content  // This should be the base64 image data
          }
        });
        debugLogger.debug(1, 'IMAGE_ADDED', `Added image: ${doc.name}`);
      } else if (doc.type === 'pdf' && doc.pages) {
        // For PDFs, add text content from pages
        for (const page of doc.pages.slice(0, 3)) { // First 3 pages
          if (!page.isImage && page.content) {
            const preview = page.content.substring(0, 500);
            parts.push({ text: `\nPDF ${doc.name} Page ${page.pageNumber}:\n${preview}\n` });
          }
        }
        debugLogger.debug(1, 'PDF_PAGES_ADDED', `Added ${Math.min(3, doc.pages.length)} pages from ${doc.name}`);
      } else if (doc.type === 'spreadsheet' && doc.sheets) {
        // For spreadsheets, add sheet content
        for (const sheet of doc.sheets.slice(0, 2)) { // First 2 sheets
          const preview = sheet.content.split('\n').slice(0, 5).join('\n');
          parts.push({ text: `\nSpreadsheet ${doc.name} Sheet "${sheet.name}":\n${preview}\n` });
        }
        debugLogger.debug(1, 'SPREADSHEET_SHEETS_ADDED', `Added ${Math.min(2, doc.sheets.length)} sheets from ${doc.name}`);
      }
    }

    const estimatedTokens = estimateTextTokens(promptText) + (documents.filter(d => d.type === 'image').length * 1000);
    debugLogger.debug(1, 'MULTIMODAL_CONTENT_CREATED', `${parts.length} parts, ~${estimatedTokens} tokens`);

    // Make API call to Gemini 2.5 Flash with multimodal content
    debugLogger.apiCallStart(1, 1, 'gemini-2.5-flash', estimatedTokens);
    const startTime = Date.now();

    const response = await models.flash.generateContent({
      contents: [{
        role: 'user',
        parts: parts
      }],
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

    // Log structure analysis results
    const sectionsInfo = structure.sections.map(s =>
      `${s.name} (${s.estimatedItems} items, confidence: ${s.confidence})`
    ).join(', ');

    debugLogger.success(1, 'STRUCTURE_ANALYZED',
      `Found ${structure.sections.length} sections: ${sectionsInfo}`);

    // Log super big sections
    const superBigSections = structure.sections.filter(s => s.isSuperBig);
    if (superBigSections.length > 0) {
      debugLogger.warn(1, 'SUPER_BIG_SECTIONS',
        `${superBigSections.length} sections have >100 items: ${superBigSections.map(s => s.name).join(', ')}`);
    }

    // Log phase cost
    tokenTracker.logPhaseCost(1, 'Structure Analysis');

    debugLogger.endPhase(1, 'Menu Structure Analysis Complete', structure.sections.length);

    return structure;

  } catch (error) {
    debugLogger.error(1, 'STRUCTURE_ANALYSIS_FAILED', (error as Error).message);
    tokenTracker.logPhaseCost(1, 'Structure Analysis (Failed)');
    throw error;
  }
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