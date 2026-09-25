import type { GeneratedPost } from '../types.js';

const SCENE_BY_CATEGORY: Record<string, string> = {
  Virtualization: 'indoor data center server racks with cool blue LED lighting',
  'Cloud Computing': 'a long aisle of server cabinets inside a modern data center',
  Networking: 'colorful ethernet cables plugged into a network switch in a server rack',
  Kubernetes: 'rows of densely packed servers in a cloud data center',
  Containers: 'shipping containers at a port stacked in organized rows',
  Linux: 'a well-lit server room with rackmount computers and blinking status lights',
  DevOps: 'a modern data center operations room with server racks in the background',
  DevSecOps: 'a locked server cage and network racks in a secure data center',
  Terraform: 'infrastructure cables and labeled patch panels in a data center',
  Ansible: 'organized server racks and cable management in a computer room',
  AWS: 'a large cloud data center hall filled with server cabinets',
  'Microsoft Azure': 'a modern enterprise data center aisle with white and blue lighting',
};

/**
 * Concrete photo subject so fallback image APIs do not invent landscapes.
 */
export function visualSceneFor(post: Pick<GeneratedPost, 'topic' | 'category'>): string {
  return SCENE_BY_CATEGORY[post.category] ?? `indoor data center equipment related to ${post.topic}`;
}

/**
 * Prompt for a professional feed image. No overlaid text: LinkedIn already
 * shows the post copy, and generated text in images is usually misspelled.
 */
export function buildImagePrompt(post: GeneratedPost): string {
  const scene = visualSceneFor(post);
  return [
    `Photorealistic photograph of ${scene}.`,
    `The photo must illustrate "${post.topic}" (${post.category}): ${post.keywords.slice(0, 4).join(', ') || post.topic}.`,
    'Indoor technical / infrastructure setting only.',
    'Not a landscape, not the sky, not mountains, not nature, not a city skyline from afar.',
    'No readable text, logos, watermarks, brand names, or identifiable faces.',
    '16:9 landscape, documentary tech photography, sharp focus.',
  ].join(' ');
}

export function buildImageAltText(post: GeneratedPost): string {
  return `Professional photograph illustrating ${post.topic}`;
}
