// @vitest-environment node
import { renderToStaticMarkup } from 'react-dom/server';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import messages from '@/messages/en-US.json';
import { setPathname } from '@/test/navigation-mock';

const getSession = vi.fn();
vi.mock('@/lib/session', () => ({ getSession: () => getSession() }));
vi.mock('next/navigation', async (importOriginal) =>
  (await import('@/test/navigation-mock')).navigationMock(await importOriginal<object>()),
);

import { requireSessionOrPrompt } from './require-session';

describe('error-pages › Expired session is not a refusal', () => {
  beforeEach(() => {
    getSession.mockReset();
    setPathname('/en-US/cart');
  });

  it('an expired or absent session yields the sign-in card with the route preserved, not an access-denied page', async () => {
    getSession.mockResolvedValue({ locale: 'en-US' });
    const gate = await requireSessionOrPrompt('cart');
    expect(gate.signedIn).toBe(false);
    if (gate.signedIn) return;
    const html = renderToStaticMarkup(
      <NextIntlClientProvider locale="en-US" messages={messages}>
        {gate.prompt}
      </NextIntlClientProvider>,
    );
    expect(html).toContain('Sign in to view your cart.');
    expect(html).toContain('/en-US/login?next=%2Fen-US%2Fcart');
    expect(html).not.toMatch(/denied|forbidden|not allowed|do not have access/i);
  });

  it('a signed-in session passes through with the customer id and no prompt', async () => {
    getSession.mockResolvedValue({ customerId: 'c1' });
    expect(await requireSessionOrPrompt('cart')).toEqual({ signedIn: true, customerId: 'c1' });
  });
});
