// @vitest-environment node
import { describe, expect, it } from 'vitest';
import deMessages from '@/messages/de-DE.json';
import enMessages from '@/messages/en-US.json';
import { IMAGE_HOSTS, PEXELS_URL, assertAllowedImageHost, imageLabel, isAllowedImageUrl } from './images';

describe('image configuration', () => {
  it('Credit shown to the buyer: image labels name the photographer or Pexels and footer.photoCredit exists in both locales', () => {
    expect(imageLabel('Ada Lovelace')).toBe('Photo: Ada Lovelace via Pexels');
    expect(imageLabel(null)).toBe('Photo via Pexels');
    expect(imageLabel('')).toBe('Photo via Pexels');
    expect(enMessages.footer.photoCredit).toBe('Photos from Pexels');
    expect(deMessages.footer.photoCredit).toBe('Fotos von Pexels');
    expect(PEXELS_URL).toBe('https://www.pexels.com');
  });

  it('Image URL not trusted blindly: only allow-listed https hosts pass, seeder and next.config agree', async () => {
    expect(isAllowedImageUrl('https://images.pexels.com/photos/1/a.jpg')).toBe(true);
    expect(isAllowedImageUrl('https://media.istockphoto.com/id/1/photo/a.jpg')).toBe(true);
    expect(isAllowedImageUrl('http://images.pexels.com/a.jpg')).toBe(false);
    expect(isAllowedImageUrl('https://evil.example/a.jpg')).toBe(false);
    expect(isAllowedImageUrl('https://images.pexels.com.evil.example/a.jpg')).toBe(false);
    expect(isAllowedImageUrl('not a url')).toBe(false);
    expect(() => assertAllowedImageHost('https://evil.example/a.jpg')).toThrow(/rejected/);
    expect(() => assertAllowedImageHost('https://images.pexels.com/a.jpg')).not.toThrow();
    const config = (await import('../../next.config')).default;
    const hostnames = (config.images?.remotePatterns ?? []).map((pattern) => (pattern instanceof URL ? pattern.hostname : pattern.hostname));
    for (const host of IMAGE_HOSTS) expect(hostnames).toContain(host);
  });
});
