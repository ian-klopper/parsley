/**
 * Cache Usage Tracker
 * Tracks cache performance, hit rates, and cost savings across extraction pipeline
 */

import { debugLogger } from './debug-logger';

export interface CacheUsageEvent {
  timestamp: Date;
  cacheKey: string;
  action: 'hit' | 'miss' | 'create' | 'delete';
  tokensSaved?: number;
  costSaved?: number;
  phase?: number;
  jobId?: string;
}

export interface CachePerformanceReport {
  totalRequests: number;
  cacheHits: number;
  cacheMisses: number;
  hitRate: number;
  totalTokensSaved: number;
  totalCostSaved: number;
  averageTokensSavedPerHit: number;
  cachesByPurpose: {
    'system-prompt': number;
    'document': number;
    'structure': number;
  };
  phaseBreakdown: {
    phase1: { hits: number; misses: number; tokensSaved: number };
    phase2: { hits: number; misses: number; tokensSaved: number };
    phase3: { hits: number; misses: number; tokensSaved: number };
  };
}

export class CacheTracker {
  private events: CacheUsageEvent[] = [];
  private sessionStart: Date = new Date();

  /**
   * Record a cache hit
   */
  recordCacheHit(
    cacheKey: string,
    tokensSaved: number,
    costSaved: number,
    phase?: number,
    jobId?: string
  ): void {
    const event: CacheUsageEvent = {
      timestamp: new Date(),
      cacheKey,
      action: 'hit',
      tokensSaved,
      costSaved,
      phase,
      jobId
    };

    this.events.push(event);

    debugLogger.debug(0, 'CACHE_HIT_TRACKED',
      `Cache hit: ${cacheKey}, ${tokensSaved} tokens saved, $${costSaved.toFixed(6)}`);
  }

  /**
   * Record a cache miss
   */
  recordCacheMiss(cacheKey: string, phase?: number, jobId?: string): void {
    const event: CacheUsageEvent = {
      timestamp: new Date(),
      cacheKey,
      action: 'miss',
      phase,
      jobId
    };

    this.events.push(event);

    debugLogger.debug(0, 'CACHE_MISS_TRACKED', `Cache miss: ${cacheKey}`);
  }

  /**
   * Record cache creation
   */
  recordCacheCreate(cacheKey: string, jobId?: string): void {
    const event: CacheUsageEvent = {
      timestamp: new Date(),
      cacheKey,
      action: 'create',
      jobId
    };

    this.events.push(event);

    debugLogger.debug(0, 'CACHE_CREATE_TRACKED', `Cache created: ${cacheKey}`);
  }

  /**
   * Record cache deletion
   */
  recordCacheDelete(cacheKey: string, jobId?: string): void {
    const event: CacheUsageEvent = {
      timestamp: new Date(),
      cacheKey,
      action: 'delete',
      jobId
    };

    this.events.push(event);

    debugLogger.debug(0, 'CACHE_DELETE_TRACKED', `Cache deleted: ${cacheKey}`);
  }

  /**
   * Generate comprehensive performance report
   */
  generateReport(): CachePerformanceReport {
    const hits = this.events.filter(e => e.action === 'hit');
    const misses = this.events.filter(e => e.action === 'miss');
    const totalRequests = hits.length + misses.length;

    const totalTokensSaved = hits.reduce((sum, event) => sum + (event.tokensSaved || 0), 0);
    const totalCostSaved = hits.reduce((sum, event) => sum + (event.costSaved || 0), 0);

    // Count caches by purpose
    const cachesByPurpose = {
      'system-prompt': this.events.filter(e => e.cacheKey.includes('system-prompt')).length,
      'document': this.events.filter(e => e.cacheKey.includes('document')).length,
      'structure': this.events.filter(e => e.cacheKey.includes('structure')).length
    };

    // Phase breakdown
    const phaseBreakdown = {
      phase1: this.getPhaseStats(1),
      phase2: this.getPhaseStats(2),
      phase3: this.getPhaseStats(3)
    };

    return {
      totalRequests,
      cacheHits: hits.length,
      cacheMisses: misses.length,
      hitRate: totalRequests > 0 ? (hits.length / totalRequests) * 100 : 0,
      totalTokensSaved,
      totalCostSaved,
      averageTokensSavedPerHit: hits.length > 0 ? totalTokensSaved / hits.length : 0,
      cachesByPurpose,
      phaseBreakdown
    };
  }

  /**
   * Get cache statistics for a specific job
   */
  getJobStats(jobId: string): {
    hits: number;
    misses: number;
    tokensSaved: number;
    costSaved: number;
  } {
    const jobEvents = this.events.filter(e => e.jobId === jobId);
    const hits = jobEvents.filter(e => e.action === 'hit');
    const misses = jobEvents.filter(e => e.action === 'miss');

    return {
      hits: hits.length,
      misses: misses.length,
      tokensSaved: hits.reduce((sum, event) => sum + (event.tokensSaved || 0), 0),
      costSaved: hits.reduce((sum, event) => sum + (event.costSaved || 0), 0)
    };
  }

  /**
   * Print detailed performance report
   */
  printReport(): void {
    const report = this.generateReport();

    console.log('\n╔════════════════════════════════════════╗');
    console.log('║           CACHE PERFORMANCE REPORT    ║');
    console.log('╠════════════════════════════════════════╣');
    console.log(`║ Session duration: ${this.getSessionDuration()}                   ║`);
    console.log(`║ Total requests:   ${report.totalRequests.toString().padStart(8)}           ║`);
    console.log(`║ Cache hits:       ${report.cacheHits.toString().padStart(8)}           ║`);
    console.log(`║ Cache misses:     ${report.cacheMisses.toString().padStart(8)}           ║`);
    console.log(`║ Hit rate:         ${report.hitRate.toFixed(1).padStart(6)}%          ║`);
    console.log('║                                        ║');
    console.log(`║ Tokens saved:     ${report.totalTokensSaved.toString().padStart(8)}           ║`);
    console.log(`║ Cost saved:       $${report.totalCostSaved.toFixed(6).padStart(7)}          ║`);
    console.log(`║ Avg per hit:      ${Math.round(report.averageTokensSavedPerHit).toString().padStart(8)} tokens    ║`);
    console.log('║                                        ║');
    console.log('║ CACHE TYPES:                           ║');
    console.log(`║ System prompts:   ${report.cachesByPurpose['system-prompt'].toString().padStart(8)}           ║`);
    console.log(`║ Documents:        ${report.cachesByPurpose['document'].toString().padStart(8)}           ║`);
    console.log(`║ Structures:       ${report.cachesByPurpose['structure'].toString().padStart(8)}           ║`);
    console.log('║                                        ║');
    console.log('║ PHASE BREAKDOWN:                       ║');
    console.log(`║ Phase 1: ${report.phaseBreakdown.phase1.hits}H/${report.phaseBreakdown.phase1.misses}M (${report.phaseBreakdown.phase1.tokensSaved} tokens) ║`);
    console.log(`║ Phase 2: ${report.phaseBreakdown.phase2.hits}H/${report.phaseBreakdown.phase2.misses}M (${report.phaseBreakdown.phase2.tokensSaved} tokens) ║`);
    console.log(`║ Phase 3: ${report.phaseBreakdown.phase3.hits}H/${report.phaseBreakdown.phase3.misses}M (${report.phaseBreakdown.phase3.tokensSaved} tokens) ║`);
    console.log('╚════════════════════════════════════════╝\n');
  }

  /**
   * Clear all tracked events
   */
  clearStats(): void {
    this.events = [];
    this.sessionStart = new Date();
    debugLogger.debug(0, 'CACHE_STATS_CLEARED', 'Cache tracking statistics cleared');
  }

  /**
   * Get events for analysis
   */
  getEvents(): CacheUsageEvent[] {
    return [...this.events];
  }

  /**
   * Export tracking data as JSON
   */
  exportData(): string {
    return JSON.stringify({
      sessionStart: this.sessionStart,
      events: this.events,
      report: this.generateReport()
    }, null, 2);
  }

  /**
   * Private helper methods
   */
  private getPhaseStats(phase: number): { hits: number; misses: number; tokensSaved: number } {
    const phaseEvents = this.events.filter(e => e.phase === phase);
    const hits = phaseEvents.filter(e => e.action === 'hit');
    const misses = phaseEvents.filter(e => e.action === 'miss');

    return {
      hits: hits.length,
      misses: misses.length,
      tokensSaved: hits.reduce((sum, event) => sum + (event.tokensSaved || 0), 0)
    };
  }

  private getSessionDuration(): string {
    const duration = Date.now() - this.sessionStart.getTime();
    const minutes = Math.floor(duration / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}m`;
  }
}

// Global cache tracker instance
export const globalCacheTracker = new CacheTracker();