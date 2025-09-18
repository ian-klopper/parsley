/**
 * Gemini Model Configuration for 3-Phase Extraction
 * Uses direct Google AI SDK to avoid Genkit wrapper issues
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

// Model pricing (per 1M tokens)
export const MODEL_PRICING = {
  pro: {
    input: 2.50 / 1_000_000,   // $2.50 per 1M input tokens (Gemini 2.5 Pro)
    output: 10.00 / 1_000_000  // $10.00 per 1M output tokens (Gemini 2.5 Pro)
  },
  flash: {
    input: 0.075 / 1_000_000,  // $0.075 per 1M input tokens
    output: 0.30 / 1_000_000   // $0.30 per 1M output tokens
  },
  flashLite: {
    input: 0.075 / 1_000_000,  // $0.075 per 1M input tokens (same as Flash)
    output: 0.30 / 1_000_000   // $0.30 per 1M output tokens
  }
};

// Rate limits per model (as of January 2025)
export const RATE_LIMITS = {
  pro: {
    rpm: 150,           // Requests per minute
    tpm: 2_000_000,     // Tokens per minute
    rpd: 10_000,        // Requests per day
    tpd: 5_000_000      // Tokens per day
  },
  flash: {
    rpm: 1_000,
    tpm: 1_000_000,
    rpd: 10_000,
    tpd: 3_000_000
  },
  flashLite: {
    rpm: 4_000,
    tpm: 4_000_000,
    rpd: null,          // No daily limit
    tpd: 10_000_000
  }
};

// Lazy initialization of Google AI SDK and models
let genAI: GoogleGenerativeAI | null = null;
let _models: {
  pro: any;
  flash: any;
  flashLite: any;
} | null = null;

function initializeModels(): { pro: any; flash: any; flashLite: any } {
  if (_models) return _models;

  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    throw new Error('GOOGLE_AI_API_KEY environment variable is required');
  }

  genAI = new GoogleGenerativeAI(apiKey);

  _models = {
    pro: genAI.getGenerativeModel({
      model: 'gemini-2.5-pro',
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 8000,  // Increased for Pro model
      }
    }),
    flash: genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 8000,
      }
    }),
    flashLite: genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',  // Use flash since flash-lite might not support caching
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 8000,
      }
    })
  };

  return _models;
}

// Export models with lazy initialization
export const models = new Proxy({} as any, {
  get(target, prop) {
    const initialized = initializeModels();
    return initialized[prop as keyof typeof initialized];
  }
});

export type ModelType = keyof typeof models;

/**
 * Calculate real cost from actual token usage
 */
export function calculateRealCost(model: ModelType, inputTokens: number, outputTokens: number, imageCount = 0): number {
  const pricing = MODEL_PRICING[model];
  const inputCost = inputTokens * pricing.input;
  const outputCost = outputTokens * pricing.output;
  const imageCost = imageCount * 0.00025; // $0.00025 per image for all models

  return inputCost + outputCost + imageCost;
}

/**
 * Extract real token usage from Google AI SDK response
 */
export function extractTokenUsage(response: any): { input: number; output: number } | null {
  // Google AI SDK stores usage metadata in response.response.usageMetadata
  const usage = response.response?.usageMetadata || response.usageMetadata;

  if (!usage) {
    console.warn('No token usage metadata found in API response');
    return null;
  }

  const inputTokens = usage.promptTokenCount || 0;
  const outputTokens = usage.candidatesTokenCount || 0;

  return {
    input: inputTokens,
    output: outputTokens
  };
}

/**
 * Estimate tokens for text (used for batching, not costing)
 */
export function estimateTextTokens(text: string): number {
  // Rough estimation: ~4 characters per token
  return Math.ceil(text.length / 4);
}

/**
 * Estimate tokens for images (used for batching, not costing)
 */
export function estimateImageTokens(): number {
  // Base estimate for image processing
  return 1000;
}