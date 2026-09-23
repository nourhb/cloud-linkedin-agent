import { describe, expect, it } from 'vitest';
import { hashContent } from '../src/utils/hash.js';

describe('hashContent', () => {
  it('produces the same hash for identical content', () => {
    const text = 'Kubernetes namespaces let you split a cluster into logical groups.';
    expect(hashContent(text)).toBe(hashContent(text));
  });

  it('is insensitive to trivial whitespace/case differences (duplicate protection)', () => {
    const a = 'Kubernetes Namespaces let you split a cluster.';
    const b = '  kubernetes namespaces   let you split a cluster.  ';
    expect(hashContent(a)).toBe(hashContent(b));
  });

  it('produces different hashes for meaningfully different content', () => {
    const a = 'Kubernetes namespaces explained in depth.';
    const b = 'Terraform state explained in depth.';
    expect(hashContent(a)).not.toBe(hashContent(b));
  });

  it('returns a 64-character hex string (SHA-256)', () => {
    const hash = hashContent('any content');
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });
});
