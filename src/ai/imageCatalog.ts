import type { GeneratedPost } from '../types.js';

/**
 * Hand-picked Wikimedia Commons photos. Random Commons search and
 * Pollinations produced irrelevant landscapes; this catalog is the only
 * fallback source for post images.
 */
export interface CatalogImage {
  file: string;
  categories: string[];
  keywords: string[];
}

export const IMAGE_CATALOG: CatalogImage[] = [
  {
    file: 'Network Aisle Front.jpg',
    categories: ['Cloud Computing', 'Virtualization', 'AWS', 'Microsoft Azure', 'DevOps', 'Terraform', 'Ansible'],
    keywords: ['cloud', 'datacenter', 'region', 'availability', 'iaas', 'vpc', 'autoscaling'],
  },
  {
    file: 'Wikimedia_Foundation_Servers-8055_05.jpg',
    categories: ['Cloud Computing', 'Virtualization', 'AWS', 'Microsoft Azure', 'Kubernetes'],
    keywords: ['server', 'hypervisor', 'vm', 'cluster', 'node'],
  },
  {
    file: 'Technician with laptop working on server rack at NERSC.jpg',
    categories: ['DevOps', 'Linux', 'Virtualization'],
    keywords: ['troubleshooting', 'operations', 'linux', 'admin', 'systemd'],
  },
  {
    file: 'EFTA00002629 - Server rack with multiple networking devices and cables connected showing a typical data center setup.jpg',
    categories: ['Networking', 'Cloud Computing', 'DevOps'],
    keywords: ['load balancer', 'networking', 'dns', 'subnet', 'tcp', 'udp'],
  },
  {
    file: 'EFTA00002518 - Server rack with multiple hard drives and network cables connected in a data center environment.jpg',
    categories: ['Cloud Computing', 'DevOps'],
    keywords: ['storage', 'object storage', 'volume', 'disk', 'backup'],
  },
  {
    file: 'Network switches.jpg',
    categories: ['Networking'],
    keywords: ['switch', 'ethernet', 'vlan', 'layer4', 'layer7', 'dns', 'tcp'],
  },
  {
    file: 'Network Device (Switch).jpg',
    categories: ['Networking', 'Kubernetes'],
    keywords: ['service', 'ingress', 'cni', 'routing', 'networking'],
  },
  {
    file: 'Optical_fibre.jpg',
    categories: ['Networking'],
    keywords: ['fiber', 'bandwidth', 'latency', 'networking'],
  },
  {
    file: 'Barbados Port Inc Container Park Bridgetown 0251.jpg',
    categories: ['Containers', 'Kubernetes'],
    keywords: ['container', 'docker', 'image', 'pod', 'registry'],
  },
  {
    file: 'Arch Linux system update via pacman on an Acer laptop.jpg',
    categories: ['Linux'],
    keywords: ['linux', 'filesystem', 'permissions', 'chmod', 'process'],
  },
  {
    file: 'Computer motherboard 2.jpg',
    categories: ['DevSecOps', 'Linux'],
    keywords: ['security', 'scanning', 'sbom', 'secrets', 'hardware'],
  },
  {
    file: 'ThinkPad_X220.jpg',
    categories: ['Linux', 'DevOps'],
    keywords: ['gitops', 'pipeline', 'ci/cd', 'laptop', 'engineering'],
  },
];

export function selectCatalogImage(
  post: Pick<GeneratedPost, 'topic' | 'category'> & { keywords?: string[] },
): CatalogImage {
  const haystack = [post.topic, post.category, ...(post.keywords ?? [])].join(' ').toLowerCase();
  const ranked = IMAGE_CATALOG.map((image) => ({ image, score: scoreImage(image, post.category, haystack) }))
    .sort((a, b) => b.score - a.score || a.image.file.localeCompare(b.image.file));

  const topScore = ranked[0]?.score ?? 0;
  const top = ranked.filter((entry) => entry.score === topScore).map((entry) => entry.image);
  const pool = top.length > 0 ? top : IMAGE_CATALOG;
  return pool[simpleHash(post.topic) % pool.length]!;
}

function scoreImage(image: CatalogImage, category: string, haystack: string): number {
  let score = 0;
  if (image.categories.includes(category)) score += 6;
  for (const keyword of image.keywords) {
    if (haystack.includes(keyword.toLowerCase())) score += 3;
  }
  return score;
}

function simpleHash(text: string): number {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  return hash;
}
