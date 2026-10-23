import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithIntl } from '@/test/render';

const notFound = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND');
});
vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  notFound: () => notFound(),
}));

import KitchenSink from './KitchenSink';
import Page from './page';

describe('Kitchen sink', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    notFound.mockClear();
  });

  it('Kitchen sink is 404 in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(() => render(<Page />)).toThrow('NEXT_NOT_FOUND');
    expect(notFound).toHaveBeenCalled();
  });

  it('Kitchen sink renders in development with every section', () => {
    vi.stubEnv('NODE_ENV', 'development');
    renderWithIntl(<Page />);
    for (const heading of [
      'Tokens', 'Type', 'Buttons', 'Chips', 'Fields', 'Options', 'Swatches', 'Stepper',
      'Cards and badges', 'Availability and rating', 'Drawer', 'Modal', 'Toast', 'Steps', 'Icons', 'Grid',
    ]) {
      expect(screen.getByRole('heading', { level: 2, name: heading })).toBeInTheDocument();
    }
    expect(notFound).not.toHaveBeenCalled();
  });

  it('Kitchen sink shows every icon at two sizes', () => {
    renderWithIntl(<KitchenSink />);
    expect(screen.getByText('capsule')).toBeInTheDocument();
    expect(document.querySelectorAll('svg[width="96"]').length).toBeGreaterThan(30);
  });
});
