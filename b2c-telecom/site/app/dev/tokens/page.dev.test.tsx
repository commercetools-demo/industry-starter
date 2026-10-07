import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import TokensPage from './page.dev';

describe('/dev/tokens', () => {
  it('renders the six sections', () => {
    const { container } = render(<TokensPage />);
    for (const id of ['colors', 'type', 'actions', 'brand-surfaces', 'radius-shadow', 'danger']) {
      expect(container.querySelector(`section#${id}`), id).not.toBeNull();
    }
  });

  it('Actions are pink: the CTA sample uses bg-action, hover:bg-action-hover and rounded-pill', () => {
    const { container } = render(<TokensPage />);
    const cta = container.querySelector('#actions button');
    expect(cta).not.toBeNull();
    for (const className of ['bg-action', 'hover:bg-action-hover', 'rounded-pill', 'text-text-on-pink']) {
      expect(cta?.classList.contains(className), className).toBe(true);
    }
  });

  it('never uses white text', () => {
    const { container } = render(<TokensPage />);
    expect(container.querySelector('[class*="text-white"], [class*="text-neutral-0"]')).toBeNull();
  });

  it('is a page only in development (dev.tsx page extension)', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.resetModules();
    const dev = (await import('../../../next.config')).default;
    expect(dev.pageExtensions).toContain('dev.tsx');
    vi.stubEnv('NODE_ENV', 'production');
    vi.resetModules();
    const prod = (await import('../../../next.config')).default;
    expect(prod.pageExtensions).not.toContain('dev.tsx');
    vi.unstubAllEnvs();
  });
});
