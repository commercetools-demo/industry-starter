// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { IMAGE_HOSTS, assertAllowedImageHost, isAllowedImageUrl } from './images';

describe('image configuration', () => {
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
