import { describe, expect, it } from 'vitest';
import { buildImageAltText, buildImagePrompt } from '../src/ai/imagePrompt.js';
import { buildCreatePostPayload } from '../src/linkedin/linkedinClient.js';
import type { GeneratedPost } from '../src/types.js';

const post: GeneratedPost = {
  topic: 'Type 1 vs Type 2 hypervisors',
  category: 'Virtualization',
  contentType: 'technical_explanation',
  hook: 'Hook',
  body: 'Body',
  hashtags: ['#Virtualization'],
  keywords: ['hypervisor', 'virtualization'],
};

describe('buildImagePrompt', () => {
  it('asks for a photorealistic indoor tech scene, not a landscape', () => {
    const prompt = buildImagePrompt(post);
    expect(prompt).toContain('Type 1 vs Type 2 hypervisors');
    expect(prompt).toContain('server racks');
    expect(prompt).toContain('Not a landscape');
  });

  it('builds concise alt text from the topic', () => {
    expect(buildImageAltText(post)).toBe('Professional photograph illustrating Type 1 vs Type 2 hypervisors');
  });
});

describe('buildCreatePostPayload', () => {
  it('attaches an image URN when one is provided', () => {
    const payload = buildCreatePostPayload({
      authorUrn: 'urn:li:person:abc',
      commentary: 'Hello',
      imageUrn: 'urn:li:image:xyz',
      imageTitle: 'Alt',
    });

    expect(payload.content).toEqual({
      media: {
        id: 'urn:li:image:xyz',
        title: 'Alt',
        altText: 'Alt',
      },
    });
  });

  it('omits content.media for text-only posts', () => {
    const payload = buildCreatePostPayload({
      authorUrn: 'urn:li:person:abc',
      commentary: 'Hello',
    });
    expect(payload.content).toBeUndefined();
  });
});
