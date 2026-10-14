/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { afterEach, describe, expect, it } from 'vitest';
import { listTokens } from '@/lib/dev/token-list';
import { THEME_STORAGE_KEY } from '@/lib/theme-init';
import TokenSpecimen from './page.dev';

afterEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
});

describe('token specimen page', () => {
  it('Specimen lists every colour token', () => {
    render(<TokenSpecimen />);
    const rendered = screen.getAllByTestId(/^swatch-/).map((el) => el.dataset.testid);
    expect(rendered).toEqual(listTokens().colors.map((t) => `swatch-${t}`));
    expect(rendered.length).toBeGreaterThan(150);
  });

  it('Specimen uses var() only', () => {
    const { container } = render(<TokenSpecimen />);
    for (const el of container.querySelectorAll<HTMLElement>('[style]')) {
      const style = el.getAttribute('style') ?? '';
      expect(style).not.toMatch(/#|rgb/);
    }
  });

  it('Top bar uses the topbar token', () => {
    render(<TokenSpecimen />);
    const bar = screen.getByTestId('topbar');
    expect(bar).toHaveClass('bg-bg-topbar');
    expect(bar).toHaveClass('text-text-on');
    expect(screen.getByTestId('surface-card')).toHaveClass('bg-bg-surface');
  });

  it('Toggle sets data-theme', async () => {
    render(<TokenSpecimen />);
    document.documentElement.dataset.theme = 'light';
    await userEvent.click(screen.getByTestId('toggle-theme'));
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    await userEvent.click(screen.getByTestId('toggle-theme'));
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('Specimen has no accessibility violations', async () => {
    const { container } = render(<TokenSpecimen />);
    expect(await axe(container, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } })).toHaveNoViolations();
  });
});
