/**
 * Extraction Cost Calculator
 * Calculates costs for AI-powered menu extraction operations
 */

// Gemini API pricing (as of January 2025)
const GEMINI_PRICING = {
  flash: {
    input: 0.075 / 1_000_000,  // $0.075 per 1M input tokens
    output: 0.30 / 1_000_000   // $0.30 per 1M output tokens
  },
  pro: {
    input: 1.25 / 1_000_000,   // $1.25 per 1M input tokens
    output: 5.00 / 1_000_000   // $5.00 per 1M output tokens
  }
};

// Base costs for different operations
const BASE_COSTS = {
  documentProcessing: 0.01,    // Base cost per document
  itemExtraction: 0.001,       // Cost per menu item extracted
  imageProcessing: 0.05,       // Additional cost for image processing
  complexAnalysis: 0.02        // Cost for modifier analysis (Phase 3)
};

export interface ExtractionMetrics {
  documentCount: number;
  imageCount: number;
  totalItems: number;
  apiCalls: {
    flash: number;    // Number of Flash model calls
    pro: number;      // Number of Pro model calls
  };
  processingTimeMs: number;
  hasComplexAnalysis: boolean;  // Phase 3 enrichment
}

export interface CostBreakdown {
  documentProcessing: number;
  imageProcessing: number;
  itemExtraction: number;
  apiCalls: {
    flash: number;
    pro: number;
  };
  complexAnalysis: number;
  total: number;
}

/**
 * Estimates token usage based on extraction metrics
 */
function estimateTokenUsage(metrics: ExtractionMetrics): { inputTokens: number; outputTokens: number } {
  const {
    documentCount,
    imageCount,
    totalItems,
    apiCalls
  } = metrics;

  // Base estimates per operation
  const baseInputTokensPerDoc = 2000;      // Average tokens per document analysis
  const baseInputTokensPerImage = 1000;    // Average tokens per image analysis
  const outputTokensPerItem = 150;         // Average tokens per extracted item
  const baseOutputTokensPerCall = 500;     // Base output per API call

  // Calculate input tokens
  const inputTokens = (
    (documentCount * baseInputTokensPerDoc) +
    (imageCount * baseInputTokensPerImage) +
    (apiCalls.flash * 1000) +              // Flash calls typically smaller
    (apiCalls.pro * 2000)                  // Pro calls typically larger
  );

  // Calculate output tokens
  const outputTokens = (
    (totalItems * outputTokensPerItem) +
    ((apiCalls.flash + apiCalls.pro) * baseOutputTokensPerCall)
  );

  return { inputTokens, outputTokens };
}

/**
 * Calculates detailed cost breakdown for an extraction operation
 */
export function calculateExtractionCost(metrics: ExtractionMetrics): CostBreakdown {
  const { inputTokens, outputTokens } = estimateTokenUsage(metrics);

  // Document processing costs
  const documentProcessing = metrics.documentCount * BASE_COSTS.documentProcessing;

  // Image processing costs (additional cost for visual analysis)
  const imageProcessing = metrics.imageCount * BASE_COSTS.imageProcessing;

  // Item extraction costs
  const itemExtraction = metrics.totalItems * BASE_COSTS.itemExtraction;

  // API call costs (estimated token usage)
  const flashTokenCost = (
    (inputTokens * 0.7 * GEMINI_PRICING.flash.input) +  // 70% of tokens via Flash
    (outputTokens * 0.7 * GEMINI_PRICING.flash.output)
  );

  const proTokenCost = (
    (inputTokens * 0.3 * GEMINI_PRICING.pro.input) +    // 30% of tokens via Pro
    (outputTokens * 0.3 * GEMINI_PRICING.pro.output)
  );

  // Complex analysis costs (Phase 3 enrichment)
  const complexAnalysis = metrics.hasComplexAnalysis ? BASE_COSTS.complexAnalysis : 0;

  const total = (
    documentProcessing +
    imageProcessing +
    itemExtraction +
    flashTokenCost +
    proTokenCost +
    complexAnalysis
  );

  return {
    documentProcessing,
    imageProcessing,
    itemExtraction,
    apiCalls: {
      flash: flashTokenCost,
      pro: proTokenCost
    },
    complexAnalysis,
    total: Math.round(total * 10000) / 10000  // Round to 4 decimal places
  };
}

/**
 * Quick cost estimate for extraction before processing
 */
export function estimateExtractionCost(
  documentCount: number,
  estimatedItems: number,
  hasImages = false
): number {
  const metrics: ExtractionMetrics = {
    documentCount,
    imageCount: hasImages ? documentCount : 0,
    totalItems: estimatedItems,
    apiCalls: {
      flash: Math.ceil(documentCount / 2),  // Estimate 2 docs per Flash call
      pro: hasImages ? 1 : 0                // Pro for complex image analysis
    },
    processingTimeMs: 0,
    hasComplexAnalysis: estimatedItems > 20  // Complex analysis for larger menus
  };

  return calculateExtractionCost(metrics).total;
}

/**
 * Formats cost for display in UI
 */
export function formatCost(cost: number): string {
  if (cost < 0.01) {
    return '< $0.01';
  }
  return `$${cost.toFixed(2)}`;
}

/**
 * Gets cost color based on amount (for UI styling)
 */
export function getCostColor(cost: number): string {
  if (cost < 0.05) return 'text-green-600';
  if (cost < 0.20) return 'text-yellow-600';
  return 'text-red-600';
}