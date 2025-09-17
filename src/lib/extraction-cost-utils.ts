/**
 * Cost utility functions for extraction display
 * Simplified version after migration to new extraction system
 */

/**
 * Format cost number to readable currency string
 */
export function formatCost(cost: number): string {
  if (cost === 0) return '$0.00';
  if (cost < 0.000001) return '< $0.000001';
  if (cost < 0.01) return `$${cost.toFixed(6)}`;
  return `$${cost.toFixed(2)}`;
}

/**
 * Get color class based on cost amount
 */
export function getCostColor(cost: number): string {
  if (cost === 0) return 'text-gray-500';
  if (cost < 0.01) return 'text-green-600';
  if (cost < 0.1) return 'text-yellow-600';
  return 'text-red-600';
}

/**
 * Simple extraction cost estimation for pre-extraction display
 * This is just for display purposes - real costs are tracked by the new system
 */
export function estimateExtractionCost(
  documentCount: number,
  estimatedItems: number,
  hasImages: boolean = false
): number {
  // Very rough estimate for display only
  const baseEstimate = documentCount * 0.005;
  const itemsEstimate = estimatedItems * 0.0002;
  const imageBonus = hasImages ? documentCount * 0.003 : 0;

  return baseEstimate + itemsEstimate + imageBonus;
}