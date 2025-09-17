/**
 * Phase 3: Modifier and Size Enrichment
 * Uses Gemini Pro to structure modifiers and sizes from raw menu items
 */

import { debugLogger } from '../utils/debug-logger';
import { RealTokenTracker } from '../utils/token-tracker';
import { models, estimateTextTokens } from '../models/gemini-models';
import { allowedCategories, allowedSizes } from '../types';
import type {
  PreparedDocument,
  RawMenuItem,
  FinalMenuItem,
  SizeOption,
  ModifierGroup
} from '../types';

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

  for (const docId of referencedDocIds) {
    const doc = documents.find(d => d.id === docId);
    if (!doc) continue;

    let docContext = `\n--- ${doc.name} ---\n`;

    if (doc.type === 'pdf' && doc.pages) {
      // Include relevant pages
      const referencedPages = new Set(
        itemBatch
          .filter(item => item.sourceInfo.documentId === docId && item.sourceInfo.page)
          .map(item => item.sourceInfo.page!)
      );

      for (const page of doc.pages) {
        if (referencedPages.size === 0 || referencedPages.has(page.pageNumber)) {
          if (!page.isImage && page.content) {
            // Include a sample of the text content
            const sample = page.content.substring(0, 500);
            docContext += `Page ${page.pageNumber}: ${sample}...\n`;
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
 * Create enrichment prompt for structuring items
 */
function createEnrichmentPrompt(itemBatch: RawMenuItem[], context: string): string {
  return `You are an expert menu consultant. Perfect these raw menu items by structuring sizes and modifiers.

PREDEFINED CATEGORIES (use exact names):
${allowedCategories.join(', ')}

PREDEFINED SIZES (use exact names):
${allowedSizes.join(', ')}

TASKS:
1. Fix categories - use only predefined categories
2. Find size options mentioned in descriptions and structure them
3. Find modifier groups (toppings, sides, add-ons) and structure them
4. Check original context for general rules about sizes/modifiers
5. Ensure consistent naming and remove duplicates
6. Connect modifiers to appropriate items

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

Raw menu items to structure:
${JSON.stringify(itemBatch, null, 2)}

Original document context:
${context}

Return ONLY a JSON array with this exact structure:
[
  {
    "name": "Caesar Salad",
    "description": "Romaine lettuce, parmesan, croutons, caesar dressing",
    "category": "Appetizers",
    "section": "Appetizers",
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
    ],
    "sourceInfo": {
      "documentId": "doc1",
      "page": 1,
      "sheet": "Menu"
    }
  }
]`;
}

/**
 * Parse and validate enrichment response
 */
function parseEnrichmentResponse(responseText: string): FinalMenuItem[] {
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

    // Validate and clean each item
    const items: FinalMenuItem[] = parsed.map((item: any, index: number) => {
      if (!item.name || typeof item.name !== 'string') {
        throw new Error(`Item ${index} missing or invalid name`);
      }

      // Validate category
      if (!allowedCategories.includes(item.category)) {
        debugLogger.warn(3, 'INVALID_CATEGORY_FIXED',
          `Item "${item.name}" had invalid category "${item.category}", using "Open Food"`);
        item.category = 'Open Food';
      }

      // Validate and clean sizes
      const sizes: SizeOption[] = (item.sizes || []).map((size: any) => {
        let sizeValue = size.size || 'N/A';

        // Check if size is in allowed list
        if (!allowedSizes.includes(sizeValue)) {
          debugLogger.warn(3, 'INVALID_SIZE_FIXED',
            `Item "${item.name}" had invalid size "${sizeValue}", using "N/A"`);
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

      return {
        name: item.name.trim(),
        description: (item.description || '').trim(),
        category: item.category,
        section: item.section || 'General',
        sizes,
        modifierGroups,
        sourceInfo: item.sourceInfo || { documentId: 'unknown' }
      };
    });

    return items;

  } catch (error) {
    debugLogger.error(3, 'ENRICHMENT_PARSE_FAILED', (error as Error).message, { responseText });
    throw new Error(`Failed to parse enrichment response: ${(error as Error).message}`);
  }
}

/**
 * Process a single enrichment batch
 */
async function processEnrichmentBatch(
  itemBatch: RawMenuItem[],
  documents: PreparedDocument[],
  tokenTracker: RealTokenTracker,
  batchIndex: number,
  totalBatches: number
): Promise<FinalMenuItem[]> {
  debugLogger.batchStart(3, batchIndex, totalBatches, 0, 'gemini-2.5-pro');

  try {
    // Find relevant context
    const context = findRelevantContext(itemBatch, documents);
    const prompt = createEnrichmentPrompt(itemBatch, context);
    const promptTokens = estimateTextTokens(prompt);

    // Make API call to Gemini 2.5 Pro with thinking disabled
    debugLogger.apiCallStart(3, batchIndex, 'gemini-2.5-pro', promptTokens);
    const startTime = Date.now();

    const response = await models.pro.generateContent({
      contents: [{
        role: 'user',
        parts: [{ text: prompt }]
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

    console.log(`DEBUG: Phase 3 Batch ${batchIndex} response text length:`, responseText.length);
    if (responseText.length === 0) {
      console.log(`DEBUG: Phase 3 Batch ${batchIndex} full response:`, JSON.stringify(response, null, 2));
    }

    // Track real tokens and cost
    const tokenUsage = tokenTracker.recordApiCall(3, 'pro', response);
    debugLogger.apiCallComplete(3, batchIndex, 'gemini-2.5-pro', tokenUsage.input, tokenUsage.output, responseTime, tokenUsage.cost);

    // Parse response
    const enrichedItems = parseEnrichmentResponse(responseText);
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
 */
export async function enrichMenuItems(
  rawItems: RawMenuItem[],
  documents: PreparedDocument[],
  tokenTracker: RealTokenTracker
): Promise<FinalMenuItem[]> {
  debugLogger.startPhase(3, 'Modifier and Size Enrichment with Gemini Pro');

  if (rawItems.length === 0) {
    debugLogger.warn(3, 'NO_ITEMS_TO_ENRICH', 'No raw items provided for enrichment');
    debugLogger.endPhase(3, 'Enrichment Skipped', 0);
    return [];
  }

  const enrichedItems: FinalMenuItem[] = [];

  try {
    // Create batches for Pro processing
    const batches = createEnrichmentBatches(rawItems, 30);

    debugLogger.debug(3, 'ENRICHMENT_START',
      `Processing ${rawItems.length} items in ${batches.length} batches`);

    // Process each batch
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const batchIndex = i + 1;

      debugLogger.debug(3, 'BATCH_PROCESSING',
        `Batch ${batchIndex}/${batches.length}: ${batch.length} items`);

      const batchResults = await processEnrichmentBatch(
        batch,
        documents,
        tokenTracker,
        batchIndex,
        batches.length
      );

      enrichedItems.push(...batchResults);

      // Memory management
      debugLogger.logMemoryUsage(`After enrichment batch ${batchIndex}`, 3);

      // Rate limiting pause between Pro model calls
      if (i < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second pause
      }
    }

    // Log enrichment summary
    const sizeCounts = enrichedItems.reduce((acc, item) => acc + item.sizes.length, 0);
    const modifierCounts = enrichedItems.reduce((acc, item) => acc + item.modifierGroups.length, 0);

    debugLogger.success(3, 'ENRICHMENT_COMPLETE',
      `${enrichedItems.length} items enriched, ${sizeCounts} sizes, ${modifierCounts} modifier groups`);

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