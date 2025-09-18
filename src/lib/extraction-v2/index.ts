/**
 * 3-Phase Menu Extraction Pipeline - Main Orchestrator
 * Coordinates all phases and provides comprehensive debug output
 */

// Load environment variables for API keys
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { debugLogger } from './utils/debug-logger';
import { RealTokenTracker } from './utils/token-tracker';
import { prepareDocuments } from './phases/phase0-preparation';
import { analyzeMenuStructure, validateStructure } from './phases/phase1-structure';
import { extractMenuItems, validateExtraction } from './phases/phase2-extraction';
import { enrichMenuItems, validateEnrichment } from './phases/phase3-enrichment';
import { estimateTextTokens } from './models/gemini-models';
import { initializeFileManager } from './gemini-file-manager';
import { initializeCacheManager } from './cache-manager';
import { globalCacheTracker } from './utils/cache-tracker';
import type { DocumentMeta, ExtractionResult } from './types';

/**
 * Estimate total extraction cost before starting
 */
function estimateExtractionCost(documents: DocumentMeta[]): number {
  // Rough estimates based on document types and sizes
  const imageCount = documents.filter(doc => doc.type.startsWith('image/')).length;
  const pdfCount = documents.filter(doc => doc.type === 'application/pdf').length;
  const spreadsheetCount = documents.filter(doc => doc.type.includes('spreadsheet')).length;

  // Estimate based on document complexity
  const baseEstimate = (
    imageCount * 0.005 +      // $0.005 per image
    pdfCount * 0.01 +         // $0.01 per PDF
    spreadsheetCount * 0.008  // $0.008 per spreadsheet
  );

  // Add phase multipliers
  const phase1Cost = baseEstimate * 0.3;  // Structure analysis
  const phase2Cost = baseEstimate * 1.5;  // Item extraction (largest phase)
  const phase3Cost = baseEstimate * 0.4;  // Enrichment

  return phase1Cost + phase2Cost + phase3Cost;
}

/**
 * Main 3-Phase Extraction Function
 */
export async function extractMenu(documents: DocumentMeta[]): Promise<ExtractionResult> {
  const startTime = Date.now();
  const tokenTracker = new RealTokenTracker();

  // Initialize file manager and cache manager for cost optimization - only when needed
  let initialized = false;
  const initializeOnDemand = () => {
    if (initialized) return;
    
    const geminiApiKey = process.env.GOOGLE_AI_API_KEY;
    if (!geminiApiKey) {
      throw new Error('GOOGLE_AI_API_KEY environment variable is required for file uploads');
    }
    initializeFileManager(geminiApiKey);
    initializeCacheManager(geminiApiKey);
    initialized = true;
  };

  // Clear previous logs and start fresh
  debugLogger.clearLogs();

  try {
    // Initialize API clients when actually needed
    initializeOnDemand();
    
    // Pre-extraction setup
    const estimatedCost = estimateExtractionCost(documents);
    debugLogger.extractionStart(documents.length, estimatedCost);
    debugLogger.logMemoryUsage('Extraction start');

    // Phase 0: Document Preparation & Master Cache Setup
    debugLogger.debug(0, 'EXTRACTION_PIPELINE_START', '3-Phase Menu Extraction Pipeline with Master Caching');
    const { prepared: preparedDocuments, masterCacheKey } = await prepareDocuments(documents);

    if (preparedDocuments.length === 0) {
      throw new Error('No documents could be prepared for extraction');
    }

    debugLogger.debug(0, 'MASTER_CACHE_READY', `Master cache initialized: ${masterCacheKey}`);

    // Phase 1: Menu Structure Analysis (Gemini Pro)
    const structure = await analyzeMenuStructure(preparedDocuments, tokenTracker, masterCacheKey);
    const structureValidation = validateStructure(structure);

    if (!structureValidation.isValid) {
      debugLogger.warn(1, 'STRUCTURE_VALIDATION_FAILED', 'Continuing with potentially poor structure');
    }

    // Phase 2: Item Extraction (Flash Models)
    const rawItems = await extractMenuItems(structure, preparedDocuments, tokenTracker, masterCacheKey);
    const extractionValidation = validateExtraction(rawItems, structure);

    if (!extractionValidation.isValid) {
      debugLogger.warn(2, 'EXTRACTION_VALIDATION_FAILED', 'Low extraction quality detected');
    }

    // Phase 3: Modifier and Size Enrichment (Gemini Pro)
    const finalItems = await enrichMenuItems(rawItems, preparedDocuments, tokenTracker, masterCacheKey);
    const enrichmentValidation = validateEnrichment(finalItems);

    if (!enrichmentValidation.isValid) {
      debugLogger.warn(3, 'ENRICHMENT_VALIDATION_FAILED', 'Low enrichment quality detected');
    }

    // Final processing and validation
    const processingTime = Date.now() - startTime;
    const costs = tokenTracker.getDetailedCosts();

    // Validate that we have real costs (not estimates)
    if (!tokenTracker.validateRealCosts()) {
      debugLogger.error(0, 'COST_VALIDATION_FAILED', 'Some API calls may have missing token data');
    }

    // Final summary
    debugLogger.extractionComplete(
      costs.total,
      finalItems.length,
      documents.length,
      processingTime,
      {
        phase1: costs.phase1.cost,
        phase2: costs.phase2.cost,
        phase3: costs.phase3.cost
      }
    );

    debugLogger.logMemoryUsage('Extraction complete');

    // Log detailed cost breakdown
    console.log('\n=== DETAILED COST BREAKDOWN ===');
    console.log(`Phase 1 (Structure): ${costs.phase1.calls} calls, ${costs.phase1.tokens.input}/${costs.phase1.tokens.output} tokens, $${costs.phase1.cost.toFixed(6)}`);
    console.log(`Phase 2 (Extract):   ${costs.phase2.calls} calls, ${costs.phase2.tokens.input}/${costs.phase2.tokens.output} tokens, $${costs.phase2.cost.toFixed(6)}`);
    console.log(`Phase 3 (Enrich):    ${costs.phase3.calls} calls, ${costs.phase3.tokens.input}/${costs.phase3.tokens.output} tokens, $${costs.phase3.cost.toFixed(6)}`);
    console.log(`TOTAL:               ${costs.totalCalls} calls, ${costs.totalTokens.input}/${costs.totalTokens.output} tokens, $${costs.total.toFixed(6)}`);
    console.log(`Cost per item:       $${tokenTracker.getCostPerItem(finalItems.length).toFixed(6)}`);
    console.log('===============================\n');

    // Print cache performance report
    globalCacheTracker.printReport();

    // FINAL VALIDATION: Ensure mixed content was properly extracted
    validateMixedContentExtraction(documents, finalItems);

    // Return successful result
    return {
      success: true,
      structure,
      items: finalItems,
      costs,
      processingTime,
      logs: debugLogger.exportLogsAsText()
    };

  } catch (error) {
    const processingTime = Date.now() - startTime;
    const costs = tokenTracker.getDetailedCosts();
    const currentPhase = costs.phase3.calls > 0 ? 3 :
                        costs.phase2.calls > 0 ? 2 :
                        costs.phase1.calls > 0 ? 1 : 0;

    debugLogger.extractionError(error as Error, costs.total, 0, currentPhase);

    // Log partial cost breakdown even on failure
    if (costs.totalCalls > 0) {
      console.log('\n=== PARTIAL COST BREAKDOWN (FAILED EXTRACTION) ===');
      console.log(`Phase 1: ${costs.phase1.calls} calls, $${costs.phase1.cost.toFixed(6)}`);
      console.log(`Phase 2: ${costs.phase2.calls} calls, $${costs.phase2.cost.toFixed(6)}`);
      console.log(`Phase 3: ${costs.phase3.calls} calls, $${costs.phase3.cost.toFixed(6)}`);
      console.log(`TOTAL COST INCURRED: $${costs.total.toFixed(6)}`);
      console.log('================================================\n');
    }

    // Return error result with cost data
    return {
      success: false,
      costs,
      processingTime,
      error: (error as Error).message,
      logs: debugLogger.exportLogsAsText()
    };
  }
}

/**
 * Quick extraction status check (for monitoring)
 */
export function getExtractionStatus() {
  return {
    memoryUsage: process.memoryUsage?.(),
    uptime: process.uptime?.(),
    version: '2.0.0'
  };
}

/**
 * Validate documents before extraction
 */
export function validateDocuments(documents: DocumentMeta[]): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!documents || documents.length === 0) {
    errors.push('No documents provided');
    return { isValid: false, errors };
  }

  for (let i = 0; i < documents.length; i++) {
    const doc = documents[i];

    if (!doc.id) {
      errors.push(`Document ${i + 1}: Missing ID`);
    }

    if (!doc.name) {
      errors.push(`Document ${i + 1}: Missing name`);
    }

    if (!doc.type) {
      errors.push(`Document ${i + 1}: Missing type`);
    }

    if (!doc.content && !doc.url) {
      errors.push(`Document ${i + 1}: Missing both content and URL`);
    }

    // Validate supported file types
    const supportedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel'
    ];

    if (!supportedTypes.some(type => doc.type.includes(type.split('/')[1]))) {
      errors.push(`Document ${i + 1}: Unsupported type "${doc.type}"`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validate that mixed content (spreadsheets + images) was properly extracted
 */
function validateMixedContentExtraction(documents: DocumentMeta[], finalItems: any[]): void {
  const fileTypes = {
    images: documents.filter(doc => doc.type.startsWith('image/')),
    spreadsheets: documents.filter(doc => doc.type.includes('spreadsheet') || doc.type.includes('excel')),
    pdfs: documents.filter(doc => doc.type === 'application/pdf')
  };

  const totalFiles = fileTypes.images.length + fileTypes.spreadsheets.length + fileTypes.pdfs.length;

  console.log('\n=== MIXED CONTENT EXTRACTION VALIDATION ===');
  console.log(`📁 Input Files: ${fileTypes.images.length} images, ${fileTypes.spreadsheets.length} spreadsheets, ${fileTypes.pdfs.length} PDFs`);
  console.log(`📊 Total Extracted Items: ${finalItems.length}`);

  // Count items by source type (this is a heuristic since sourceRef might not be perfectly tracked)
  const itemsSummary: any = {};

  for (const item of finalItems) {
    const sourceDoc = documents.find(doc => doc.id === item.sourceRef?.documentId);
    if (sourceDoc) {
      const sourceType = sourceDoc.type.startsWith('image/') ? 'image' :
                        sourceDoc.type.includes('spreadsheet') || sourceDoc.type.includes('excel') ? 'spreadsheet' :
                        sourceDoc.type === 'application/pdf' ? 'pdf' : 'unknown';

      itemsSummary[sourceType] = (itemsSummary[sourceType] || 0) + 1;
    }
  }

  console.log(`📊 Items by Source: ${Object.entries(itemsSummary).map(([type, count]) => `${type}: ${count}`).join(', ')}`);

  // Critical validation: If multiple file types uploaded, ensure multiple types contributed
  if (totalFiles > 1) {
    const contributingTypes = Object.keys(itemsSummary).length;

    if (contributingTypes === 1 && totalFiles > 1) {
      console.log(`🚨 MIXED CONTENT ISSUE: ${totalFiles} different file types uploaded but only 1 type contributed to extraction`);

      if (fileTypes.spreadsheets.length > 0 && !itemsSummary.spreadsheet) {
        console.log(`🚨 SPREADSHEET ISSUE: ${fileTypes.spreadsheets.length} spreadsheet(s) uploaded but no items extracted from them:`);
        fileTypes.spreadsheets.forEach(sheet => console.log(`   - ${sheet.name}`));
      }
    } else {
      console.log(`✅ MIXED CONTENT SUCCESS: ${contributingTypes} different file types contributed to extraction`);
    }
  }

  console.log('============================================\n');
}

/**
 * Export all components for direct use
 */
export {
  prepareDocuments,
  analyzeMenuStructure,
  extractMenuItems,
  enrichMenuItems,
  debugLogger,
  RealTokenTracker
};

export * from './types';