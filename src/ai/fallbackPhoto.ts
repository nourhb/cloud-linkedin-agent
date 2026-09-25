import { deflateSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { ClassifiedError } from '../types.js';
import { logger } from '../utils/logger.js';
import { visualSceneFor } from './imagePrompt.js';
import type { GeneratedImageAsset } from './aiClient.js';
import type { GeneratedPost } from '../types.js';

const USER_AGENT = 'CloudLinkedInAgent/1.0 (personal LinkedIn publishing bot; https://github.com/nourhb/cloud-linkedin-agent)';

/**
 * Free photo fallback when Gemini image models have no quota.
 * Prefers Wikimedia Commons (real, topic-relevant photos, no watermark),
 * then a short Pollinations prompt, then a local branded PNG.
 */
export async function fetchFallbackPhoto(
  _prompt: string,
  post: Pick<GeneratedPost, 'topic' | 'category'>,
): Promise<GeneratedImageAsset> {
  const scene = visualSceneFor(post);

  try {
    return await fetchWikimediaPhoto(scene);
  } catch (error) {
    logger.warn('Wikimedia photo lookup failed, trying generated photo', {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  try {
    return await fetchPollinationsPhoto(scene);
  } catch (error) {
    logger.warn('Generated photo fallback failed, synthesizing a local branded image', {
      error: error instanceof Error ? error.message : String(error),
    });
    return synthesizeBrandedPng(post.topic);
  }
}

async function fetchWikimediaPhoto(scene: string): Promise<GeneratedImageAsset> {
  const api = new URL('https://commons.wikimedia.org/w/api.php');
  api.searchParams.set('action', 'query');
  api.searchParams.set('format', 'json');
  api.searchParams.set('origin', '*');
  api.searchParams.set('generator', 'search');
  api.searchParams.set('gsrsearch', `filetype:bitmap ${scene}`);
  api.searchParams.set('gsrnamespace', '6');
  api.searchParams.set('gsrlimit', '8');
  api.searchParams.set('prop', 'imageinfo');
  api.searchParams.set('iiprop', 'url|mime|size');
  api.searchParams.set('iiurlwidth', '1200');

  const response = await fetch(api, { headers: { 'User-Agent': USER_AGENT } });
  if (!response.ok) {
    throw new ClassifiedError('AI_NETWORK_ERROR', `Wikimedia search HTTP ${response.status}`, { retryable: true });
  }

  const json = (await response.json()) as {
    query?: {
      pages?: Record<
        string,
        { imageinfo?: Array<{ mime?: string; thumburl?: string; url?: string }> }
      >;
    };
  };

  const pages = Object.values(json.query?.pages ?? {});
  for (const page of pages) {
    const info = page.imageinfo?.[0];
    const imageUrl = info?.thumburl ?? info?.url;
    const mime = info?.mime ?? '';
    if (!imageUrl || (!mime.includes('jpeg') && !mime.includes('jpg') && !mime.includes('png'))) {
      continue;
    }
    return downloadImage(imageUrl);
  }

  throw new ClassifiedError('AI_INVALID_RESPONSE', `No Wikimedia photo found for "${scene}".`);
}

async function fetchPollinationsPhoto(scene: string): Promise<GeneratedImageAsset> {
  const prompt = `${scene}, indoor, documentary tech photography, no text, no watermark, no sky, no landscape`;
  const url = new URL('https://image.pollinations.ai/prompt/' + encodeURIComponent(prompt));
  url.searchParams.set('width', '1200');
  url.searchParams.set('height', '628');
  url.searchParams.set('nologo', 'true');
  url.searchParams.set('nofeed', 'true');
  url.searchParams.set('model', 'flux');

  const response = await fetch(url, { headers: { Accept: 'image/*', 'User-Agent': USER_AGENT } });
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

async function downloadImage(url: string): Promise<GeneratedImageAsset> {
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!response.ok) {
    throw new ClassifiedError('AI_NETWORK_ERROR', `Image download HTTP ${response.status}`, { retryable: true });
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < 100) {
    throw new ClassifiedError('AI_INVALID_RESPONSE', 'Downloaded image was empty.');
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
