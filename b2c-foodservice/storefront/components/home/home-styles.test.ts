import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => readFileSync(join(process.cwd(), file), 'utf8');
const flatten = (value: unknown, prefix = ''): string[] =>
  value && typeof value === 'object'
    ? Object.entries(value as Record<string, unknown>).flatMap(([k, v]) => flatten(v, prefix ? `${prefix}.${k}` : k))
    : [prefix];

describe('home messages and styles (O-09)', () => {
  it('catalogues have the same home keys', () => {
    const us = JSON.parse(read('messages/en-US.json')).home;
    const ca = JSON.parse(read('messages/en-CA.json')).home;
    expect(flatten(ca).sort()).toEqual(flatten(us).sort());
    expect(flatten(us).length).toBeGreaterThan(30);
  });

  it('entrance animation is disabled under reduced motion', () => {
    // The hero uses `fade-up`, which only animates inside prefers-reduced-motion: no-preference; content is visible without it.
    const motion = read('app/motion.css');
    const fadeUp = motion.slice(motion.indexOf('@utility fade-up'));
    expect(fadeUp.slice(0, fadeUp.indexOf('\n}\n'))).toContain('prefers-reduced-motion: no-preference');
    const home = read('app/home.css');
    expect(home).not.toMatch(/animation:/);
    expect(read('components/home/Hero.tsx')).toContain('fade-up');
  });

  it('home surfaces use tokens only', () => {
    expect(read('app/home.css')).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(/);
  });
});
