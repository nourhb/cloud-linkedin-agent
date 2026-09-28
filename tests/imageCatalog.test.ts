import { describe, expect, it } from 'vitest';
import { selectCatalogImage } from '../src/ai/imageCatalog.js';

describe('selectCatalogImage', () => {
  it('picks a networking photo for a DNS post', () => {
    const image = selectCatalogImage({
      topic: 'DNS fundamentals for cloud infrastructure',
      category: 'Networking',
      keywords: ['dns', 'networking', 'resolution'],
    });
    expect(image.categories.includes('Networking') || image.keywords.includes('dns')).toBe(true);
    expect(image.file.toLowerCase()).not.toContain('container park');
    expect(image.file.toLowerCase()).not.toContain('aisle front');
  });

  it('picks a container-yard photo for Docker posts', () => {
    const image = selectCatalogImage({
      topic: 'Understanding Docker images',
      category: 'Containers',
      keywords: ['docker', 'image', 'container'],
    });
    expect(image.file).toContain('Container Park');
  });

  it('picks a Linux workstation photo for Linux posts', () => {
    const image = selectCatalogImage({
      topic: 'Linux file permissions explained',
      category: 'Linux',
      keywords: ['linux', 'permissions', 'chmod'],
    });
    expect(image.categories).toContain('Linux');
  });
});
