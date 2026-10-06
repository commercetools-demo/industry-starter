// @vitest-environment node
import { readFileSync } from 'node:fs';
import path from 'node:path';

const css = readFileSync(path.join(__dirname, 'organic-components.css'), 'utf8');

const classes = [
  '.btn', '.btn-primary', '.btn-secondary', '.btn-ghost', '.btn-icon', '.btn-block', '.field', '.input', '.radio', '.dot',
  '.seg', '.seg-opt', '.card', '.card-kicker', '.card-title', '.card-body', '.card-meta', '.elev-sm', '.elev-md', '.elev-lg',
  '.tag', '.tag-accent', '.tag-accent-2', '.tag-neutral', '.tag-outline', '.nav', '.nav-brand', '.table', '.dialog-backdrop',
  '.dialog', '.dialog-title', '.dialog-body', '.dialog-actions', '.washed', '.lift', '.blob', '.page', '.page-enter',
];

describe('organic-components.css', () => {
  it.each(classes)('defines %s', (c) => {
    expect(css).toContain(c);
  });

  it('uses no hex colours (tokens only)', () => {
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it.each(['.btn-primary:hover', '.btn-primary:active', '.btn-secondary:hover', '.btn-ghost:hover'])('has the themed state %s', (s) => {
    expect(css).toContain(s);
  });

  it('Reduced motion: the media block covers .lift, .page-enter and the keyframe animations', () => {
    const block = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
    expect(block).toContain('.lift');
    expect(block).toContain('.page-enter');
    expect(block).toContain('orgIn');
    expect(block).toContain('orgUp');
    expect(css).toMatch(/\.page-enter \{ animation: orgIn/);
    expect(css).toContain('@keyframes orgUp');
  });

  it('keeps the focus ring and selection rules in globals', () => {
    const globals = readFileSync(path.join(__dirname, 'globals.css'), 'utf8');
    expect(globals).toContain(':focus-visible { outline: 2px solid var(--color-accent)');
    expect(globals).toContain('::selection');
    expect(globals).toContain(':disabled');
  });
});
