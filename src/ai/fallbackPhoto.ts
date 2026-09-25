import { deflateSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { ClassifiedError } from '../types.js';
import { logger } from '../utils/logger.js';
import type { GeneratedImageAsset } from './aiClient.js';

/**
 * Free photo fallback when Gemini image models have no quota.
 * Pollinations returns an AI photograph from the same prompt; if that
 * fails we synthesize a branded 1200x628 PNG locally so publishing
 * never depends on a paid image API.
 */
export async function fetchFallbackPhoto(prompt: string, topic: string): Promise<GeneratedImageAsset> {
  try {
    return await fetchPollinationsPhoto(prompt);
  } catch (error) {
    logger.warn('Public photo fallback failed, synthesizing a local branded image', {
      error: error instanceof Error ? error.message : String(error),
    });
    return synthesizeBrandedPng(topic);
  }
}

async function fetchPollinationsPhoto(prompt: string): Promise<GeneratedImageAsset> {
  const url = new URL('https://image.pollinations.ai/prompt/' + encodeURIComponent(prompt.slice(0, 400)));
  url.searchParams.set('width', '1200');
  url.searchParams.set('height', '628');
  url.searchParams.set('nologo', 'true');
  url.searchParams.set('model', 'flux');

  let response: Response;
  try {
    response = await fetch(url, { headers: { Accept: 'image/*' } });
  } catch (error) {
    throw new ClassifiedError('AI_NETWORK_ERROR', `Photo fallback network error: ${(error as Error).message}`, {
      retryable: true,
      cause: error,
    });
  }

  if (!response.ok) {
    throw new ClassifiedError('AI_NETWORK_ERROR', `Photo fallback HTTP ${response.status}`, { retryable: true });
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < 100) {
    throw new ClassifiedError('AI_INVALID_RESPONSE', 'Photo fallback returned an empty image.');
  }

  const contentType = response.headers.get('content-type') ?? '';
  const mimeType: GeneratedImageAsset['mimeType'] = contentType.includes('png')
    ? 'image/png'
    : contentType.includes('gif')
      ? 'image/gif'
      : 'image/jpeg';

  return { bytes, mimeType };
}

/** Minimal RGB PNG so a post still gets an image with zero network. */
export function synthesizeBrandedPng(topic: string): GeneratedImageAsset {
  const width = 1200;
  const height = 628;
  const hash = createHash('sha256').update(topic).digest();
  const r1 = hash[0] ?? 20;
  const g1 = hash[1] ?? 40;
  const b1 = hash[2] ?? 80;
  const r2 = hash[3] ?? 80;
  const g2 = hash[4] ?? 140;
  const b2 = hash[5] ?? 200;

  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    const row = y * (width * 3 + 1);
    raw[row] = 0;
    const t = y / (height - 1);
    for (let x = 0; x < width; x++) {
      const s = x / (width - 1);
      const i = row + 1 + x * 3;
      raw[i] = Math.round(r1 * (1 - t) * (1 - s) + r2 * t + 30 * s);
      raw[i + 1] = Math.round(g1 * (1 - t) + g2 * t);
      raw[i + 2] = Math.round(b1 * (1 - s) + b2 * s);
    }
  }

  const compressed = deflateSync(raw);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;

  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);

  return { bytes: png, mimeType: 'image/png' };
}

function pngChunk(type: string, data: Buffer): Buffer {
  const typeBuf = Buffer.from(type, 'ascii');
  const crcInput = Buffer.concat([typeBuf, data]);
  const crc = crc32(crcInput);
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  typeBuf.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc, 8 + data.length);
  return chunk;
}

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buf) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}
