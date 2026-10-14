/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { describe, expect, it } from 'vitest';
import { checkReducedMotion } from './check-reduced-motion.mjs';
import { appRoot, tmp } from './test-utils.mjs';

const RULE = '@media (prefers-reduced-motion: reduce) {\n  *, ::before, ::after {\n    animation-duration: 0.01ms !important;\n    transition-duration: 0.01ms !important;\n    scroll-behavior: auto !important;\n  }\n}\n';

describe('reduced motion rule exists', () => {
  it('the app has the global rule and no animation outside it', () => {
    expect(checkReducedMotion(appRoot)).toEqual([]);
  });
  it('fails without the global rule', () => {
    expect(checkReducedMotion(tmp({ 'app/globals.css': 'body {}' })).join('')).toMatch(/missing the global/);
  });
  it('fails when the rule does not stop scrolling', () => {
    const css = RULE.replace('scroll-behavior: auto !important;', '');
    expect(checkReducedMotion(tmp({ 'app/globals.css': css })).join('')).toMatch(/scroll-behavior: auto/);
  });
  it('fails on smooth scrolling, an unguarded animation and autoplay', () => {
    const root = tmp({
      'app/globals.css': RULE,
      'components/A.tsx': 'export const A = () => <div className="scroll-smooth animate-pulse" />;',
      'components/B.tsx': 'export const B = () => <video autoPlay />;',
    });
    const text = checkReducedMotion(root).join('\n');
    expect(text).toMatch(/A\.tsx: smooth scrolling/);
    expect(text).toMatch(/A\.tsx: animation utility "animate-pulse"/);
    expect(text).toMatch(/B\.tsx: auto-playing/);
  });
  it('accepts motion-safe animations', () => {
    const root = tmp({ 'app/globals.css': RULE, 'components/A.tsx': 'export const A = () => <div className="motion-safe:animate-pulse" />;' });
    expect(checkReducedMotion(root)).toEqual([]);
  });
});
