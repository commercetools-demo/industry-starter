import { screen, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { NextIntlClientProvider } from 'next-intl';
import { render } from '@testing-library/react';
import enMessages from '@/messages/en-US.json';
import { renderWithProviders } from '@/test/utils';
import { BundlePill, ConnectedBundlePill } from './BundlePill';

describe('BundlePill', () => {
  it('Bundle count counts plans and add-ons: renders My bundle · 3', () => {
    renderWithProviders(<BundlePill count={3} />);
    const link = screen.getByRole('link', { name: 'My bundle · 3' });
    expect(link).toHaveAttribute('href', '/en-US/bundle');
    expect(link).toHaveTextContent('My bundle · 3');
    expect(link).toHaveClass('bg-brand-950', 'rounded-pill');
  });

  it('Anonymous buyer: the pill shows My bundle without a count for an empty bundle', () => {
    renderWithProviders(<BundlePill count={0} />);
    expect(screen.getByRole('link', { name: 'My bundle' })).toHaveTextContent(/^My bundle$/);
  });

  it('de-DE text', () => {
    renderWithProviders(<BundlePill count={2} />, { locale: 'de-DE' });
    expect(screen.getByRole('link', { name: 'Mein Bundle · 2' })).toHaveAttribute('href', '/de-DE/bundle');
    expect(screen.queryByText('Mein Bundle')).not.toBeInTheDocument();
  });
});

describe('ConnectedBundlePill', () => {
  afterEach(() => vi.unstubAllGlobals());

  function renderConnected() {
    return render(
      <NextIntlClientProvider locale="en-US" messages={enMessages}>
        <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
          <ConnectedBundlePill />
        </SWRConfig>
      </NextIntlClientProvider>,
    );
  }

  it('shows My bundle while loading and for 0, then My bundle · 2 from the server cart', async () => {
    let resolve: (value: Response) => void = () => undefined;
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((r) => (resolve = r))));
    renderConnected();
    expect(screen.getByRole('link')).toHaveTextContent(/^My bundle$/);
    resolve(new Response(JSON.stringify({ cart: { itemCount: 2 } }), { status: 200, headers: { 'content-type': 'application/json' } }));
    await waitFor(() => expect(screen.getByRole('link')).toHaveTextContent('My bundle · 2'));
  });
});
