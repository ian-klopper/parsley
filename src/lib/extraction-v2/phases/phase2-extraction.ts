/**
 * Phase 2: Item Extraction
 * Uses Flash models with dynamic batching to extract menu items from each section
 */

import { debugLogger } from '../utils/debug-logger';
import { RealTokenTracker } from '../utils/token-tracker';
import { models, estimateTextTokens, estimateImageTokens } from '../models/gemini-models';
import { allowedCategories, allowedSizes } from '../types';
import type {
  PreparedDocument,
  MenuStructure,
  MenuSection,
  ExtractionBatch,
  RawMenuItem,
  DocumentLocation
} from '../types';

/**
 * Create extraction batches based on section size and content type
 */
function createExtractionBatches(
  section: MenuSection,
  documents: PreparedDocument[]
): ExtractionBatch[] {
  const batches: ExtractionBatch[] = [];
  let batchIndex = 0;

  // Dynamic batching based on section size
  const maxTokensPerBatch = section.isSuperBig ? 2000 : // Large sections get smaller batches
                           section.estimatedItems > 50 ? 4000 : // Medium sections
                           8000; // Small sections can use larger batches

  debugLogger.debug(2, 'BATCH_STRATEGY',
    `Section "${section.name}": ${section.estimatedItems} items, ${maxTokensPerBatch} tokens per batch`);

  for (const location of section.documentLocations) {
    const doc = documents.find(d => d.id === location.documentId);
    if (!doc) {
      debugLogger.warn(2, 'DOCUMENT_NOT_FOUND', `Document ${location.documentId} for section ${section.name}`);
      continue;
    }

    if (doc.type === 'pdf' && doc.pages) {
      // Process specific pages or all pages
      const targetPages = location.pageNumbers || doc.pages.filter(p => p.pageNumber > 0).map(p => p.pageNumber);
      
      // Track if we've already processed this page to avoid duplicates
      const processedPages = new Set<number>();
      
      // First try text-based pages if available
      const textPages = doc.pages.filter(p => !p.isImage && p.hasContent && targetPages.includes(p.pageNumber));
      
      for (const page of textPages) {
        if (processedPages.has(page.pageNumber)) continue;
        processedPages.add(page.pageNumber);

        // Debug: Check page content before batch creation
        console.log(`🔍 DEBUG: Page content before batch creation:`);
        console.log(`  Page ${page.pageNumber} content length: ${page.content?.length}`);
        console.log(`  Page content preview: ${JSON.stringify(page.content?.substring(0, 100))}`);
        console.log(`  Full page content: ${JSON.stringify(page.content)}`);

        // Clean and format the content for better AI parsing
        const cleanContent = page.content
          .split('\n')
          .filter(line => line.trim().length > 0)
          .join('\n')
          .trim();

        console.log(`🔍 DEBUG: Cleaned content:`, JSON.stringify(cleanContent));

        // Determine model based on content size
        const model = page.tokens > 4000 ? 'flashLite' : 'flash';

        batches.push({
          id: `batch_${++batchIndex}`,
          phase: 2,
          section,
          content: cleanContent,
          isImage: false,
          tokens: page.tokens,
          model,
          sourceRefs: [{
            documentId: doc.id,
            pageNumbers: [page.pageNumber]
          }]
        });
      }
      
      // If we have no successful text pages or explicit image-only pages, use image fallbacks
      const remainingPages = targetPages.filter(pageNum => !processedPages.has(pageNum));
      const imagePages = doc.pages.filter(p => p.isImage && p.hasContent && 
        (remainingPages.includes(p.pageNumber) || p.isFallback));
      
      for (const page of imagePages) {
        if (page.isFallback && processedPages.has(page.pageNumber)) continue; // Skip fallbacks for already processed pages
        
        const pageNum = page.pageNumber === 0 && page.isFallback ? 
          1 : page.pageNumber; // Use page 1 for fallback images
          
        if (processedPages.has(pageNum)) continue;
        processedPages.add(pageNum);

        batches.push({
          id: `batch_${++batchIndex}`,
          phase: 2,
          section,
          content: page.content,
          isImage: true,
          contentType: 'application/pdf', // Image-based PDF pages
          tokens: page.tokens,
          model: 'flashLite', // Always use Flash-Lite for images
          sourceRefs: [{
            documentId: doc.id,
            pageNumbers: [pageNum]
          }]
        });
      }
      
      // Log diagnostic info for this section
      const batchCount = batches.length - batchIndex + processedPages.size;
      if (batchCount === 0) {
        debugLogger.warn(2, 'NO_PDF_BATCHES',
          `Could not create any batches for section "${section.name}" from PDF "${doc.name}"`);
      } else {
        debugLogger.debug(2, 'PDF_PROCESSING',
          `Created ${batchCount} batches for section "${section.name}" from PDF "${doc.name}"`);
      }

    } else if (doc.type === 'spreadsheet' && doc.sheets) {
      // Process specific sheets or all sheets
      const targetSheets = location.sheetNames || doc.sheets.map(s => s.name);

      for (const sheetName of targetSheets) {
        const sheet = doc.sheets.find(s => s.name === sheetName);
        if (!sheet || !sheet.hasContent) continue;

        // For large sheets, consider splitting into row groups
        if (sheet.tokens > maxTokensPerBatch && sheet.rows > 50) {
          debugLogger.debug(2, 'SPLITTING_LARGE_SHEET',
            `Sheet "${sheetName}": ${sheet.rows} rows, ${sheet.tokens} tokens`);

          // Split into row groups (roughly 1/3 of sheet per batch)
          const rowsPerBatch = Math.ceil(sheet.rows / 3);
          const lines = sheet.content.split('\n');

          for (let i = 0; i < lines.length; i += rowsPerBatch) {
            const batchContent = lines.slice(i, i + rowsPerBatch).join('\n');
            const batchTokens = estimateTextTokens(batchContent);

            if (batchContent.trim()) {
              batches.push({
                id: `batch_${++batchIndex}`,
                phase: 2,
                section,
                content: batchContent,
                isImage: false,
                tokens: batchTokens,
                model: batchTokens > 4000 ? 'flashLite' : 'flash',
                sourceRefs: [{
                  documentId: doc.id,
                  sheetNames: [`${sheetName}_rows_${i + 1}-${i + rowsPerBatch}`]
                }]
              });
            }
          }
        } else {
          // Process entire sheet
          const model = sheet.tokens > 4000 ? 'flashLite' : 'flash';

          batches.push({
            id: `batch_${++batchIndex}`,
            phase: 2,
            section,
            content: sheet.content,
            isImage: false,
            tokens: sheet.tokens,
            model,
            sourceRefs: [{
              documentId: doc.id,
              sheetNames: [sheetName]
            }]
          });
        }
      }

    } else if (doc.type === 'image' && doc.content) {
      // Process image
      batches.push({
        id: `batch_${++batchIndex}`,
        phase: 2,
        section,
        content: doc.content,
        isImage: true,
        contentType: 'image/jpeg', // JPEG images
        tokens: estimateImageTokens(),
        model: 'flashLite', // Images always use Flash-Lite
        sourceRefs: [{
          documentId: doc.id
        }]
      });
    }
  }

  debugLogger.debug(2, 'BATCHES_CREATED',
    `Section "${section.name}": ${batches.length} batches, models: ${[...new Set(batches.map(b => b.model))].join(', ')}`);

  return batches;
}

/**
 * Create extraction prompt for a specific section
 */
function createExtractionPrompt(batch: ExtractionBatch, allSections: string[]): string {
  const sectionContext = allSections.length > 1 ?
    `This menu has these sections: ${allSections.join(', ')}.\n` : '';

  return `You are an expert menu manager extracting items from the "${batch.section.name}" section.

${sectionContext}
TASK: Extract ONLY menu items that belong to the "${batch.section.name}" section.

PREDEFINED CATEGORIES (use exact names):
${allowedCategories.join(', ')}

PREDEFINED SIZES (use exact names):
${allowedSizes.join(', ')}

EXTRACTION RULES:
1. Extract item name, description, price, and category
2. Use only predefined categories - choose the best match
3. If size is mentioned in the item text, include it in description
4. Include any modifier/add-on text in the description
5. Set price to "0" if no price is visible
6. Ignore section headers and non-item text
7. Do NOT create separate size or modifier fields yet

IMPORTANT: Only extract items that clearly belong to "${batch.section.name}".

${batch.isImage ? 'Analyze this menu image:' : 'Menu content:'}

Return ONLY a JSON array in this exact format:
[
  {
    "name": "Caesar Salad",
    "description": "Romaine lettuce, parmesan, croutons, caesar dressing. Available in small or large.",
    "price": "12.99",
    "category": "Appetizers"
  }
]`;
}

/**
 * Parse and validate extraction response
 */
function parseExtractionResponse(responseText: string, batch: ExtractionBatch): RawMenuItem[] {
  try {
    // Clean response
    let cleanResponse = responseText.trim();
    if (cleanResponse.startsWith('```json')) {
      cleanResponse = cleanResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleanResponse.startsWith('```')) {
      cleanResponse = cleanResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    const parsed = JSON.parse(cleanResponse);

    if (!Array.isArray(parsed)) {
      throw new Error('Response is not an array');
    }

    // Convert to RawMenuItem format with source info
    const items: RawMenuItem[] = parsed.map((item: any, index: number) => {
      if (!item.name || typeof item.name !== 'string') {
        throw new Error(`Item ${index} missing or invalid name`);
      }

      // Get first source reference
      const sourceRef = batch.sourceRefs[0];

      return {
        name: item.name.trim(),
        description: (item.description || '').trim(),
        price: (item.price || '0').toString(),
        category: item.category || batch.section.name,
        section: batch.section.name,
        sourceInfo: {
          documentId: sourceRef.documentId,
          page: sourceRef.pageNumbers?.[0],
          sheet: sourceRef.sheetNames?.[0]
        }
      };
    });

    // Validate categories
    const invalidCategories = items.filter(item => !allowedCategories.includes(item.category));
    if (invalidCategories.length > 0) {
      debugLogger.warn(2, 'INVALID_CATEGORIES',
        `${invalidCategories.length} items have invalid categories: ${invalidCategories.map(i => i.category).join(', ')}`);
    }

    return items;

  } catch (error) {
    debugLogger.error(2, 'EXTRACTION_PARSE_FAILED', (error as Error).message, { responseText, batchId: batch.id });
    throw new Error(`Failed to parse extraction response: ${(error as Error).message}`);
  }
}

/**
 * Process a single extraction batch
 */
async function processExtractionBatch(
  batch: ExtractionBatch,
  allSections: string[],
  tokenTracker: RealTokenTracker,
  callIndex: number
): Promise<RawMenuItem[]> {
  debugLogger.batchStart(2, callIndex, 0, batch.tokens, batch.model);

  try {
    // Debug: Log what Phase 2 AI will actually see
    console.log(`🔍 PHASE 2 BATCH ${batch.id} CONTENT DEBUG:`);
    if (batch.isImage) {
      console.log(`  ${batch.contentType || 'image'} batch for section "${batch.section.name}" (${batch.content?.length || 0} bytes base64)`);
    } else {
      console.log(`  Text batch for section "${batch.section.name}":`);
      const contentPreview = batch.content.substring(0, 300);
      console.log(`  Content preview: ${contentPreview}${batch.content.length > 300 ? '...' : ''}`);
      console.log(`  Total content length: ${batch.content.length} characters`);
    }

    // Create prompt
    const prompt = createExtractionPrompt(batch, allSections);

    // Make API call with direct Google AI SDK
    debugLogger.apiCallStart(2, callIndex, batch.model, batch.tokens);
    const startTime = Date.now();

    const modelInstance = models[batch.model];
    const response = await modelInstance.generateContent({
      contents: [{
        role: 'user',
        parts: batch.isImage ? [
          {
            inlineData: {
              mimeType: batch.contentType || 'image/jpeg', // Use correct MIME type for content
              data: batch.content
            }
          },
          { text: prompt }
        ] : [{ text: prompt + '\n\nContent to extract from:\n' + batch.content }]
      }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 8000,
        stopSequences: [],
      }
    });

    const responseTime = Date.now() - startTime;

    // Extract response text from Google AI SDK response format
    const responseText = response.response.candidates?.[0]?.content?.parts?.[0]?.text || '';

    console.log(`DEBUG: Phase 2 Call ${callIndex} response text length:`, responseText.length);
    if (responseText.length === 0) {
      console.log(`DEBUG: Phase 2 Call ${callIndex} full response:`, JSON.stringify(response, null, 2));
    }

    // Track real tokens and cost
    const tokenUsage = tokenTracker.recordApiCall(2, batch.model, response, batch.isImage ? 1 : 0);
    debugLogger.apiCallComplete(2, callIndex, batch.model, tokenUsage.input, tokenUsage.output, responseTime, tokenUsage.cost);

    // Parse response
    const items = parseExtractionResponse(responseText, batch);
    debugLogger.batchComplete(2, callIndex, items.length, responseTime);

    return items;

  } catch (error) {
    debugLogger.error(2, 'BATCH_EXTRACTION_FAILED', `Batch ${batch.id}: ${(error as Error).message}`);
    debugLogger.apiCallError(2, callIndex, batch.model, (error as Error).message);
    return []; // Return empty array to continue with other batches
  }
}

/**
 * Main Phase 2: Extract menu items using Flash models
 */
export async function extractMenuItems(
  structure: MenuStructure,
  documents: PreparedDocument[],
  tokenTracker: RealTokenTracker
): Promise<RawMenuItem[]> {
  debugLogger.startPhase(2, 'Item Extraction with Flash Models');

  const allItems: RawMenuItem[] = [];
  const allSectionNames = structure.sections.map(s => s.name);
  let totalBatches = 0;
  let callIndex = 0;

  try {
    // Process each section
    for (let sectionIndex = 0; sectionIndex < structure.sections.length; sectionIndex++) {
      const section = structure.sections[sectionIndex];

      debugLogger.debug(2, 'SECTION_START',
        `Processing section ${sectionIndex + 1}/${structure.sections.length}: "${section.name}"`);

      // Create batches for this section
      const batches = createExtractionBatches(section, documents);
      totalBatches += batches.length;

      if (batches.length === 0) {
        debugLogger.warn(2, 'NO_BATCHES_CREATED', `Section "${section.name}" has no extractable content`);
        continue;
      }

      // Process batches for this section
      const sectionItems: RawMenuItem[] = [];

      for (const batch of batches) {
        callIndex++;
        const batchItems = await processExtractionBatch(batch, allSectionNames, tokenTracker, callIndex);
        sectionItems.push(...batchItems);

        // Memory management
        debugLogger.logMemoryUsage(`After batch ${callIndex}`, 2);
      }

      // Log section completion
      debugLogger.success(2, 'SECTION_COMPLETE',
        `"${section.name}": ${sectionItems.length} items from ${batches.length} batches`);

      allItems.push(...sectionItems);

      // Force garbage collection for large sections
      if (sectionItems.length > 100 && global.gc) {
        global.gc();
      }
    }

    // Log extraction summary
    const itemsBySection = structure.sections.map(section => {
      const count = allItems.filter(item => item.section === section.name).length;
      return `${section.name}: ${count}`;
    }).join(', ');

    debugLogger.success(2, 'EXTRACTION_COMPLETE',
      `${allItems.length} items extracted. ${itemsBySection}`);

    // Validate extraction quality
    const sectionsWithNoItems = structure.sections.filter(section =>
      !allItems.some(item => item.section === section.name)
    );

    if (sectionsWithNoItems.length > 0) {
      debugLogger.warn(2, 'SECTIONS_NO_ITEMS',
        `${sectionsWithNoItems.length} sections had no items: ${sectionsWithNoItems.map(s => s.name).join(', ')}`);
    }

    // Log phase cost
    tokenTracker.logPhaseCost(2, 'Item Extraction');

    debugLogger.endPhase(2, 'Item Extraction Complete', allItems.length);

    return allItems;

  } catch (error) {
    debugLogger.error(2, 'EXTRACTION_FAILED', (error as Error).message);
    tokenTracker.logPhaseCost(2, 'Item Extraction (Failed)');
    throw error;
  }
}

/**
 * Validate extraction results
 */
export function validateExtraction(
  items: RawMenuItem[],
  structure: MenuStructure
): { isValid: boolean; warnings: string[] } {
  const warnings: string[] = [];
  let isValid = true;

  // Check if we extracted any items
  if (items.length === 0) {
    warnings.push('No items extracted from any section');
    isValid = false;
  }

  // Check extraction rate vs estimates
  const totalEstimated = structure.totalEstimatedItems;
  const extractionRate = totalEstimated > 0 ? items.length / totalEstimated : 0;

  if (extractionRate < 0.3) {
    warnings.push(`Low extraction rate: ${Math.round(extractionRate * 100)}% of estimated items`);
  }

  // Check for sections with no items
  const sectionsWithItems = new Set(items.map(item => item.section));
  const missingSections = structure.sections.filter(s => !sectionsWithItems.has(s.name));

  if (missingSections.length > 0) {
    warnings.push(`${missingSections.length} sections had no items extracted`);
  }

  // Check price parsing
  const itemsWithoutPrices = items.filter(item => !item.price || item.price === '0');
  if (itemsWithoutPrices.length > items.length * 0.5) {
    warnings.push(`${Math.round((itemsWithoutPrices.length / items.length) * 100)}% of items have no price`);
  }

  // Log warnings
  warnings.forEach(warning => debugLogger.warn(2, 'EXTRACTION_WARNING', warning));

  return { isValid, warnings };
}