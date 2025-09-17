/**
 * Real Token Tracker for 3-Phase Extraction
 * Tracks actual token usage from API responses (no estimates allowed)
 */

import { ModelType, calculateRealCost, extractTokenUsage } from '../models/gemini-models';
import { debugLogger } from './debug-logger';
import type { ExtractionCosts, TokenUsage } from '../types';

export class RealTokenTracker {
  private phaseCosts = {
    phase1: { cost: 0, calls: 0, input: 0, output: 0 },
    phase2: { cost: 0, calls: 0, input: 0, output: 0 },
    phase3: { cost: 0, calls: 0, input: 0, output: 0 }
  };

  private callIndex = 0;

  /**
   * Record an API call with REAL token usage from response
   * Throws error if no token usage found (no estimates allowed)
   */
  recordApiCall(
    phase: number,
    model: ModelType,
    response: any,
    imageCount = 0
  ): TokenUsage {
    this.callIndex++;

    // Extract REAL tokens from response
    const tokens = extractTokenUsage(response);
    if (!tokens) {
      const error = `No token usage metadata found in API response for call #${this.callIndex}`;
      debugLogger.error(phase, 'TOKEN_EXTRACTION_FAILED', error);
      throw new Error(error);
    }

    // Calculate real cost
    const cost = calculateRealCost(model, tokens.input, tokens.output, imageCount);

    // Update phase totals
    const phaseKey = `phase${phase}` as keyof typeof this.phaseCosts;
    this.phaseCosts[phaseKey].cost += cost;
    this.phaseCosts[phaseKey].calls++;
    this.phaseCosts[phaseKey].input += tokens.input;
    this.phaseCosts[phaseKey].output += tokens.output;

    // Log token usage
    debugLogger.tokenUsage(phase, `API Call #${this.callIndex} (${model})`, tokens.input, tokens.output, cost);

    return {
      input: tokens.input,
      output: tokens.output,
      cost
    };
  }

  /**
   * Get cost for a specific phase
   */
  getPhaseCost(phase: number): TokenUsage & { calls: number } {
    const phaseKey = `phase${phase}` as keyof typeof this.phaseCosts;
    const phaseData = this.phaseCosts[phaseKey];

    return {
      input: phaseData.input,
      output: phaseData.output,
      cost: phaseData.cost,
      calls: phaseData.calls
    };
  }

  /**
   * Get total cost across all phases
   */
  getTotalCost(): number {
    return Object.values(this.phaseCosts).reduce((sum, phase) => sum + phase.cost, 0);
  }

  /**
   * Get total API calls across all phases
   */
  getTotalCalls(): number {
    return Object.values(this.phaseCosts).reduce((sum, phase) => sum + phase.calls, 0);
  }

  /**
   * Get total tokens across all phases
   */
  getTotalTokens(): { input: number; output: number } {
    const totals = Object.values(this.phaseCosts).reduce(
      (sum, phase) => ({
        input: sum.input + phase.input,
        output: sum.output + phase.output
      }),
      { input: 0, output: 0 }
    );

    return totals;
  }

  /**
   * Get detailed cost breakdown for all phases
   */
  getDetailedCosts(): ExtractionCosts {
    const totalTokens = this.getTotalTokens();

    return {
      phase1: {
        cost: this.phaseCosts.phase1.cost,
        calls: this.phaseCosts.phase1.calls,
        tokens: {
          input: this.phaseCosts.phase1.input,
          output: this.phaseCosts.phase1.output
        }
      },
      phase2: {
        cost: this.phaseCosts.phase2.cost,
        calls: this.phaseCosts.phase2.calls,
        tokens: {
          input: this.phaseCosts.phase2.input,
          output: this.phaseCosts.phase2.output
        }
      },
      phase3: {
        cost: this.phaseCosts.phase3.cost,
        calls: this.phaseCosts.phase3.calls,
        tokens: {
          input: this.phaseCosts.phase3.input,
          output: this.phaseCosts.phase3.output
        }
      },
      total: this.getTotalCost(),
      totalCalls: this.getTotalCalls(),
      totalTokens
    };
  }

  /**
   * Calculate cost per item
   */
  getCostPerItem(itemCount: number): number {
    if (itemCount === 0) return 0;
    return this.getTotalCost() / itemCount;
  }

  /**
   * Log phase cost summary
   */
  logPhaseCost(phase: number, description: string) {
    const phaseCost = this.getPhaseCost(phase);
    debugLogger.phaseCost(phase, description, phaseCost.cost, phaseCost.calls);
  }

  /**
   * Log final cost summary
   */
  logFinalCost() {
    const costs = this.getDetailedCosts();
    debugLogger.totalCost(costs.total, costs.totalCalls, costs.totalTokens);
  }

  /**
   * Reset all counters (for testing)
   */
  reset() {
    this.phaseCosts = {
      phase1: { cost: 0, calls: 0, input: 0, output: 0 },
      phase2: { cost: 0, calls: 0, input: 0, output: 0 },
      phase3: { cost: 0, calls: 0, input: 0, output: 0 }
    };
    this.callIndex = 0;
  }

  /**
   * Validate that we have real costs (no zeros from missing token data)
   */
  validateRealCosts(): boolean {
    const totalCalls = this.getTotalCalls();
    const totalTokens = this.getTotalTokens();

    if (totalCalls > 0 && (totalTokens.input === 0 || totalTokens.output === 0)) {
      debugLogger.warn(0, 'COST_VALIDATION_WARNING', 'Some API calls recorded zero tokens - possible missing usage metadata');
      return false;
    }

    return true;
  }
}