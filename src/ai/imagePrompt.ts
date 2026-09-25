import type { GeneratedPost } from '../types.js';

/**
 * Prompt for a professional feed image. No overlaid text: LinkedIn already
 * shows the post copy, and generated text in images is usually misspelled.
 */
export function buildImagePrompt(post: GeneratedPost): string {
  return [
    `Create a photorealistic professional photograph for a LinkedIn post about "${post.topic}" in ${post.category}.`,
    'Landscape 16:9 composition, clean modern tech / cloud / infrastructure aesthetic.',
    'Looks like a real photograph or high-end product photo, not a cartoon and not a screenshot of a UI.',
    'No readable text, logos, watermarks, brand names, or people with identifiable faces.',
    `Visual subject should clearly relate to: ${post.keywords.slice(0, 4).join(', ') || post.topic}.`,
    'Soft natural lighting, shallow depth of field, suitable as a LinkedIn feed image.',
  ].join(' ');
}

export function buildImageAltText(post: GeneratedPost): string {
  return `Professional photograph illustrating ${post.topic}`;
}
