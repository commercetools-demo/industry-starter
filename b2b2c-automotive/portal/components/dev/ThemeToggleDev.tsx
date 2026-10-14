'use client';

import { THEME_STORAGE_KEY } from '@/lib/theme-init';

/** Dev-only toggle for the specimen page. The product toggle belongs to workstream R. */
export function ThemeToggleDev() {
  const toggle = () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Storage may be unavailable; the attribute still applies for this page view.
    }
  };
  return (
    <button
      type="button"
      data-testid="toggle-theme"
      onClick={toggle}
      className="rounded-300 bg-bg-brand px-400 py-200 text-button-2 font-medium text-text-on hover:bg-bg-brand-hover"
    >
      Toggle theme
    </button>
  );
}
