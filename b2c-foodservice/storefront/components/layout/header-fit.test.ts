import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// jsdom has no layout, so the "header never scrolls the page sideways" rule (FIX-1) is guarded at source level. The real
// measurement (scrollWidth === clientWidth at 320, 375, 840, 1080 px) is recorded in plans/evidence/O/README.md.
const read = (file: string) => readFileSync(join(__dirname, file), 'utf8');

describe('header fits the viewport (FIX-1)', () => {
  it('the wordmark gets smaller on tablets and narrow phones', () => {
    const css = readFileSync(join(__dirname, '../../app/typography.css'), 'utf8');
    for (const query of ['width < 1100px', 'width < 420px', 'width < 380px', 'width < 360px']) expect(css).toContain(query);
  });

  it('the store and locale pills collapse instead of pushing the actions off screen', () => {
    expect(read('StorePill.tsx')).toMatch(/min-w-0 shrink/);
    expect(read('StorePill.tsx')).toContain('max-[420px]:hidden');
    expect(read('LocalePill.tsx')).toContain('max-[380px]:hidden');
    expect(read('LocalePill.tsx')).toContain('max-[1100px]:hidden');
  });

  it('the primary links tighten below 1100px', () => {
    expect(read('PrimaryNav.tsx')).toContain('max-[1100px]:px-2');
  });
});
