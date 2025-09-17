import { genkit } from 'genkit';
import { googleAI, gemini15Flash, gemini15Pro } from '@genkit-ai/googleai';
import { calculateExtractionCost, type ExtractionMetrics, type CostBreakdown } from './extraction-cost-calculator';

// Initialize Genkit with both models for different phases
const ai = genkit({
  plugins: [googleAI({
    apiKey: process.env.GOOGLE_API_KEY
  })],
  model: gemini15Flash, // Default fast model
});

// Advanced model for complex analysis
const expertAi = genkit({
  plugins: [googleAI({
    apiKey: process.env.GOOGLE_API_KEY
  })],
  model: gemini15Pro, // Expert model for modifier analysis
});

// Core types for the optimized pipeline
export interface DocumentMeta {
  id: string;
  name: string;
  type: string;
  url?: string;
  content?: string; // Added for base64 content
  estimatedItemCount?: number;
  menuLocation?: string; // e.g., "pages 1-3", "cells A1:D50"
}

export interface MenuIndex {
  sourceFilename: string;
  menuLocation: string;
  estimatedItemCount: number;
  menuSections: string[];
  confidence: number;
}

export interface ExtractionBatch {
  id: string;
  type: 'small_group' | 'large_segment';
  documents: DocumentMeta[];
  estimatedItems: number;
  menuLocation?: string; // For large menu segments
}

export interface CoreLineItem {
  name: string;
  basePrice: string;
  description?: string;
  category: string;
  sourceInfo: {
    filename: string;
    location?: string;
  };
}

export interface ModifierGroup {
  name: string;
  type: 'size' | 'addon' | 'choice';
  options: ModifierOption[];
  appliesToCategories?: string[];
  appliesToItems?: string[];
}

export interface ModifierOption {
  name: string;
  priceAdjustment?: string;
  isDefault?: boolean;
}

export interface EnrichedMenuItem {
  coreItem: CoreLineItem;
  sizeOptions?: ModifierOption[];
  modifierGroups?: ModifierGroup[];
  variants?: CoreLineItem[];
}

export interface WorkloadEstimate {
  documentName: string;
  estimatedItems: number;
  complexity: 'low' | 'medium' | 'high';
  shouldSplit: boolean;
  splitCount?: number;
}

export interface ExtractionTask {
  id: string;
  batch: ExtractionBatch;
  priority: number;
  maxRetries: number;
  tokenLimit: number;
}

export interface TaskResult {
  taskId: string;
  items: CoreLineItem[];
  apiCalls: number;
  retryCount: number;
  processingTimeMs: number;
  success: boolean;
  error?: string;
}

export interface OptimizedExtractionResult {
  phase1Results: {
    menuIndex: MenuIndex[];
    totalEstimatedItems: number;
    processingStrategy: string;
  };
  phase2Results: {
    coreItems: CoreLineItem[];
    extractionBatches: ExtractionBatch[];
    parallelProcessingStats: {
      batchCount: number;
      avgBatchSize: number;
      totalApiCalls: number;
    };
  };
  phase3Results: {
    enrichedItems: EnrichedMenuItem[];
    globalModifiers: ModifierGroup[];
    standardizedSizes: ModifierOption[];
    deduplicationStats: {
      duplicatesRemoved: number;
      sizesConsolidated: number;
      modifiersNormalized: number;
    };
  };
  costAnalysis: {
    metrics: ExtractionMetrics;
    breakdown: CostBreakdown;
    processingTimeMs: number;
  };
}

/**
 * Optimized Batched Extraction Pipeline
 * Implements the three-phase approach: Identification → Parallel Extraction → Enrichment
 */
export class OptimizedExtractionPipeline {
  private apiCallTracker = {
    flash: 0,
    pro: 0
  };

  private resetApiTracker() {
    this.apiCallTracker = { flash: 0, pro: 0 };
  }

  /**
   * PHASE 1: Menu Identification and Scoping
   * Performs initial analysis to identify menu locations and estimate sizes
   */
  async phase1_identifyAndScope(documents: DocumentMeta[]): Promise<{
    menuIndex: MenuIndex[];
    totalEstimatedItems: number;
    processingStrategy: string;
  }> {
    console.log('🔍 PHASE 1: Menu Identification and Scoping');
    console.log(`- Analyzing ${documents.length} documents`);

    const menuIndex: MenuIndex[] = [];
    let totalEstimatedItems = 0;

    // Analyze each document for menu content and structure
    for (const doc of documents) {
      console.log(`📄 Analyzing document: ${doc.name}`);

      const analysisResult = await this.analyzeDocumentStructure(doc);
      if (analysisResult) {
        menuIndex.push(analysisResult);
        totalEstimatedItems += analysisResult.estimatedItemCount;
        console.log(`  - Found ${analysisResult.estimatedItemCount} estimated items`);
        console.log(`  - Location: ${analysisResult.menuLocation}`);
        console.log(`  - Sections: ${analysisResult.menuSections.join(', ')}`);
      }
    }

    // Determine processing strategy based on total scale
    let processingStrategy: string;
    if (totalEstimatedItems > 200) {
      processingStrategy = 'large_scale_parallel';
    } else if (totalEstimatedItems > 50) {
      processingStrategy = 'medium_batch_parallel';
    } else {
      processingStrategy = 'small_batch_sequential';
    }

    console.log(`✅ Phase 1 Complete:`);
    console.log(`  - Total estimated items: ${totalEstimatedItems}`);
    console.log(`  - Processing strategy: ${processingStrategy}`);

    return {
      menuIndex,
      totalEstimatedItems,
      processingStrategy
    };
  }

  /**
   * Analyze individual document structure to estimate menu content
   */
  private async analyzeDocumentStructure(doc: DocumentMeta): Promise<MenuIndex | null> {
    try {
      // Download and analyze document structure
      const buffer = await this.getFileBuffer(doc);

      let analysisPrompt: string;
      let documentContent: string = '';

      if (doc.type === 'application/pdf') {
        // Quick PDF analysis for structure
        documentContent = await this.extractPdfTextSample(buffer);
        analysisPrompt = this.buildPdfAnalysisPrompt(doc.name, documentContent);
      } else if (doc.type.startsWith('image/')) {
        // Image analysis for menu structure
        const base64 = this.bufferToBase64(buffer);
        return await this.analyzeImageStructure(doc.name, base64);
      } else if (doc.type.includes('spreadsheet') || doc.type.includes('excel')) {
        // Spreadsheet structure analysis
        documentContent = await this.extractSpreadsheetSample(buffer);
        analysisPrompt = this.buildSpreadsheetAnalysisPrompt(doc.name, documentContent);
      } else {
        console.warn(`Unsupported document type: ${doc.type}`);
        return null;
      }

      // Analyze structure with AI
      const response = await ai.generate({
        prompt: analysisPrompt,
        config: {
          temperature: 0.1,
          maxOutputTokens: 1000,
        }
      });
      this.apiCallTracker.flash++;  // Track Flash model usage

      return this.parseMenuIndexResponse(response.text, doc.name);
    } catch (error) {
      console.error(`Failed to analyze document ${doc.name}:`, error);
      return null;
    }
  }

  /**
   * PHASE 2: Multi-Stage Divide-and-Conquer Extraction
   * Based on proven client-side methodology
   */
  async phase2_parallelizedExtraction(
    documents: DocumentMeta[],
    menuIndex: MenuIndex[],
    strategy: string
  ): Promise<{
    coreItems: CoreLineItem[];
    extractionBatches: ExtractionBatch[];
    parallelProcessingStats: any;
  }> {
    console.log('⚡ PHASE 2: Multi-Stage Divide-and-Conquer Extraction');

    // STEP A: Estimate workload for each document
    console.log('📊 Step A: Estimating workload per document...');
    const workloadEstimates = await this.estimateDocumentWorkloads(documents, menuIndex);

    // STEP B: Create intelligent extraction tasks based on estimates
    console.log('🔧 Step B: Creating extraction tasks...');
    const extractionTasks = this.createExtractionTasks(documents, workloadEstimates);
    console.log(`- Created ${extractionTasks.length} extraction tasks`);

    // STEP C: Process tasks with concurrent worker pool
    console.log('🚀 Step C: Processing tasks with worker pool...');
    const results = await this.processTasksWithWorkerPool(extractionTasks);

    // STEP D: Aggregate and validate results
    console.log('📋 Step D: Aggregating results...');
    const allCoreItems = this.aggregateResults(results);

    const stats = {
      taskCount: extractionTasks.length,
      totalApiCalls: results.reduce((sum, r) => sum + r.apiCalls, 0),
      avgItemsPerTask: allCoreItems.length / extractionTasks.length,
      retryCount: results.reduce((sum, r) => sum + r.retryCount, 0)
    };

    console.log(`✅ Phase 2 Complete: ${allCoreItems.length} core items extracted`);
    console.log(`📈 Stats: ${stats.taskCount} tasks, ${stats.totalApiCalls} API calls, ${stats.retryCount} retries`);

    return {
      coreItems: allCoreItems,
      extractionBatches: extractionTasks.map(t => t.batch),
      parallelProcessingStats: stats
    };
  }

  /**
   * PHASE 3: Modifier and Size Enrichment
   * Expert AI analysis for modifiers, sizes, and normalization
   */
  async phase3_modifierEnrichment(
    coreItems: CoreLineItem[],
    documents: DocumentMeta[]
  ): Promise<{
    enrichedItems: EnrichedMenuItem[];
    globalModifiers: ModifierGroup[];
    standardizedSizes: ModifierOption[];
    deduplicationStats: any;
  }> {
    console.log('🧠 PHASE 3: Modifier and Size Enrichment');

    // Step 1: Expert contextual analysis of source files
    const globalModifiers = await this.analyzeGlobalModifiers(documents);
    console.log(`  - Found ${globalModifiers.length} global modifier groups`);

    // Step 2: Item-level analysis for embedded modifiers
    const itemModifiers = await this.analyzeItemModifiers(coreItems);
    console.log(`  - Identified item-specific modifiers`);

    // Step 3: Size standardization
    const standardizedSizes = await this.standardizeSizes(coreItems);
    console.log(`  - Standardized ${standardizedSizes.length} size options`);

    // Step 4: Apply enrichment and normalization
    const enrichedItems = await this.applyEnrichment(coreItems, globalModifiers, itemModifiers, standardizedSizes);

    // Step 5: Deduplication and normalization
    const { finalItems, stats } = await this.deduplicateAndNormalize(enrichedItems);

    console.log(`✅ Phase 3 Complete: ${finalItems.length} enriched items`);
    console.log(`  - Duplicates removed: ${stats.duplicatesRemoved}`);
    console.log(`  - Sizes consolidated: ${stats.sizesConsolidated}`);

    return {
      enrichedItems: finalItems,
      globalModifiers,
      standardizedSizes,
      deduplicationStats: stats
    };
  }

  /**
   * Master orchestrator for the complete optimized pipeline
   */
  async processDocumentsOptimized(documents: DocumentMeta[]): Promise<OptimizedExtractionResult> {
    console.log('🚀 Starting Optimized Batched Extraction Pipeline');
    console.log(`📊 Processing ${documents.length} documents`);

    const startTime = Date.now();
    this.resetApiTracker();  // Reset API call counter

    // Phase 1: Identification and Scoping
    const phase1Results = await this.phase1_identifyAndScope(documents);

    // Phase 2: Parallelized Extraction
    const phase2Results = await this.phase2_parallelizedExtraction(
      documents,
      phase1Results.menuIndex,
      phase1Results.processingStrategy
    );

    // Phase 3: Modifier Enrichment
    const phase3Results = await this.phase3_modifierEnrichment(
      phase2Results.coreItems,
      documents
    );

    const totalTime = Date.now() - startTime;
    console.log(`🎉 Optimized Pipeline Complete in ${totalTime}ms`);
    console.log(`📈 Performance: ${phase3Results.enrichedItems.length} items / ${totalTime}ms = ${(phase3Results.enrichedItems.length / totalTime * 1000).toFixed(2)} items/sec`);

    // Calculate cost analysis
    const imageCount = documents.filter(doc => doc.type.startsWith('image/')).length;
    const metrics: ExtractionMetrics = {
      documentCount: documents.length,
      imageCount,
      totalItems: phase3Results.enrichedItems.length,
      apiCalls: {
        flash: this.apiCallTracker.flash,
        pro: this.apiCallTracker.pro
      },
      processingTimeMs: totalTime,
      hasComplexAnalysis: phase3Results.enrichedItems.length > 20 || phase3Results.globalModifiers.length > 0
    };

    const costBreakdown = calculateExtractionCost(metrics);
    console.log(`💰 Extraction Cost: $${costBreakdown.total.toFixed(4)} (${this.apiCallTracker.flash + this.apiCallTracker.pro} API calls)`);

    return {
      phase1Results,
      phase2Results,
      phase3Results,
      costAnalysis: {
        metrics,
        breakdown: costBreakdown,
        processingTimeMs: totalTime
      }
    };
  }

  // Helper methods (to be implemented)
  private async getFileBuffer(doc: DocumentMeta): Promise<ArrayBuffer> {
    if (doc.content) {
      const buffer = Buffer.from(doc.content, 'base64');
      return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    }
    if (doc.url) {
      return this.downloadFile(doc.url);
    }
    throw new Error(`Document ${doc.name} has no content or url`);
  }

  private async downloadFile(url: string): Promise<ArrayBuffer> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.statusText}`);
    }
    return await response.arrayBuffer();
  }

  private bufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  // Multi-Stage Pipeline Implementation Methods

  /**
   * STEP A: Estimate workload for each document using targeted AI calls
   * Based on client-side estimateMenuItemCounts methodology
   */
  private async estimateDocumentWorkloads(
    documents: DocumentMeta[],
    menuIndex: MenuIndex[]
  ): Promise<WorkloadEstimate[]> {
    const estimates: WorkloadEstimate[] = [];

    for (const doc of documents) {
      try {
        // Find corresponding menu index entry
        const menuEntry = menuIndex.find(m => m.sourceFilename === doc.name);
        const baseEstimate = menuEntry?.estimatedItemCount || 10;

        // Make a small, focused AI call for precise estimation
        const buffer = await this.getFileBuffer(doc);
        let estimationPrompt = '';
        let mediaParts: any[] = [];

        if (doc.type.startsWith('image/')) {
          const base64 = this.bufferToBase64(buffer);
          mediaParts.push({
            inlineData: {
              mimeType: 'image/jpeg',
              data: base64
            }
          });
          estimationPrompt = `Analyze this menu image and estimate the total number of menu items.

          Return ONLY a JSON object with:
          {
            "estimatedItems": number,
            "complexity": "low" | "medium" | "high",
            "hasMultipleSections": boolean
          }

          Base your complexity assessment on:
          - Low: Simple layout, clear text, under 20 items
          - Medium: Moderate complexity, 20-50 items
          - High: Dense layout, many items, complex formatting, over 50 items`;

        } else if (doc.type === 'application/pdf') {
          const textSample = await this.extractPdfTextSample(buffer);
          estimationPrompt = `Analyze this PDF menu text and estimate the total number of menu items.

          Text sample:
          ${textSample.substring(0, 2000)}...

          Return ONLY a JSON object with:
          {
            "estimatedItems": number,
            "complexity": "low" | "medium" | "high",
            "hasMultipleSections": boolean
          }`;
        }

        const response = await ai.generate({
          prompt: estimationPrompt,
          media: mediaParts,
          config: {
            temperature: 0.1,
            maxOutputTokens: 200, // Very small response
          }
        });

        this.apiCallTracker.flash++;

        const estimationResult = JSON.parse(response.text.trim());
        const estimatedItems = estimationResult.estimatedItems || baseEstimate;
        const complexity = estimationResult.complexity || 'medium';

        // Determine if document should be split based on estimate and complexity
        const MAX_ITEMS_PER_TASK = 75;
        const shouldSplit = estimatedItems > MAX_ITEMS_PER_TASK || complexity === 'high';
        const splitCount = shouldSplit ? Math.ceil(estimatedItems / MAX_ITEMS_PER_TASK) : 1;

        estimates.push({
          documentName: doc.name,
          estimatedItems,
          complexity,
          shouldSplit,
          splitCount
        });

        console.log(`  📊 ${doc.name}: ${estimatedItems} items (${complexity}) ${shouldSplit ? `→ split into ${splitCount} tasks` : ''}`);

      } catch (error) {
        console.warn(`  ⚠️  Failed to estimate ${doc.name}, using fallback`);
        estimates.push({
          documentName: doc.name,
          estimatedItems: 10,
          complexity: 'medium',
          shouldSplit: false
        });
      }
    }

    return estimates;
  }

  /**
   * STEP B: Create extraction tasks based on workload estimates
   * Implements intelligent task splitting like client-side approach
   */
  private createExtractionTasks(
    documents: DocumentMeta[],
    estimates: WorkloadEstimate[]
  ): ExtractionTask[] {
    const tasks: ExtractionTask[] = [];
    let taskId = 1;

    for (const estimate of estimates) {
      const doc = documents.find(d => d.name === estimate.documentName);
      if (!doc) continue;

      if (estimate.shouldSplit && estimate.splitCount && estimate.splitCount > 1) {
        // Create multiple tasks for large documents
        for (let i = 0; i < estimate.splitCount; i++) {
          const segmentName = `${estimate.documentName} (Part ${i + 1}/${estimate.splitCount})`;
          const segmentItems = Math.ceil(estimate.estimatedItems / estimate.splitCount);

          tasks.push({
            id: `task_${taskId++}`,
            batch: {
              id: `batch_${taskId}`,
              type: 'large_segment',
              documents: [doc],
              estimatedItems: segmentItems,
              menuLocation: segmentName
            },
            priority: this.calculateTaskPriority(estimate.complexity, segmentItems),
            maxRetries: estimate.complexity === 'high' ? 5 : 3,
            tokenLimit: this.calculateTokenLimit(estimate.complexity, segmentItems, true)
          });
        }
      } else {
        // Create single task for manageable documents
        tasks.push({
          id: `task_${taskId++}`,
          batch: {
            id: `batch_${taskId}`,
            type: 'small_group',
            documents: [doc],
            estimatedItems: estimate.estimatedItems,
            menuLocation: estimate.documentName
          },
          priority: this.calculateTaskPriority(estimate.complexity, estimate.estimatedItems),
          maxRetries: estimate.complexity === 'high' ? 5 : 3,
          tokenLimit: this.calculateTokenLimit(estimate.complexity, estimate.estimatedItems, false)
        });
      }
    }

    // Sort tasks by priority (high complexity/large items first)
    tasks.sort((a, b) => b.priority - a.priority);

    return tasks;
  }

  private calculateTaskPriority(complexity: string, estimatedItems: number): number {
    const complexityWeight = { low: 1, medium: 2, high: 3 }[complexity] || 2;
    const itemWeight = Math.min(estimatedItems / 10, 5); // Cap at 5x weight
    return complexityWeight * itemWeight;
  }

  private calculateTokenLimit(complexity: string, estimatedItems: number, isSegment: boolean): number {
    const baseTokens = 3000;
    const complexityMultiplier = { low: 1, medium: 1.5, high: 2.5 }[complexity] || 1.5;
    const itemMultiplier = Math.max(1, Math.min(3, estimatedItems / 25));
    const segmentBonus = isSegment ? 1.2 : 1;

    const dynamicLimit = Math.floor(baseTokens * complexityMultiplier * itemMultiplier * segmentBonus);
    return Math.min(dynamicLimit, 15000); // Cap at 15K tokens for largest tasks
  }

  /**
   * STEP C: Process tasks with concurrent worker pool
   * Implements client-side worker pool with automatic retries and exponential backoff
   */
  private async processTasksWithWorkerPool(tasks: ExtractionTask[]): Promise<TaskResult[]> {
    const results: TaskResult[] = [];
    const CONCURRENT_LIMIT = 4;
    let taskIndex = 0;
    let hasFailed = false;
    let firstError: string | undefined;

    const worker = async (): Promise<void> => {
      while (taskIndex < tasks.length && !hasFailed) {
        const currentIndex = taskIndex++;
        const task = tasks[currentIndex];
        if (!task) continue;

        const startTime = Date.now();
        try {
          console.log(`  🔄 Processing ${task.id}`);
          const result = await this.processSingleTask(task);
          results.push({
            taskId: task.id,
            items: result.items,
            apiCalls: result.apiCalls,
            retryCount: 0,
            processingTimeMs: Date.now() - startTime,
            success: true,
          });
          console.log(`  ✅ ${task.id}: ${result.items.length} items extracted`);
        } catch (err) {
          if (!hasFailed) {
            hasFailed = true;
            firstError = `Task ${task.id} failed: ${err instanceof Error ? err.message : String(err)}`;
            console.error(`  ❌ ${firstError}`);
          }
        }
      }
    };

    // Start concurrent workers
    console.log(`🚀 Starting ${Math.min(CONCURRENT_LIMIT, tasks.length)} workers for ${tasks.length} tasks`);
    await Promise.all(
      Array.from({ length: Math.min(CONCURRENT_LIMIT, tasks.length) }, worker)
    );

    if (hasFailed) {
      throw new Error(firstError || 'A task failed during extraction.');
    }

    const successCount = results.filter(r => r.success).length;
    console.log(`📊 Worker pool complete: ${successCount} success, 0 failures`);

    return results;
  }

  /**
   * Process a single extraction task with enhanced error handling
   */
  private async processSingleTask(task: ExtractionTask): Promise<{ items: CoreLineItem[]; apiCalls: number }> {
    // Build context for this specific task
    const batchContext = await this.buildBatchContext(task.batch);

    // Use dynamic token limit from task configuration
    const prompt = this.buildCoreExtractionPrompt(task.batch, batchContext);

    let response;
    if (batchContext.imageParts.length > 0) {
      response = await ai.generate({
        prompt,
        media: batchContext.imageParts,
        config: {
          temperature: 0.1,
          maxOutputTokens: task.tokenLimit,
        }
      });
    } else {
      response = await ai.generate({
        prompt,
        config: {
          temperature: 0.1,
          maxOutputTokens: task.tokenLimit,
        }
      });
    }

    // Enhanced response validation
    const truncationWarnings = this.detectResponseTruncation(response.text, task.batch);
    if (truncationWarnings.length > 0) {
      console.warn(`⚠️  Potential truncation in ${task.id}:`);
      truncationWarnings.forEach(warning => console.warn(`   - ${warning}`));

      // If severely truncated, throw error to trigger retry
      if (truncationWarnings.some(w => w.includes('incomplete') || w.includes('array but never closes'))) {
        throw new Error(`Response truncated: ${truncationWarnings.join(', ')}`);
      }
    }

    const extractedItems = this.parseCoreItemsResponse(response.text, task.batch);

    // Validate extraction quality
    if (task.batch.estimatedItems && task.batch.estimatedItems > 20) {
      const extractionRatio = extractedItems.length / task.batch.estimatedItems;
      if (extractionRatio < 0.3) {
        throw new Error(`Low extraction ratio: ${extractedItems.length}/${task.batch.estimatedItems} (${(extractionRatio * 100).toFixed(1)}%)`);
      }
    }

    return {
      items: extractedItems,
      apiCalls: 1
    };
  }

  /**
   * STEP D: Aggregate results from all tasks
   */
  private aggregateResults(results: TaskResult[]): CoreLineItem[] {
    const allItems: CoreLineItem[] = [];
    const successfulResults = results.filter(r => r.success);

    for (const result of successfulResults) {
      // Remove segment suffixes from item source info
      const cleanedItems = result.items.map(item => ({
        ...item,
        sourceInfo: {
          ...item.sourceInfo,
          location: item.sourceInfo.location?.replace(/\s*\(Part \d+ of \d+\)$/, '') || item.sourceInfo.filename
        }
      }));

      allItems.push(...cleanedItems);
    }

    // Log failed tasks for visibility
    const failedResults = results.filter(r => !r.success);
    if (failedResults.length > 0) {
      console.warn(`⚠️  ${failedResults.length} tasks failed:`);
      failedResults.forEach(result => {
        console.warn(`   - ${result.taskId}: ${result.error}`);
      });
    }

    return allItems;
  }

  // Phase 1 Implementation: Document Analysis Methods
  private async extractPdfTextSample(buffer: ArrayBuffer): Promise<string> {
    try {
      // Dynamic import to avoid bundling issues
      const pdfParseModule: any = await import('pdf-parse');
      const pdfParse = (pdfParseModule?.default || pdfParseModule) as (data: Buffer) => Promise<{ text: string }>;
      const buf = Buffer.from(buffer);
      const result = await pdfParse(buf);

      // Return first 2000 characters for analysis (sample for efficiency)
      const text = typeof result.text === 'string' ? result.text : '';
      return text.substring(0, 2000);
    } catch (err) {
      console.warn('PDF text sampling failed:', err instanceof Error ? err.message : err);
      return '';
    }
  }

  private async extractSpreadsheetSample(buffer: ArrayBuffer): Promise<string> {
    try {
      // Dynamic import to avoid SSR issues
      const xlsxModule: any = await import('xlsx');
      const XLSX = xlsxModule?.default || xlsxModule;

      const uint8Array = new Uint8Array(buffer);
      const workbook = XLSX.read(uint8Array, { type: 'array' });

      let combinedText = '';
      let cellCount = 0;
      const maxCells = 200; // Limit for sampling

      workbook.SheetNames.forEach(sheetName => {
        if (cellCount >= maxCells) return;

        const worksheet = workbook.Sheets[sheetName];
        const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:A1');

        for (let row = range.s.r; row <= Math.min(range.e.r, range.s.r + 50); row++) {
          if (cellCount >= maxCells) break;
          for (let col = range.s.c; col <= range.e.c; col++) {
            if (cellCount >= maxCells) break;

            const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
            const cell = worksheet[cellAddress];

            if (cell && cell.v) {
              combinedText += String(cell.v) + ' ';
              cellCount++;
            }
          }
        }
      });

      return combinedText.trim();
    } catch (err) {
      console.warn('Spreadsheet sampling failed:', err instanceof Error ? err.message : err);
      return '';
    }
  }

  private async analyzeImageStructure(filename: string, base64: string): Promise<MenuIndex | null> {
    try {
      const prompt = `Analyze this menu image to estimate its structure and content.

TASK: Provide a quick analysis of this menu image including:
1. Estimated number of menu items visible
2. Main menu sections you can identify
3. Overall structure (pages, columns, etc.)

Return ONLY a JSON object in this format:
{
  "estimatedItemCount": 42,
  "menuSections": ["Appetizers", "Entrees", "Desserts", "Beverages"],
  "menuLocation": "Single page menu with 4 sections",
  "confidence": 0.9
}`;

      const response = await ai.generate({
        prompt,
        media: [{
          inlineData: {
            mimeType: 'image/jpeg',
            data: base64
          }
        }],
        config: {
          temperature: 0.1,
          maxOutputTokens: 500,
        }
      });
      this.apiCallTracker.flash++;  // Track Flash model usage

      const parsed = this.parseMenuIndexResponse(response.text, filename);
      return parsed;
    } catch (error) {
      console.error('Image structure analysis failed:', error);
      return null;
    }
  }

  private buildPdfAnalysisPrompt(filename: string, content: string): string {
    return `Analyze this PDF text sample to estimate menu structure and content.

FILENAME: ${filename}
TEXT SAMPLE (first 2000 chars):
${content}

TASK: Based on this text sample, estimate:
1. Total number of menu items in the entire document
2. Main menu sections present
3. Document structure (pages, layout, etc.)

Look for patterns like:
- Item names followed by prices
- Section headers
- Repeated formatting patterns
- Currency symbols and price patterns

Return ONLY a JSON object in this format:
{
  "estimatedItemCount": 85,
  "menuSections": ["Appetizers", "Salads", "Entrees", "Desserts", "Beverages"],
  "menuLocation": "Multi-page PDF with sections across pages 1-4",
  "confidence": 0.8
}`;
  }

  private buildSpreadsheetAnalysisPrompt(filename: string, content: string): string {
    return `Analyze this spreadsheet sample to estimate menu structure and content.

FILENAME: ${filename}
SPREADSHEET SAMPLE (first 200 cells):
${content}

TASK: Based on this cell data, estimate:
1. Total number of menu items in the spreadsheet
2. Menu sections or categories
3. Data structure (columns, sheets, etc.)

Look for patterns like:
- Item names, descriptions, prices in columns
- Category headers or section dividers
- Consistent data formatting

Return ONLY a JSON object in this format:
{
  "estimatedItemCount": 64,
  "menuSections": ["Appetizers", "Mains", "Desserts", "Drinks"],
  "menuLocation": "Spreadsheet with items organized in columns A-D",
  "confidence": 0.85
}`;
  }

  private parseMenuIndexResponse(response: string, filename: string): MenuIndex | null {
    try {
      // Clean response and extract JSON
      let cleanResponse = response.trim();
      if (cleanResponse.startsWith('```json')) {
        cleanResponse = cleanResponse.replace(/```json\n?/, '').replace(/\n?```$/, '');
      } else if (cleanResponse.startsWith('```')) {
        cleanResponse = cleanResponse.replace(/```\n?/, '').replace(/\n?```$/, '');
      }

      const parsed = JSON.parse(cleanResponse);

      // Validate required fields
      if (!parsed.estimatedItemCount || !parsed.menuSections || !parsed.menuLocation) {
        console.warn('Invalid menu index response structure');
        return null;
      }

      return {
        sourceFilename: filename,
        menuLocation: parsed.menuLocation,
        estimatedItemCount: parsed.estimatedItemCount,
        menuSections: Array.isArray(parsed.menuSections) ? parsed.menuSections : [],
        confidence: parsed.confidence || 0.5
      };
    } catch (error) {
      console.error('Failed to parse menu index response:', error);
      console.log('Raw response:', response);
      return null;
    }
  }

  private createExtractionBatches(documents: DocumentMeta[], menuIndex: MenuIndex[], strategy: string): ExtractionBatch[] {
    console.log(`📊 Creating extraction batches using strategy: ${strategy}`);

    const batches: ExtractionBatch[] = [];
    let batchId = 1;

    if (strategy === 'large_scale_parallel') {
      // For large menus: Split large menus into segments, group small ones
      menuIndex.forEach(menu => {
        if (menu.estimatedItemCount > 100) {
          // Large menu - split into segments
          const segmentSize = 50; // Items per segment
          const numSegments = Math.ceil(menu.estimatedItemCount / segmentSize);

          for (let i = 0; i < numSegments; i++) {
            const segmentDoc = documents.find(d => d.name === menu.sourceFilename);
            if (segmentDoc) {
              batches.push({
                id: `batch_${batchId++}`,
                type: 'large_segment',
                documents: [segmentDoc],
                estimatedItems: Math.min(segmentSize, menu.estimatedItemCount - (i * segmentSize)),
                menuLocation: `${menu.menuLocation} - Segment ${i + 1}/${numSegments}`
              });
            }
          }
        } else {
          // Medium menu - process as single batch
          const doc = documents.find(d => d.name === menu.sourceFilename);
          if (doc) {
            batches.push({
              id: `batch_${batchId++}`,
              type: 'small_group',
              documents: [doc],
              estimatedItems: menu.estimatedItemCount,
              menuLocation: menu.menuLocation
            });
          }
        }
      });
    } else if (strategy === 'medium_batch_parallel') {
      // Group small menus together, process medium ones individually
      const smallMenus: MenuIndex[] = [];
      const mediumLargeMenus: MenuIndex[] = [];

      menuIndex.forEach(menu => {
        if (menu.estimatedItemCount <= 25) {
          smallMenus.push(menu);
        } else {
          mediumLargeMenus.push(menu);
        }
      });

      // Group small menus (up to 3-4 per batch)
      const maxItemsPerBatch = 80;
      let currentBatch: DocumentMeta[] = [];
      let currentEstimatedItems = 0;

      smallMenus.forEach(menu => {
        const doc = documents.find(d => d.name === menu.sourceFilename);
        if (doc && currentEstimatedItems + menu.estimatedItemCount <= maxItemsPerBatch) {
          currentBatch.push(doc);
          currentEstimatedItems += menu.estimatedItemCount;
        } else {
          // Finish current batch and start new one
          if (currentBatch.length > 0) {
            batches.push({
              id: `batch_${batchId++}`,
              type: 'small_group',
              documents: [...currentBatch],
              estimatedItems: currentEstimatedItems
            });
          }
          if (doc) {
            currentBatch = [doc];
            currentEstimatedItems = menu.estimatedItemCount;
          }
        }
      });

      // Add remaining small menus batch
      if (currentBatch.length > 0) {
        batches.push({
          id: `batch_${batchId++}`,
          type: 'small_group',
          documents: currentBatch,
          estimatedItems: currentEstimatedItems
        });
      }

      // Process medium/large menus individually
      mediumLargeMenus.forEach(menu => {
        const doc = documents.find(d => d.name === menu.sourceFilename);
        if (doc) {
          if (menu.estimatedItemCount > 80) {
            // Large menu - might need segmentation
            const segmentSize = 60;
            const numSegments = Math.ceil(menu.estimatedItemCount / segmentSize);

            for (let i = 0; i < numSegments; i++) {
              batches.push({
                id: `batch_${batchId++}`,
                type: 'large_segment',
                documents: [doc],
                estimatedItems: Math.min(segmentSize, menu.estimatedItemCount - (i * segmentSize)),
                menuLocation: `${menu.menuLocation} - Segment ${i + 1}/${numSegments}`
              });
            }
          } else {
            batches.push({
              id: `batch_${batchId++}`,
              type: 'small_group',
              documents: [doc],
              estimatedItems: menu.estimatedItemCount,
              menuLocation: menu.menuLocation
            });
          }
        }
      });
    } else {
      // small_batch_sequential - Enhanced strategy for mixed file types
      // Check if we have mixed file types (PDF + Excel + Image) - if so, process separately
      const fileTypes = documents.map(d => d.type);
      const hasPdf = fileTypes.some(t => t === 'application/pdf');
      const hasSpreadsheet = fileTypes.some(t => t.includes('spreadsheet') || t.includes('excel'));
      const hasImage = fileTypes.some(t => t.startsWith('image/'));
      const mixedFileTypes = [hasPdf, hasSpreadsheet, hasImage].filter(Boolean).length > 1;

      if (mixedFileTypes) {
        console.log(`🔄 Mixed file types detected - processing each document separately to ensure complete extraction`);
        // Process each document separately for mixed file types to prevent data loss
        menuIndex.forEach(menu => {
          const doc = documents.find(d => d.name === menu.sourceFilename);
          if (doc) {
            // For large individual files (especially images), use segment strategy
            if (menu.estimatedItemCount > 40 || doc.type.startsWith('image/')) {
              // Large individual document - might need segmentation
              const segmentSize = 35; // Smaller segments for complex content
              const numSegments = Math.max(1, Math.ceil(menu.estimatedItemCount / segmentSize));

              for (let i = 0; i < numSegments; i++) {
                batches.push({
                  id: `batch_${batchId++}`,
                  type: 'large_segment',
                  documents: [doc],
                  estimatedItems: Math.min(segmentSize, menu.estimatedItemCount - (i * segmentSize)),
                  menuLocation: numSegments > 1 ? `${menu.menuLocation} - Section ${i + 1}/${numSegments}` : menu.menuLocation
                });
              }
            } else {
              // Regular sized document
              batches.push({
                id: `batch_${batchId++}`,
                type: 'small_group',
                documents: [doc],
                estimatedItems: menu.estimatedItemCount,
                menuLocation: menu.menuLocation
              });
            }
          }
        });
      } else {
        // Original logic for same file types
        const maxItemsPerBatch = 60;
        let currentBatch: DocumentMeta[] = [];
        let currentEstimatedItems = 0;

        menuIndex.forEach(menu => {
          const doc = documents.find(d => d.name === menu.sourceFilename);
          if (doc && currentEstimatedItems + menu.estimatedItemCount <= maxItemsPerBatch) {
            currentBatch.push(doc);
            currentEstimatedItems += menu.estimatedItemCount;
          } else {
            if (currentBatch.length > 0) {
              batches.push({
                id: `batch_${batchId++}`,
                type: 'small_group',
                documents: [...currentBatch],
                estimatedItems: currentEstimatedItems
              });
            }
            if (doc) {
              currentBatch = [doc];
              currentEstimatedItems = menu.estimatedItemCount;
            }
          }
        });

        if (currentBatch.length > 0) {
          batches.push({
            id: `batch_${batchId++}`,
            type: 'small_group',
            documents: currentBatch,
            estimatedItems: currentEstimatedItems
          });
        }
      }
    }

    console.log(`📦 Created ${batches.length} extraction batches:`);
    batches.forEach((batch, i) => {
      console.log(`  - Batch ${i + 1}: ${batch.type}, ${batch.documents.length} docs, ~${batch.estimatedItems} items`);
    });

    return batches;
  }

  private async processBatch(batch: ExtractionBatch): Promise<CoreLineItem[]> {
    console.log(`🔄 Processing batch: ${batch.id} (${batch.type})`);
    console.log(`   Documents in batch: ${batch.documents.map(d => d.name).join(', ')}`);

    const coreItems: CoreLineItem[] = [];

    try {
      // Build batch content context
      const batchContext = await this.buildBatchContext(batch);
      console.log(`   Text content length: ${batchContext.textContent.length}`);
      console.log(`   Image parts: ${batchContext.imageParts.length}`);

      // Create extraction prompt focused on core items only
      const prompt = this.buildCoreExtractionPrompt(batch, batchContext);

      // Calculate dynamic token limit based on batch complexity
      const baseTokens = 3000;
      const tokenMultiplier = Math.max(1, Math.min(3, batch.documents.length * 0.5));
      const contentMultiplier = batchContext.textContent.length > 20000 ? 1.5 : 1;
      const imageMultiplier = batchContext.imageParts.length > 2 ? 1.3 : 1;

      const dynamicTokenLimit = Math.floor(baseTokens * tokenMultiplier * contentMultiplier * imageMultiplier);
      const maxTokens = Math.min(dynamicTokenLimit, 8000); // Cap at 8000 tokens

      console.log(`   💡 Dynamic token limit: ${maxTokens} (base: ${baseTokens}, mult: ${tokenMultiplier.toFixed(1)}x)`);

      // Execute extraction with appropriate media
      let response;
      if (batchContext.imageParts.length > 0) {
        // Multimodal extraction for batches with images
        response = await ai.generate({
          prompt,
          media: batchContext.imageParts,
          config: {
            temperature: 0.1,
            maxOutputTokens: maxTokens,
          }
        });
        this.apiCallTracker.flash++;  // Track Flash model usage
      } else {
        // Text-only extraction
        response = await ai.generate({
          prompt,
          config: {
            temperature: 0.1,
            maxOutputTokens: maxTokens,
          }
        });
        this.apiCallTracker.flash++;  // Track Flash model usage
      }

      // Parse response to core items
      const extractedItems = this.parseCoreItemsResponse(response.text, batch);
      coreItems.push(...extractedItems);

      console.log(`  ✅ Batch ${batch.id}: ${extractedItems.length} new items, ${coreItems.length} total`);
      if (extractedItems.length > 0) {
        console.log(`      Sample items: ${extractedItems.slice(0, 3).map(item => item.name).join(', ')}`);

        // Track source distribution
        const sourceCounts = extractedItems.reduce((acc, item) => {
          const source = item.sourceInfo?.filename || 'unknown';
          acc[source] = (acc[source] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        if (Object.keys(sourceCounts).length > 1) {
          console.log(`      ✅ Multi-source extraction: ${Object.entries(sourceCounts).map(([src, count]) => `${count} from ${src}`).join(', ')}`);
        } else {
          const singleSource = Object.keys(sourceCounts)[0];
          console.log(`      ⚠️  Single-source extraction: all ${extractedItems.length} items from ${singleSource}`);
        }
      }

    } catch (error) {
      console.error(`❌ Batch ${batch.id} failed:`, error);
    }

    return coreItems;
  }

  private async buildBatchContext(batch: ExtractionBatch): Promise<{
    textContent: string;
    imageParts: any[];
  }> {
    let textContent = '';
    const imageParts: any[] = [];

    for (const doc of batch.documents) {
      if (doc.type === 'application/pdf') {
        const buffer = await this.getFileBuffer(doc);
        const text = await this.extractPdfTextSample(buffer);
        textContent += `\n=== ${doc.name} ===\n${text}\n`;
      } else if (doc.type.startsWith('image/')) {
        const buffer = await this.getFileBuffer(doc);
        const base64 = this.bufferToBase64(buffer);
        imageParts.push({
          inlineData: {
            mimeType: 'image/jpeg',
            data: base64
          }
        });
        textContent += `\n=== ${doc.name} ===\nImage Document: ${doc.name}\n[Content will be processed by AI vision]\n`;
      } else if (doc.type.includes('spreadsheet') || doc.type.includes('excel')) {
        const buffer = await this.getFileBuffer(doc);
        const text = await this.extractSpreadsheetSample(buffer);
        textContent += `\n=== ${doc.name} ===\n${text}\n`;
      }
    }

    return { textContent, imageParts };
  }

  private buildCoreExtractionPrompt(batch: ExtractionBatch, context: any): string {
    const instruction = batch.type === 'large_segment'
      ? `Extract core menu items from this SEGMENT of a larger menu. Focus only on the items in: ${batch.menuLocation}`
      : `Extract ALL core menu items from the provided document(s).`;

    // Check if we have both text and images
    const hasImages = context.imageParts && context.imageParts.length > 0;
    const hasTextContent = context.textContent && context.textContent.trim().length > 0;

    // Check if text content is just placeholder (image metadata)
    const hasRealTextContent = hasTextContent && context.textContent.trim().length > 200;

    let sourceInstructions = '';
    let contentSection = '';

    if (hasImages && hasRealTextContent) {
      sourceInstructions = `
IMPORTANT - MULTIPLE CONTENT SOURCES:
- You have BOTH text content (from PDFs/spreadsheets) AND image content (menu photos)
- The Context section below contains extracted text from PDFs and Excel files
- The attached media contains menu images that you must also analyze
- You MUST extract items from ALL sources: both the text content AND the images
- Process each source completely and combine all results`;

      contentSection = `
Text Content from PDFs and Spreadsheets:
${context.textContent}`;

    } else if (hasImages && !hasRealTextContent) {
      sourceInstructions = `
IMPORTANT - IMAGE CONTENT SOURCE:
- You have image content (menu photos) attached to this message
- The image is provided via the media attachment, NOT in text form
- You MUST analyze the attached image(s) to extract menu items
- Look carefully at the image to identify ALL menu items, prices, and descriptions
- DO NOT rely on the document information below - it's just metadata`;

      contentSection = `
Document Information:
${context.textContent}

CRITICAL: The actual menu content is in the ATTACHED IMAGE above. Analyze the image carefully to extract all visible menu items.`;

    } else if (hasImages) {
      sourceInstructions = `
CONTENT SOURCE: You have image content (menu photos) to analyze via attached media.`;

      contentSection = `
Text Content from PDFs and Spreadsheets:
${context.textContent}`;

    } else {
      sourceInstructions = `
CONTENT SOURCE: You have text content from documents to analyze.`;

      contentSection = `
Text Content from PDFs and Spreadsheets:
${context.textContent}`;
    }

    return `${instruction}
${sourceInstructions}

CRITICAL: You must read the ACTUAL content from ALL provided sources. DO NOT generate generic restaurant examples or template items. Only extract items that are LITERALLY visible in the provided content.

CORE EXTRACTION RULES:
1. Extract items from ALL provided sources (text context AND/OR attached images)
2. Use the EXACT item names as they appear - do not rephrase or generalize
3. Extract ONLY the base item name and base price as shown
4. Create SINGLE entries for items with multiple sizes (e.g., "Pizza" not "Small Pizza", "Medium Pizza", "Large Pizza")
5. Ignore inline modifiers - extract the core item only (e.g., "Burger" not "Burger with cheese")
6. Include basic description if clearly visible in the source
7. Assign appropriate category based on item type
8. Include sourceInfo indicating which document each item came from
9. If you cannot clearly read specific items from any source, still extract what you can from other sources

${contentSection}

Return ONLY a JSON array of core items extracted from ALL sources:
[
  {
    "name": "Exact Item Name As Shown",
    "basePrice": "$XX.XX",
    "description": "Description if visible",
    "category": "Appropriate Category",
    "sourceInfo": {
      "filename": "document.pdf",
      "location": "approximate location if known"
    }
  }
]

REMINDER: Extract ONLY items that you can actually see in the provided content. Do not generate examples or generic restaurant items.`;
  }

  private detectResponseTruncation(response: string, batch: ExtractionBatch): string[] {
    const warnings: string[] = [];
    const trimmedResponse = response.trim();

    // Check for incomplete JSON structure
    if (trimmedResponse.includes('[') && !trimmedResponse.includes(']')) {
      warnings.push('Response starts with array but never closes');
    }

    if (trimmedResponse.includes('{') && !trimmedResponse.endsWith('}') && !trimmedResponse.endsWith('}]')) {
      warnings.push('Response contains incomplete JSON objects');
    }

    // Check for mid-sentence cutoffs
    if (!trimmedResponse.endsWith(']') && !trimmedResponse.endsWith('}') && !trimmedResponse.endsWith('"')) {
      warnings.push('Response appears to end mid-sentence');
    }

    // Check for common truncation patterns
    if (trimmedResponse.includes(',"name"') && trimmedResponse.lastIndexOf(',"name"') > trimmedResponse.lastIndexOf('}')) {
      warnings.push('Response may be cut off during item definition');
    }

    // Check expected vs actual extraction ratio
    if (batch.estimatedItems && batch.estimatedItems > 10) {
      try {
        const cleaned = trimmedResponse.replace(/```json\n?/, '').replace(/\n?```$/, '').replace(/```\n?/, '').replace(/\n?```$/, '');
        const parsed = JSON.parse(cleaned);
        if (Array.isArray(parsed) && parsed.length < Math.max(3, batch.estimatedItems * 0.3)) {
          warnings.push(`Low extraction ratio: got ${parsed.length} items, expected ~${batch.estimatedItems}`);
        }
      } catch {
        // JSON parsing will be handled in main function
      }
    }

    return warnings;
  }

  private parseCoreItemsResponse(response: string, batch: ExtractionBatch): CoreLineItem[] {
    try {
      // Check for truncation indicators
      const truncationWarnings = this.detectResponseTruncation(response, batch);
      if (truncationWarnings.length > 0) {
        console.warn(`⚠️  Potential truncation detected in batch ${batch.id}:`);
        truncationWarnings.forEach(warning => console.warn(`   - ${warning}`));
      }

      // Clean response and extract JSON
      let cleanResponse = response.trim();
      if (cleanResponse.startsWith('```json')) {
        cleanResponse = cleanResponse.replace(/```json\n?/, '').replace(/\n?```$/, '');
      } else if (cleanResponse.startsWith('```')) {
        cleanResponse = cleanResponse.replace(/```\n?/, '').replace(/\n?```$/, '');
      }

      const parsed = JSON.parse(cleanResponse);

      if (!Array.isArray(parsed)) {
        console.warn(`Batch ${batch.id}: Response is not an array`);
        return [];
      }

      const coreItems: CoreLineItem[] = parsed.map((item: any) => {
        // Determine source filename
        let sourceFilename = batch.documents[0]?.name || 'unknown';
        if (item.sourceInfo?.filename) {
          sourceFilename = item.sourceInfo.filename;
        }

        return {
          name: item.name || 'Unknown Item',
          basePrice: item.basePrice || item.price || '$0.00',
          description: item.description || undefined,
          category: item.category || 'Unknown',
          sourceInfo: {
            filename: sourceFilename,
            location: item.sourceInfo?.location || batch.menuLocation
          }
        };
      });

      return coreItems;
    } catch (error) {
      console.error(`Failed to parse core items response for batch ${batch.id}:`, error);
      console.log('Raw response:', response);
      return [];
    }
  }

  private async analyzeGlobalModifiers(documents: DocumentMeta[]): Promise<ModifierGroup[]> {
    console.log('🔍 Analyzing global modifiers from source documents...');

    const globalModifiers: ModifierGroup[] = [];

    try {
      // Build context from all documents
      let contextText = '';
      const imageParts: any[] = [];

      for (const doc of documents) {
        if (doc.type === 'application/pdf') {
          const buffer = await this.getFileBuffer(doc);
          const text = await this.extractPdfTextSample(buffer);
          contextText += `\n=== ${doc.name} ===\n${text}\n`;
        } else if (doc.type.startsWith('image/')) {
          const buffer = await this.getFileBuffer(doc);
          const base64 = this.bufferToBase64(buffer);
          imageParts.push({
            inlineData: {
              mimeType: 'image/jpeg',
              data: base64
            }
          });
          contextText += `\n=== ${doc.name} ===\nImage Document: ${doc.name}\n[Content analyzed by expert AI]\n`;
        } else if (doc.type.includes('spreadsheet') || doc.type.includes('excel')) {
          const buffer = await this.getFileBuffer(doc);
          const text = await this.extractSpreadsheetSample(buffer);
          contextText += `\n=== ${doc.name} ===\n${text}\n`;
        }
      }

      const prompt = `You are an expert menu analyst specializing in modifier and size identification.

TASK: Analyze these menu documents to identify GLOBAL modifiers and options that apply across multiple items or sections.

Look for:
1. Menu-wide notes (e.g., "Add protein to any salad for $3")
2. Section headers with options (e.g., "All sandwiches served with choice of fries or salad")
3. Size options that appear to apply to multiple items
4. Consistent modifier patterns
5. Promotional add-ons or customizations

CONTEXT:
${contextText}

Return ONLY a JSON array of global modifier groups:
[
  {
    "name": "Protein Add-ons",
    "type": "addon",
    "options": [
      {"name": "Grilled Chicken", "priceAdjustment": "$3.00"},
      {"name": "Salmon", "priceAdjustment": "$5.00"}
    ],
    "appliesToCategories": ["Salads", "Bowls"]
  },
  {
    "name": "Side Choices",
    "type": "choice",
    "options": [
      {"name": "French Fries", "isDefault": true},
      {"name": "Side Salad", "priceAdjustment": "$2.00"}
    ],
    "appliesToCategories": ["Sandwiches", "Burgers"]
  }
]`;

      let response;
      if (imageParts.length > 0) {
        response = await expertAi.generate({
          prompt,
          media: imageParts,
          config: {
            temperature: 0.1,
            maxOutputTokens: 2000,
          }
        });
        this.apiCallTracker.pro++;  // Track Pro model usage
      } else {
        response = await expertAi.generate({
          prompt,
          config: {
            temperature: 0.1,
            maxOutputTokens: 2000,
          }
        });
        this.apiCallTracker.pro++;  // Track Pro model usage
      }

      const parsed = this.parseModifierResponse(response.text);
      globalModifiers.push(...parsed);

    } catch (error) {
      console.error('Global modifier analysis failed:', error);
    }

    return globalModifiers;
  }

  private async analyzeItemModifiers(coreItems: CoreLineItem[]): Promise<ModifierGroup[]> {
    console.log('🔍 Analyzing item-level modifiers from extracted items...');

    const itemModifiers: ModifierGroup[] = [];

    try {
      // Group items by category for analysis
      const itemsByCategory = coreItems.reduce((acc, item) => {
        if (!acc[item.category]) acc[item.category] = [];
        acc[item.category].push(item);
        return acc;
      }, {} as Record<string, CoreLineItem[]>);

      // Analyze each category for embedded modifiers
      for (const [category, items] of Object.entries(itemsByCategory)) {
        const itemText = items.map(item =>
          `${item.name} - ${item.basePrice}${item.description ? ` (${item.description})` : ''}`
        ).join('\n');

        const prompt = `Analyze these ${category} items for embedded modifier patterns:

${itemText}

Look for:
1. Items with embedded size variations (e.g., "Small/Medium/Large Pizza")
2. Items with choice indicators (e.g., "served with", "choice of", "available in")
3. Similar items that suggest variants or options
4. Price patterns that indicate size or modification tiers

Return ONLY a JSON array of modifier groups found:
[
  {
    "name": "Pizza Sizes",
    "type": "size",
    "options": [
      {"name": "Small", "priceAdjustment": "$0.00", "isDefault": true},
      {"name": "Medium", "priceAdjustment": "$3.00"},
      {"name": "Large", "priceAdjustment": "$6.00"}
    ],
    "appliesToItems": ["Pizza", "Calzone"]
  }
]`;

        const response = await expertAi.generate({
          prompt,
          config: {
            temperature: 0.1,
            maxOutputTokens: 1000,
          }
        });
        this.apiCallTracker.pro++;  // Track Pro model usage

        const parsed = this.parseModifierResponse(response.text);
        itemModifiers.push(...parsed);
      }

    } catch (error) {
      console.error('Item modifier analysis failed:', error);
    }

    return itemModifiers;
  }

  private async standardizeSizes(coreItems: CoreLineItem[]): Promise<ModifierOption[]> {
    console.log('📏 Standardizing size options...');

    // Extract all size-related information from core items
    const sizeTerms = new Set<string>();

    coreItems.forEach(item => {
      // Look for size terms in names and descriptions
      const text = `${item.name} ${item.description || ''}`.toLowerCase();

      // Common size patterns
      const sizePatterns = [
        /\b(small|sm|s)\b/g,
        /\b(medium|med|m)\b/g,
        /\b(large|lg|l)\b/g,
        /\b(extra large|xl|x-large)\b/g,
        /\b(\d+\s*oz)\b/g,
        /\b(\d+\s*ml)\b/g,
        /\b(pint|pt)\b/g,
        /\b(glass|gls)\b/g,
        /\b(bottle|btl)\b/g,
        /\b(personal|individual)\b/g
      ];

      sizePatterns.forEach(pattern => {
        const matches = text.match(pattern);
        if (matches) {
          matches.forEach(match => sizeTerms.add(match.trim()));
        }
      });
    });

    if (sizeTerms.size === 0) {
      return [];
    }

    const prompt = `Standardize these size terms into consistent options:

Size terms found: ${Array.from(sizeTerms).join(', ')}

Create standardized size options with:
1. Consistent naming
2. Logical ordering (smallest to largest)
3. Reasonable price adjustments
4. Default designation for most common size

Return ONLY a JSON array:
[
  {"name": "Small", "priceAdjustment": "$0.00", "isDefault": true},
  {"name": "Medium", "priceAdjustment": "$2.00"},
  {"name": "Large", "priceAdjustment": "$4.00"}
]`;

    try {
      const response = await expertAi.generate({
        prompt,
        config: {
          temperature: 0.1,
          maxOutputTokens: 500,
        }
      });
      this.apiCallTracker.pro++;  // Track Pro model usage

      return this.parseSizeOptionsResponse(response.text);
    } catch (error) {
      console.error('Size standardization failed:', error);
      return [];
    }
  }

  private async applyEnrichment(
    coreItems: CoreLineItem[],
    globalModifiers: ModifierGroup[],
    itemModifiers: ModifierGroup[],
    standardizedSizes: ModifierOption[]
  ): Promise<EnrichedMenuItem[]> {
    console.log('✨ Applying enrichment to core items...');

    const enrichedItems: EnrichedMenuItem[] = [];

    for (const coreItem of coreItems) {
      const enriched: EnrichedMenuItem = {
        coreItem,
        sizeOptions: [],
        modifierGroups: [],
        variants: []
      };

      // Apply standardized sizes if relevant
      if (standardizedSizes.length > 0) {
        // Check if item likely has size variations
        const itemText = `${coreItem.name} ${coreItem.description || ''}`.toLowerCase();
        if (itemText.includes('pizza') || itemText.includes('drink') || itemText.includes('salad') ||
            itemText.includes('sandwich') || itemText.includes('burger')) {
          enriched.sizeOptions = [...standardizedSizes];
        }
      }

      // Apply global modifiers
      globalModifiers.forEach(modifier => {
        if (modifier.appliesToCategories?.includes(coreItem.category)) {
          enriched.modifierGroups?.push(modifier);
        }
      });

      // Apply item-specific modifiers
      itemModifiers.forEach(modifier => {
        if (modifier.appliesToItems?.includes(coreItem.name) ||
            modifier.appliesToCategories?.includes(coreItem.category)) {
          // Avoid duplicates
          const exists = enriched.modifierGroups?.some(existing => existing.name === modifier.name);
          if (!exists) {
            enriched.modifierGroups?.push(modifier);
          }
        }
      });

      enrichedItems.push(enriched);
    }

    return enrichedItems;
  }

  private async deduplicateAndNormalize(enrichedItems: EnrichedMenuItem[]): Promise<{
    finalItems: EnrichedMenuItem[];
    stats: any;
  }> {
    console.log('🔧 Deduplicating and normalizing enriched items...');

    let duplicatesRemoved = 0;
    let sizesConsolidated = 0;
    let modifiersNormalized = 0;

    // Remove duplicate items based on name and category
    const seen = new Set<string>();
    const deduplicated = enrichedItems.filter(item => {
      const key = `${item.coreItem.category}:${item.coreItem.name.toLowerCase()}`;
      if (seen.has(key)) {
        duplicatesRemoved++;
        return false;
      }
      seen.add(key);
      return true;
    });

    // Normalize modifier groups (remove duplicates, standardize names)
    const modifierGroupMap = new Map<string, ModifierGroup>();

    deduplicated.forEach(item => {
      if (item.modifierGroups) {
        item.modifierGroups = item.modifierGroups.map(group => {
          const key = group.name.toLowerCase();
          if (modifierGroupMap.has(key)) {
            modifiersNormalized++;
            return modifierGroupMap.get(key)!;
          } else {
            modifierGroupMap.set(key, group);
            return group;
          }
        });
      }
    });

    // Consolidate size options
    const sizeOptionsMap = new Map<string, ModifierOption>();
    deduplicated.forEach(item => {
      if (item.sizeOptions) {
        item.sizeOptions = item.sizeOptions.map(size => {
          const key = size.name.toLowerCase();
          if (sizeOptionsMap.has(key)) {
            sizesConsolidated++;
            return sizeOptionsMap.get(key)!;
          } else {
            sizeOptionsMap.set(key, size);
            return size;
          }
        });
      }
    });

    return {
      finalItems: deduplicated,
      stats: {
        duplicatesRemoved,
        sizesConsolidated,
        modifiersNormalized
      }
    };
  }

  private parseModifierResponse(response: string): ModifierGroup[] {
    try {
      let cleanResponse = response.trim();
      if (cleanResponse.startsWith('```json')) {
        cleanResponse = cleanResponse.replace(/```json\n?/, '').replace(/\n?```$/, '');
      } else if (cleanResponse.startsWith('```')) {
        cleanResponse = cleanResponse.replace(/```\n?/, '').replace(/\n?```$/, '');
      }

      const parsed = JSON.parse(cleanResponse);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error('Failed to parse modifier response:', error);
      return [];
    }
  }

  private parseSizeOptionsResponse(response: string): ModifierOption[] {
    try {
      let cleanResponse = response.trim();
      if (cleanResponse.startsWith('```json')) {
        cleanResponse = cleanResponse.replace(/```json\n?/, '').replace(/\n?```$/, '');
      } else if (cleanResponse.startsWith('```')) {
        cleanResponse = cleanResponse.replace(/```\n?/, '').replace(/\n?```$/, '');
      }

      const parsed = JSON.parse(cleanResponse);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error('Failed to parse size options response:', error);
      return [];
    }
  }
}