/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { THEME_STORAGE_KEY, themeInitScript } from './theme-init';

const run = () => new Function(themeInitScript)();

afterEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  vi.restoreAllMocks();
});

describe('theme init script', () => {
  it('Stored dark applies data-theme dark', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    run();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });
  it('Invalid value falls back to light', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'purple');
    run();
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });
  it('Nothing stored is light', () => {
    run();
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });
  it('Storage unavailable falls back to light', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    run();
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });
});
