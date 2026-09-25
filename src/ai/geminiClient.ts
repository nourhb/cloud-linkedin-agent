import { GoogleGenAI } from '@google/genai';
import { ClassifiedError } from '../types.js';
import { logger } from '../utils/logger.js';
import { fetchFallbackPhoto } from './fallbackPhoto.js';
import { GENERATED_POST_SCHEMA } from './promptBuilder.js';
import type { AiClient, GeneratedImageAsset } from './aiClient.js';

/**
 * Real Gemini client using the current official Google Gen AI SDK
 * (`@google/genai`, GA as of May 2025 - see README "Gemini setup" for the
 * source used to verify this at implementation time). The legacy
 * `@google/generative-ai` package is no longer actively maintained and is
 * intentionally NOT used here.
 */
export class GeminiClient implements AiClient {
  private readonly client: GoogleGenAI;
  private readonly model: string;
  private readonly imageModel: string;

  constructor(apiKey: string, model: string, imageModel: string) {
    this.client = new GoogleGenAI({ apiKey });
    this.model = model;
    this.imageModel = imageModel;
  }

  async generateJson(systemPrompt: string, userPrompt: string): Promise<string> {
    try {
      const response = await this.client.models.generateContent({
        model: this.model,
        contents: userPrompt,
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: 'application/json',
          responseSchema: GENERATED_POST_SCHEMA,
          temperature: 0.9,
        },
      });

      const text = response.text;
      if (!text) {
        throw new ClassifiedError('AI_INVALID_RESPONSE', 'Gemini response contained no text content.');
      }
      return text;
    } catch (error) {
      if (error instanceof ClassifiedError) throw error;
      throw classifyGeminiError(error);
    }
  }

  async generateImage(
    prompt: string,
    post: { topic: string; category: string } = { topic: 'cloud infrastructure', category: 'Cloud Computing' },
  ): Promise<GeneratedImageAsset> {
    try {
      return await this.generateWithGeminiImage(prompt);
    } catch (error) {
      logger.warn('Gemini image model unavailable, using free photo fallback', {
        imageModel: this.imageModel,
        error: error instanceof Error ? error.message.slice(0, 180) : String(error).slice(0, 180),
      });
      return fetchFallbackPhoto(prompt, post);
    }
  }

  private async generateWithGeminiImage(prompt: string): Promise<GeneratedImageAsset> {
    const response = await this.client.models.generateContent({
      model: this.imageModel,
      contents: prompt,
      config: {
        responseModalities: ['IMAGE', 'TEXT'],
      },
    });

    const parts = response.candidates?.[0]?.content?.parts ?? [];
    for (const part of parts) {
      const inline = part.inlineData;
      if (!inline?.data) continue;
      return {
        bytes: Buffer.from(inline.data, 'base64'),
        mimeType: normalizeImageMime(inline.mimeType),
      };
    }

    throw new ClassifiedError('AI_INVALID_RESPONSE', 'Gemini image response contained no image data.');
  }
}

function normalizeImageMime(mimeType: string | undefined): GeneratedImageAsset['mimeType'] {
  if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') return 'image/jpeg';
  if (mimeType === 'image/gif') return 'image/gif';
  return 'image/png';
}

function classifyGeminiError(error: unknown): ClassifiedError {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();

  if (lower.includes('429') || lower.includes('rate limit') || lower.includes('quota')) {
    return new ClassifiedError('AI_RATE_LIMIT', `Gemini rate limit/quota error: ${message}`, {
      retryable: true,
      cause: error,
    });
  }
  if (lower.includes('401') || lower.includes('403') || lower.includes('api key') || lower.includes('unauthorized')) {
    return new ClassifiedError('AI_AUTH_ERROR', `Gemini authentication error: ${message}`, {
      retryable: false,
      cause: error,
    });
  }
  if (lower.includes('network') || lower.includes('fetch failed') || lower.includes('econnreset') || lower.includes('timeout')) {
    return new ClassifiedError('AI_NETWORK_ERROR', `Gemini network error: ${message}`, {
      retryable: true,
      cause: error,
    });
  }
  return new ClassifiedError('UNKNOWN_ERROR', `Gemini request failed: ${message}`, {
    retryable: true,
    cause: error,
  });
}
