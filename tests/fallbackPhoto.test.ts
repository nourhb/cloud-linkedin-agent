import { describe, expect, it } from 'vitest';
import { synthesizeBrandedPng } from '../src/ai/fallbackPhoto.js';

describe('synthesizeBrandedPng', () => {
  it('returns a valid PNG whose size depends on the topic', () => {
    const image = synthesizeBrandedPng('What is a hypervisor?');
    expect(image.mimeType).toBe('image/png');
    expect(image.bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))).toBe(true);
    expect(image.bytes.length).toBeGreaterThan(200);
  });
});
