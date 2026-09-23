import { describe, expect, it } from 'vitest';
import { isTooSimilar, jaccardSimilarity, textSimilarity, toTokenSet } from '../src/content/deduplication.js';

describe('deduplication', () => {
  it('treats semantically equivalent phrasings as highly similar', () => {
    const a = 'What is a hypervisor?';
    const b = 'Understanding hypervisors';
    const c = 'How hypervisors work';

    expect(textSimilarity(a, b)).toBeGreaterThan(0.3);
    expect(textSimilarity(a, c)).toBeGreaterThan(0.3);
  });

  it('treats unrelated topics as dissimilar', () => {
    const a = 'What is a hypervisor?';
    const b = 'Terraform state explained';
    expect(textSimilarity(a, b)).toBeLessThan(0.3);
  });

  it('computes jaccard similarity as intersection over union', () => {
    const a = toTokenSet('docker container image');
    const b = toTokenSet('docker container registry');
    // intersection {docker, container} = 2, union {docker, container, image, registry} = 4
    expect(jaccardSimilarity(a, b)).toBeCloseTo(0.5, 5);
  });

  it('identical strings have similarity 1', () => {
    expect(textSimilarity('Kubernetes namespaces', 'Kubernetes namespaces')).toBe(1);
  });

  it('isTooSimilar respects the threshold', () => {
    const existing = ['Kubernetes namespaces explained'];
    expect(isTooSimilar('Kubernetes namespaces overview', existing, 0.3)).toBe(true);
    expect(isTooSimilar('Terraform modules deep dive', existing, 0.3)).toBe(false);
  });
});
