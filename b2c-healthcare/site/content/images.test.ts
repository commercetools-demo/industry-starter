import { describe, expect, it } from 'vitest';
import siteImages from '@/scripts/seed/data/site-images.json';
import { SEED_SLOT_NAMES, SITE_IMAGE_SLOTS, siteImage } from './images';

describe('design-home-page: site image slots', () => {
  it('the typed slots are exactly the seed slots', () => {
    expect([...SITE_IMAGE_SLOTS]).toEqual(SEED_SLOT_NAMES);
  });

  it('every slot of the committed file has a clean URL (no query, no fragment) or is absent', () => {
    for (const slot of SITE_IMAGE_SLOTS) {
      const raw = (siteImages as Record<string, { url?: string } | undefined>)[slot];
      if (raw?.url) expect(raw.url).toMatch(/^https:\/\/[^?#]+$/);
      const image = siteImage(slot);
      if (image) expect(image.url).toMatch(/^https:\/\/[^?#]+$/);
    }
  });

  it('a stored URL with a query string is rejected, a clean one is returned without any credit (D-040)', () => {
    const images = {
      'home-hero': { url: 'https://images.example/a.jpg?w=800', photographer: 'P' },
      'home-cta': { url: 'https://images.example/b.jpg', photographer: 'Q' },
    };
    expect(siteImage('home-hero', images)).toBeNull();
    expect(siteImage('home-cta', images)).toEqual({ url: 'https://images.example/b.jpg' });
  });

  it('an empty file gives null for every slot (placeholders, never an invented URL)', () => {
    for (const slot of SITE_IMAGE_SLOTS) expect(siteImage(slot, {})).toBeNull();
  });
});
