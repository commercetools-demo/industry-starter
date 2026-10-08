import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import useSWR from 'swr';
import { KEY_CART } from '@/lib/cache-keys';
import { SwrProvider } from './SwrProvider';

function Count({ fetcher }: { fetcher: () => Promise<{ itemCount: number }> }) {
  const { data } = useSWR<{ itemCount: number }>(KEY_CART, fetcher, { revalidateOnMount: false });
  return <span data-testid="count">{data ? data.itemCount : 'loading'}</span>;
}

describe('storefront-data-loading: Signed-in first paint', () => {
  it('the cart count renders from the fallback on the first render, with no loading flash', () => {
    const fetcher = vi.fn(async () => ({ itemCount: 0 }));
    render(
      <SwrProvider fallback={{ [KEY_CART]: { itemCount: 3 } }}>
        <Count fetcher={fetcher} />
      </SwrProvider>,
    );
    expect(screen.getByTestId('count').textContent).toBe('3');
    expect(fetcher).not.toHaveBeenCalled();
  });
});
