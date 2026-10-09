import { afterEach, describe, expect, it, vi } from 'vitest';
import { HttpError, fetchJson, isUnauthorized } from '@/lib/http';
import { setPathname } from '@/test/navigation-mock';
import { renderWithProviders, screen } from '@/test/utils';

vi.mock('next/navigation', async (importOriginal) =>
  (await import('@/test/navigation-mock')).navigationMock(await importOriginal<object>()),
);

import { SignInOnUnauthorized } from './SignInOnUnauthorized';

describe('error-pages › Expired session is not a refusal', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('an API 401 shows the sign-in card for this route instead of the content', async () => {
    setPathname('/en-US/cart');
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ error: 'Please sign in to continue.' }, { status: 401 })));
    let caught: unknown;
    try {
      await fetchJson('/api/cart');
    } catch (error) {
      caught = error;
    }
    expect(isUnauthorized(caught)).toBe(true);
    renderWithProviders(
      <SignInOnUnauthorized error={caught} reason="cart">
        <p>cart content</p>
      </SignInOnUnauthorized>,
    );
    expect(screen.queryByText('cart content')).not.toBeInTheDocument();
    expect(screen.getByText('Sign in to view your cart.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/en-US/login?next=%2Fen-US%2Fcart');
  });

  it('other errors and no error render the children (a 403 or 500 is not turned into a sign-in prompt)', () => {
    renderWithProviders(
      <SignInOnUnauthorized error={new HttpError(500, '')} reason="cart">
        <p>cart content</p>
      </SignInOnUnauthorized>,
    );
    expect(screen.getByText('cart content')).toBeInTheDocument();
    expect(isUnauthorized(new HttpError(403, ''))).toBe(false);
    expect(isUnauthorized(undefined)).toBe(false);
  });
});
