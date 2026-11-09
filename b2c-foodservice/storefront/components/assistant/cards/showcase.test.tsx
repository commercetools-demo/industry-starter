// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';

const notFound = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
);
vi.mock('next/navigation', () => ({ notFound }));
vi.mock('next-intl/server', () => ({ setRequestLocale: () => {}, getMessages: async () => ({ assistant: { cards: {} } }) }));
vi.mock('@/components/assistant/cards/Showcase', () => ({ default: () => null }));

afterEach(() => {
  vi.unstubAllEnvs();
  notFound.mockClear();
});

describe('Showcase', () => {
  it('Showcase is a 404 in production', async () => {
    const { default: Page } = await import('@/app/[brand]/[locale]/assistant-showcase/page');
    for (const flag of [undefined, '', 'false', 'TRUE', '1']) {
      if (flag === undefined) vi.stubEnv('ASSISTANT_SHOWCASE', '');
      else vi.stubEnv('ASSISTANT_SHOWCASE', flag);
      notFound.mockClear();
      await expect(Page({ params: Promise.resolve({ brand: 'malva-coffee', locale: 'en-US' }) })).rejects.toThrow('NEXT_NOT_FOUND');
      expect(notFound).toHaveBeenCalledTimes(1);
    }
  });

  it('renders when the runtime flag is exactly true', async () => {
    vi.stubEnv('ASSISTANT_SHOWCASE', 'true');
    const { default: Page } = await import('@/app/[brand]/[locale]/assistant-showcase/page');
    await Page({ params: Promise.resolve({ brand: 'malva-coffee', locale: 'en-US' }) });
    expect(notFound).not.toHaveBeenCalled();
  });
});
