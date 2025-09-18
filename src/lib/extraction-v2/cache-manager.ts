/**
 * Cache Manager for Gemini Explicit Caching
 * Manages content caches to reduce costs and improve performance in the 3-phase extraction pipeline
 */

import { GoogleAICacheManager } from '@google/generative-ai/server';
import { debugLogger } from './utils/debug-logger';

export interface CacheInfo {
  name: string;
  uri: string;
  model: string;
  createdAt: Date;
  expiresAt: Date;
  tokenCount: number;
  purpose: 'system-prompt' | 'document' | 'structure';
  jobId?: string;
}

export interface CacheStats {
  totalCaches: number;
  activeCaches: number;
  expiredCaches: number;
  totalTokensSaved: number;
  costSavings: number;
}

export class GeminiCacheManager {
  private cacheManager: GoogleAICacheManager;
  private activeCaches: Map<string, CacheInfo> = new Map();
  private cacheStats: CacheStats = {
    totalCaches: 0,
    activeCaches: 0,
    expiredCaches: 0,
    totalTokensSaved: 0,
    costSavings: 0
  };

  constructor(apiKey: string) {
    this.cacheManager = new GoogleAICacheManager(apiKey);
    debugLogger.debug(0, 'CACHE_MANAGER_INITIALIZED', 'Gemini Cache Manager initialized');
  }

  /**
   * Create a cache for system prompts (long-lived, 24 hours)
   */
  async createSystemPromptCache(
    model: string,
    systemInstruction: string,
    purpose: string,
    ttl: string = '86400s' // 24 hours
  ): Promise<CacheInfo> {
    try {
      const cacheKey = `system-prompt-${purpose}-${model}`;

      // Check if cache already exists
      if (this.activeCaches.has(cacheKey)) {
        const existingCache = this.activeCaches.get(cacheKey)!;
        if (existingCache.expiresAt > new Date()) {
          debugLogger.debug(0, 'CACHE_HIT', `Using existing system prompt cache: ${cacheKey}`);
          return existingCache;
        }
      }

      debugLogger.debug(0, 'CACHE_CREATE_START', `Creating system prompt cache: ${cacheKey}`);

      const cache = await this.cacheManager.create({
        model: model,
        systemInstruction: systemInstruction,
        ttl: ttl
      });

      const cacheInfo: CacheInfo = {
        name: cache.name,
        uri: `cache://${cache.name}`,
        model: model,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + this.parseTTL(ttl)),
        tokenCount: this.estimateTokens(systemInstruction),
        purpose: 'system-prompt'
      };

      this.activeCaches.set(cacheKey, cacheInfo);
      this.updateStats();

      debugLogger.success(0, 'CACHE_CREATE_SUCCESS',
        `Created system prompt cache: ${cacheKey} (${cacheInfo.tokenCount} tokens)`);

      return cacheInfo;

    } catch (error) {
      debugLogger.error(0, 'CACHE_CREATE_FAILED',
        `Failed to create system prompt cache: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Create a cache for documents (job-specific, 2 hours)
   */
  async createDocumentCache(
    model: string,
    contents: any[],
    jobId: string,
    ttl: string = '7200s' // 2 hours
  ): Promise<CacheInfo> {
    try {
      const cacheKey = `document-${jobId}-${model}`;

      debugLogger.debug(0, 'CACHE_CREATE_START', `Creating document cache: ${cacheKey}`);

      const cache = await this.cacheManager.create({
        model: model,
        contents: contents,
        ttl: ttl
      });

      const cacheInfo: CacheInfo = {
        name: cache.name,
        uri: `cache://${cache.name}`,
        model: model,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + this.parseTTL(ttl)),
        tokenCount: this.estimateContentTokens(contents),
        purpose: 'document',
        jobId: jobId
      };

      this.activeCaches.set(cacheKey, cacheInfo);
      this.updateStats();

      debugLogger.success(0, 'CACHE_CREATE_SUCCESS',
        `Created document cache: ${cacheKey} (${cacheInfo.tokenCount} tokens)`);

      return cacheInfo;

    } catch (error) {
      debugLogger.error(0, 'CACHE_CREATE_FAILED',
        `Failed to create document cache: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Create a cache for menu structure (phase-specific, 1 hour)
   */
  async createStructureCache(
    model: string,
    structure: any,
    jobId: string,
    ttl: string = '3600s' // 1 hour
  ): Promise<CacheInfo> {
    try {
      const cacheKey = `structure-${jobId}-${model}`;

      debugLogger.debug(0, 'CACHE_CREATE_START', `Creating structure cache: ${cacheKey}`);

      const cache = await this.cacheManager.create({
        model: model,
        contents: [{
          role: 'user',
          parts: [{ text: JSON.stringify(structure) }]
        }],
        ttl: ttl
      });

      const cacheInfo: CacheInfo = {
        name: cache.name,
        uri: `cache://${cache.name}`,
        model: model,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + this.parseTTL(ttl)),
        tokenCount: this.estimateTokens(JSON.stringify(structure)),
        purpose: 'structure',
        jobId: jobId
      };

      this.activeCaches.set(cacheKey, cacheInfo);
      this.updateStats();

      debugLogger.success(0, 'CACHE_CREATE_SUCCESS',
        `Created structure cache: ${cacheKey} (${cacheInfo.tokenCount} tokens)`);

      return cacheInfo;

    } catch (error) {
      debugLogger.error(0, 'CACHE_CREATE_FAILED',
        `Failed to create structure cache: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Get a cached content by key
   */
  async getCachedContent(cacheKey: string): Promise<CacheInfo | null> {
    try {
      const cacheInfo = this.activeCaches.get(cacheKey);

      if (!cacheInfo) {
        debugLogger.debug(0, 'CACHE_MISS', `No cache found for key: ${cacheKey}`);
        return null;
      }

      // Check if cache is expired
      if (cacheInfo.expiresAt <= new Date()) {
        debugLogger.debug(0, 'CACHE_EXPIRED', `Cache expired for key: ${cacheKey}`);
        this.activeCaches.delete(cacheKey);
        this.updateStats();
        return null;
      }

      debugLogger.debug(0, 'CACHE_HIT', `Cache hit for key: ${cacheKey}`);
      return cacheInfo;

    } catch (error) {
      debugLogger.error(0, 'CACHE_GET_FAILED',
        `Failed to get cache: ${(error as Error).message}`);
      return null;
    }
  }

  /**
   * Delete a specific cache
   */
  async deleteCache(cacheKey: string): Promise<boolean> {
    try {
      const cacheInfo = this.activeCaches.get(cacheKey);

      if (!cacheInfo) {
        debugLogger.debug(0, 'CACHE_DELETE_SKIP', `No cache to delete for key: ${cacheKey}`);
        return false;
      }

      await this.cacheManager.delete(cacheInfo.name);
      this.activeCaches.delete(cacheKey);
      this.updateStats();

      debugLogger.success(0, 'CACHE_DELETE_SUCCESS', `Deleted cache: ${cacheKey}`);
      return true;

    } catch (error) {
      debugLogger.error(0, 'CACHE_DELETE_FAILED',
        `Failed to delete cache: ${(error as Error).message}`);
      return false;
    }
  }

  /**
   * Clean up expired caches
   */
  async cleanupExpiredCaches(): Promise<number> {
    const now = new Date();
    const expiredKeys: string[] = [];

    for (const [key, cacheInfo] of this.activeCaches) {
      if (cacheInfo.expiresAt <= now) {
        expiredKeys.push(key);
      }
    }

    let deletedCount = 0;
    for (const key of expiredKeys) {
      if (await this.deleteCache(key)) {
        deletedCount++;
      }
    }

    if (deletedCount > 0) {
      debugLogger.success(0, 'CACHE_CLEANUP_COMPLETE',
        `Cleaned up ${deletedCount} expired caches`);
    }

    return deletedCount;
  }

  /**
   * Clean up all caches for a specific job
   */
  async cleanupJobCaches(jobId: string): Promise<number> {
    const jobCacheKeys: string[] = [];

    for (const [key, cacheInfo] of this.activeCaches) {
      if (cacheInfo.jobId === jobId) {
        jobCacheKeys.push(key);
      }
    }

    let deletedCount = 0;
    for (const key of jobCacheKeys) {
      if (await this.deleteCache(key)) {
        deletedCount++;
      }
    }

    if (deletedCount > 0) {
      debugLogger.success(0, 'JOB_CACHE_CLEANUP',
        `Cleaned up ${deletedCount} caches for job ${jobId}`);
    }

    return deletedCount;
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): CacheStats {
    return { ...this.cacheStats };
  }

  /**
   * Track cache usage for cost calculations
   */
  trackCacheUsage(cacheInfo: CacheInfo, requestTokens: number): void {
    const tokensSaved = Math.min(cacheInfo.tokenCount, requestTokens);
    this.cacheStats.totalTokensSaved += tokensSaved;

    // Rough cost calculation (Flash model pricing)
    const costSavings = tokensSaved * (0.075 / 1_000_000);
    this.cacheStats.costSavings += costSavings;

    debugLogger.debug(0, 'CACHE_USAGE_TRACKED',
      `Saved ${tokensSaved} tokens, $${costSavings.toFixed(6)} cost`);
  }

  /**
   * Private helper methods
   */
  private updateStats(): void {
    this.cacheStats.totalCaches = this.activeCaches.size;
    this.cacheStats.activeCaches = Array.from(this.activeCaches.values())
      .filter(cache => cache.expiresAt > new Date()).length;
    this.cacheStats.expiredCaches = this.cacheStats.totalCaches - this.cacheStats.activeCaches;
  }

  private parseTTL(ttl: string): number {
    // Parse TTL string like "3600s" to milliseconds
    const match = ttl.match(/^(\d+)([smhd])$/);
    if (!match) throw new Error(`Invalid TTL format: ${ttl}`);

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 's': return value * 1000;
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      case 'd': return value * 24 * 60 * 60 * 1000;
      default: throw new Error(`Unknown TTL unit: ${unit}`);
    }
  }

  private estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  private estimateContentTokens(contents: any[]): number {
    // Estimate tokens for content array
    let totalTokens = 0;

    for (const content of contents) {
      if (content.parts) {
        for (const part of content.parts) {
          if (part.text) {
            totalTokens += this.estimateTokens(part.text);
          } else if (part.fileData) {
            totalTokens += 1000; // Rough estimate for file content
          }
        }
      }
    }

    return totalTokens;
  }
}

// Global cache manager instance
export let cacheManager: GeminiCacheManager;

/**
 * Initialize the global cache manager
 */
export function initializeCacheManager(apiKey: string): void {
  cacheManager = new GeminiCacheManager(apiKey);
  debugLogger.debug(0, 'CACHE_MANAGER_GLOBAL_INIT', 'Global cache manager initialized');
}

/**
 * Get the global cache manager instance
 */
export function getCacheManager(): GeminiCacheManager {
  if (!cacheManager) {
    throw new Error('Cache manager not initialized. Call initializeCacheManager() first.');
  }
  return cacheManager;
}