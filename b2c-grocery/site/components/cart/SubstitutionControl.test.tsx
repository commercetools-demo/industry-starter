import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cartLine, makeCart, renderWithCart } from '@/test/cart';
import { SubstitutionControl } from './SubstitutionControl';

afterEach(() => vi.unstubAllGlobals());

const line = cartLine({ id: 'line-m', name: 'Whole milk 1 L', substitutionPreference: 'allow-similar' });

describe('SubstitutionControl', () => {
  it('shows the line preference and has an accessible name with the product', () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ cart: makeCart({ lines: [line] }) }))));
    renderWithCart(<SubstitutionControl line={line} />, { cart: makeCart({ lines: [line] }) });
    expect(screen.getByRole('radiogroup', { name: 'Substitution for Whole milk 1 L' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Allow similar' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'No substitution' })).not.toBeChecked();
  });

  it('Change preference: shows the new choice at once and sends it', async () => {
    const saved = { ...line, substitutionPreference: 'none' as const };
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => (release = r));
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'PATCH') await gate;
      return new Response(JSON.stringify({ cart: makeCart({ lines: [saved] }) }));
    });
    vi.stubGlobal('fetch', fetchMock);
    renderWithCart(<SubstitutionControl line={line} />, { cart: makeCart({ lines: [line] }) });
    fireEvent.click(screen.getByRole('radio', { name: 'No substitution' }));
    expect(screen.getByRole('radio', { name: 'No substitution' })).toBeChecked(); // optimistic
    release();
    await waitFor(() => {
      const call = fetchMock.mock.calls.find(([, init]) => init?.method === 'PATCH');
      expect(call?.[0]).toBe('/api/cart/line-items/line-m/substitution');
      expect(JSON.parse(String(call?.[1]?.body))).toEqual({ preference: 'none' });
    });
  });

  it('Failure: rolls back to the saved preference and says so', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) =>
        init?.method === 'PATCH' ? new Response(JSON.stringify({ error: 'CART_ERROR' }), { status: 500 }) : new Response(JSON.stringify({ cart: makeCart({ lines: [line] }) })),
      ),
    );
    renderWithCart(<SubstitutionControl line={line} />, { cart: makeCart({ lines: [line] }) });
    fireEvent.click(screen.getByRole('radio', { name: 'No substitution' }));
    await waitFor(() => expect(screen.getByRole('radio', { name: 'Allow similar' })).toBeChecked());
    expect(await screen.findByText('We could not update your bag. Please try again.')).toBeInTheDocument();
  });
});
