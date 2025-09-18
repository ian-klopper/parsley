interface RateLimit {
  requestsPerMinute: number;
  tokensPerMinute: number;
}

const MODEL_LIMITS: Record<string, RateLimit> = {
  'gemini-2.5-pro': { requestsPerMinute: 2, tokensPerMinute: 32000 },
  'gemini-2.5-flash': { requestsPerMinute: 15, tokensPerMinute: 1000000 },
  'gemini-2.5-flash-lite': { requestsPerMinute: 15, tokensPerMinute: 1000000 }
};

export class GeminiRateLimiter {
  private requestQueue: Array<() => Promise<any>> = [];
  private isProcessing = false;
  private lastRequestTime = 0;
  private requestCount = 0;
  private tokenCount = 0;
  private resetTime = Date.now() + 60000; // Reset every minute

  constructor(private model: string) {}

  async enqueue<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push(async () => {
        try {
          const result = await this.executeWithLimit(fn);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      this.processQueue();
    });
  }

  private async executeWithLimit<T>(fn: () => Promise<T>): Promise<T> {
    const now = Date.now();

    // Reset counters if minute has passed
    if (now >= this.resetTime) {
      this.requestCount = 0;
      this.tokenCount = 0;
      this.resetTime = now + 60000;
    }

    const limits = MODEL_LIMITS[this.model];
    const timeSinceLastRequest = now - this.lastRequestTime;
    const minInterval = 60000 / limits.requestsPerMinute; // Min time between requests

    // Wait if we've hit rate limits
    if (this.requestCount >= limits.requestsPerMinute || timeSinceLastRequest < minInterval) {
      const waitTime = Math.max(minInterval - timeSinceLastRequest, 1000);
      console.log(`[RATE_LIMIT] ${this.model}: Waiting ${waitTime}ms for rate limit`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    // Estimate tokens (rough heuristic - adjust based on actual prompt size)
    const estimatedTokens = 1000; // Conservative estimate
    if (this.tokenCount + estimatedTokens > limits.tokensPerMinute) {
      const waitTime = this.resetTime - now;
      console.log(`[RATE_LIMIT] ${this.model}: Token limit reached, waiting ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    this.lastRequestTime = Date.now();
    this.requestCount++;
    this.tokenCount += estimatedTokens;

    console.log(`[RATE_LIMIT] ${this.model}: ${this.requestCount}/${limits.requestsPerMinute} requests, ${this.tokenCount}/${limits.tokensPerMinute} tokens`);

    return await fn();
  }

  private async processQueue() {
    if (this.isProcessing || this.requestQueue.length === 0) return;

    this.isProcessing = true;
    while (this.requestQueue.length > 0) {
      const task = this.requestQueue.shift()!;
      await task();
    }
    this.isProcessing = false;
  }

  getStats() {
    return {
      model: this.model,
      requestCount: this.requestCount,
      tokenCount: this.tokenCount,
      limits: MODEL_LIMITS[this.model],
      queueLength: this.requestQueue.length
    };
  }
}

// Export singleton instances
export const proRateLimiter = new GeminiRateLimiter('gemini-2.5-pro');
export const flashRateLimiter = new GeminiRateLimiter('gemini-2.5-flash');
export const flashLiteRateLimiter = new GeminiRateLimiter('gemini-2.5-flash-lite');