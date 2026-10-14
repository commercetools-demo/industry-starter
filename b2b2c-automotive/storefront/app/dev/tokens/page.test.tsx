// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { render } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { readTokenList } from '@/lib/dev/token-list';

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
}));

import TokenSpecimen from './page';

describe('Styling from the automotive tokens: specimen page', () => {
  it('Specimen lists every colour token', async () => {
    const { container } = render(await TokenSpecimen());
    const ids = [...container.querySelectorAll('[data-testid^="swatch-color-"]')].map((e) => e.getAttribute('data-testid'));
    expect(ids).toEqual(readTokenList().colors.map((t) => `swatch-${t}`));
    expect(ids.length).toBeGreaterThan(60);
  });
  it('Specimen uses var() only', async () => {
    const { container } = render(await TokenSpecimen());
    for (const el of container.querySelectorAll('[style]')) {
      const style = el.getAttribute('style') ?? '';
      expect(style).not.toMatch(/#|rgb|px/);
      expect(style).toMatch(/var\(--/);
    }
  });
  it('Specimen is not found in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    await expect(TokenSpecimen()).rejects.toThrow('NEXT_NOT_FOUND');
    vi.unstubAllEnvs();
  });
  it('Specimen has no accessibility violations', async () => {
    const { container } = render(await TokenSpecimen());
    expect(await axe(container, { rules: { 'color-contrast': { enabled: false } } })).toHaveNoViolations();
  });
});
