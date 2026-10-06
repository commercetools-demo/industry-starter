import { DEFAULT_HERO_IMAGE_URL, getSiteConfig } from './site';

describe('getSiteConfig', () => {
  it('Editorial hero default: nothing set gives editorial with the contact strip on', () => {
    expect(getSiteConfig({})).toEqual({ homeLayout: 'editorial', contactStrip: true, heroImageUrl: DEFAULT_HERO_IMAGE_URL });
  });
  it('reads grid (any case, trimmed)', () => {
    expect(getSiteConfig({ HOME_LAYOUT: ' Grid ' }).homeLayout).toBe('grid');
  });
  it('invalid layout falls back to editorial', () => {
    expect(getSiteConfig({ HOME_LAYOUT: 'masonry' }).homeLayout).toBe('editorial');
    expect(getSiteConfig({ HOME_LAYOUT: '' }).homeLayout).toBe('editorial');
  });
  it('contact strip off for false, 0 and off', () => {
    for (const v of ['false', 'FALSE', '0', 'off']) expect(getSiteConfig({ HOME_CONTACT_STRIP: v }).contactStrip).toBe(false);
  });
  it('invalid contact strip value falls back to on', () => {
    expect(getSiteConfig({ HOME_CONTACT_STRIP: 'maybe' }).contactStrip).toBe(true);
    expect(getSiteConfig({ HOME_CONTACT_STRIP: 'true' }).contactStrip).toBe(true);
  });
  it('hero image: https URL accepted, anything else falls back', () => {
    expect(getSiteConfig({ HERO_IMAGE_URL: 'https://cdn.example.com/h.jpg' }).heroImageUrl).toBe('https://cdn.example.com/h.jpg');
    expect(getSiteConfig({ HERO_IMAGE_URL: 'javascript:alert(1)' }).heroImageUrl).toBe(DEFAULT_HERO_IMAGE_URL);
    expect(getSiteConfig({ HERO_IMAGE_URL: 'not a url' }).heroImageUrl).toBe(DEFAULT_HERO_IMAGE_URL);
  });
});
