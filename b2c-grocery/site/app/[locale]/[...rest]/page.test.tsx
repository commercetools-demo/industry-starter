import { vi } from 'vitest';

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NOT_FOUND');
  },
}));

import CatchAllPage from './page';

describe('catch-all page', () => {
  it('Unknown locale URL: calls notFound', () => {
    expect(() => CatchAllPage()).toThrow('NOT_FOUND');
  });
});
