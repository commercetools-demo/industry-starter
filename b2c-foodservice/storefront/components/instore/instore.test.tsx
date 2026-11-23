import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { MANIFEST_COLOURS, instoreManifest } from '@/lib/instore/manifest';
import type { InstoreCategoryView, InstoreRow } from '@/lib/instore/category';
import enCA from '@/messages/en-CA.json';
import enUS from '@/messages/en-US.json';
import { expectNoAxeViolations } from '@/test/axe';
import { viewCart, viewLine } from '@/test/cart';
import { podPage } from '@/test/pdp';
import { renderShell, stubFetch } from '@/test/shell';

vi.mock('@/i18n/routing', async () => (await import('@/test/shell')).routingMock());
vi.mock('next/image', () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

import InstoreBag from '@/components/instore/InstoreBag';
import InstoreCategory from '@/components/instore/InstoreCategory';
import InstoreHome from '@/components/instore/InstoreHome';
import InstoreProduct from '@/components/instore/InstoreProduct';
import InstoreShell from '@/components/instore/InstoreShell';
import { ScannerProvider } from '@/components/instore/scan/scanner-context';
import { parseSelection } from '@/lib/product/selection';

const base = { '/api/cart/count': () => ({ count: 0 }), '/api/cart': () => ({ cart: null }) };
const tree = [
  { id: 'c1', key: 'mcf-cat-coffee', name: 'Coffee', slug: 'coffee', children: [] },
  { id: 'c2', key: 'mcf-cat-pods', name: 'Pods', slug: 'pods', children: [] },
];
const drink = (over: Partial<InstoreRow>): InstoreRow => ({ id: 'p', slug: 's', sku: 'X', name: 'n', imageAlt: '', price: null, availability: null, ...over });
const drinks = [
  drink({ id: 'd1', slug: 'ready-iced-coffee', sku: 'MCF-RD-ICED-COFFEE-SMALL', name: 'Iced Coffee', availability: 'in' }),
  drink({ id: 'd2', slug: 'ready-espresso', sku: 'MCF-RD-ESPRESSO-SMALL', name: 'Hot Coffee', availability: 'in' }),
];

describe('In-store shell and home', () => {
  it('shows the In-store badge, a labelled camera button, the bag, no footer and no mega menu', async () => {
    stubFetch(base);
    const { container } = renderShell(
      <InstoreShell>
        <InstoreHome rows={drinks} />
      </InstoreShell>,
    );
    expect(screen.getByTestId('instore-badge')).toHaveTextContent('In-store');
    expect(screen.getByTestId('scan-header-button')).toHaveAccessibleName('Scan a barcode');
    expect(screen.getByTestId('scan-fab').className).toMatch(/h-16 w-16/);
    expect(screen.getByTestId('instore-bag-link')).toBeInTheDocument();
    expect(container.querySelector('footer')).toBeNull();
    expect(container.querySelector('nav')).toBeNull();
    await expectNoAxeViolations(container);
  });

  it('lists the coffee drinks themselves, no category tiles', () => {
    stubFetch(base);
    renderShell(
      <InstoreShell>
        <InstoreHome rows={drinks} />
      </InstoreShell>,
    );
    expect(screen.queryAllByTestId('instore-tile')).toHaveLength(0);
    expect(screen.getAllByTestId('instore-row').map((a) => a.getAttribute('href'))).toEqual([
      '/p/ready-iced-coffee/MCF-RD-ICED-COFFEE-SMALL',
      '/p/ready-espresso/MCF-RD-ESPRESSO-SMALL',
    ]);
  });

  it('says so when no drink is on the menu', () => {
    stubFetch(base);
    renderShell(
      <InstoreShell>
        <InstoreHome rows={[]} />
      </InstoreShell>,
    );
    expect(screen.getByText('No coffee is on the menu right now.')).toBeInTheDocument();
    expect(screen.queryAllByTestId('instore-row')).toHaveLength(0);
  });

  it('the camera button opens the scanner dialog', async () => {
    stubFetch(base);
    renderShell(
      <InstoreShell>
        <InstoreHome rows={drinks} />
      </InstoreShell>,
    );
    await userEvent.setup().click(screen.getByTestId('scan-hero-button'));
    expect(await screen.findByRole('dialog', { name: 'Scan a barcode' })).toBeInTheDocument();
  });
});

describe('In-store category page', () => {
  const row = (over: Partial<InstoreRow>): InstoreRow => ({ id: 'p', slug: 's', sku: 'X', name: 'n', imageAlt: '', price: null, availability: null, ...over });
  const view: InstoreCategoryView = {
    category: tree[1]!,
    parent: null,
    children: [],
    total: 2,
    page: 1,
    pageCount: 1,
    rows: [
      row({ id: 'p1', slug: 'ember', sku: 'MCF-1', name: 'Ember', price: { from: { centAmount: 590, currencyCode: 'USD' }, fromIsRange: true }, availability: 'in' }),
      row({ id: 'p2', slug: 'casa', sku: 'MCF-2', name: 'Casa', availability: 'out' }),
    ],
  };

  it('a row is image, name, price, availability and links to the product', async () => {
    const { container } = renderShell(<InstoreCategory view={view} rootKey="pods" />);
    const rows = screen.getAllByTestId('instore-row');
    expect(rows[0]).toHaveAttribute('href', '/p/ember/MCF-1');
    expect(rows[0]).toHaveTextContent('Ember');
    expect(rows[0]).toHaveTextContent('$5.90');
    expect(rows[0]).toHaveTextContent('In stock');
    expect(rows[1]).toHaveTextContent('Out of stock');
    expect(rows[0]?.className).toMatch(/min-h-24/);
    await expectNoAxeViolations(container);
  });
});

describe('In-store product page', () => {
  const lines = { '/api/cart/lines': () => ({ cart: { id: 'c', version: 2, count: 1, lines: [] } }) };

  it('has name, price, choices and add to bag; no collection, subscription or editorial', () => {
    stubFetch({ ...base, ...lines });
    const { container } = renderShell(<InstoreProduct data={podPage()} initialSelection={{}} />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Ember Ristretto');
    expect(screen.getByTestId('pdp-price')).toBeInTheDocument();
    expect(screen.getByTestId('add-to-bag')).toBeInTheDocument();
    expect(screen.queryByText(/Collect|Subscribe/i)).toBeNull();
    expect(screen.queryByText('A dark roast pod.')).toBeNull();
    expect(container.querySelector('footer')).toBeNull();
  });

  it('adds a delivery line', async () => {
    const t = stubFetch({ ...base, ...lines });
    const data = podPage();
    const sel = parseSelection({}, data.product.selectors, data.product.variants[0]);
    renderShell(<InstoreProduct data={data} initialSelection={sel} />);
    await userEvent.setup().click(screen.getByTestId('add-to-bag'));
    await waitFor(() => expect(t.calls.some((c) => c.url === '/api/cart/lines')).toBe(true));
    const body = JSON.parse(String(t.calls.find((c) => c.url === '/api/cart/lines')?.init?.body)) as Record<string, unknown>;
    expect(body).toMatchObject({ sku: 'POD-10', fulfilment: 'delivery' });
  });

  it('a ready-made coffee offers its modifiers and sends the chosen ones with the line', async () => {
    const OAT = '572a1c72-24e1-4a96-a693-d022be0cd867';
    const ALMOND = 'f8716393-8508-46cb-865a-7dac4731e22a';
    const t = stubFetch({ ...base, ...lines });
    const data = { ...podPage(), modifiers: [{ id: OAT, name: 'Oat milk' }, { id: ALMOND, name: 'Almond milk' }] };
    const sel = parseSelection({}, data.product.selectors, data.product.variants[0]);
    renderShell(<InstoreProduct data={data} initialSelection={sel} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Oat milk' }));
    expect(screen.getByRole('button', { name: 'Oat milk' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByTestId('add-to-bag'));
    await waitFor(() => expect(t.calls.some((c) => c.url === '/api/cart/lines')).toBe(true));
    const body = JSON.parse(String(t.calls.find((c) => c.url === '/api/cart/lines')?.init?.body)) as Record<string, unknown>;
    expect(body).toMatchObject({ sku: 'POD-10', fulfilment: 'delivery', modifiers: [OAT] });
  });
});

describe('In-store product page: coffee pod flavor', () => {
  const lines = { '/api/cart/lines': () => ({ cart: { id: 'c', version: 2, count: 1, lines: [] } }) };
  const OAT = '572a1c72-24e1-4a96-a693-d022be0cd867';
  const INTENSO = '6ffa00e9-1b2e-4cea-846f-8f045923fa49';
  const MELOZIO = '18141540-a157-4dc9-9156-cc91faa22401';
  const flavors = [
    { id: INTENSO, name: 'Intenso', description: 'Intenso is deep and dense, has a roast & intensity level of 9/11.' },
    { id: MELOZIO, name: 'Melozio', description: 'Melozio is smooth & balanced, has a roast & intensity level of 6/11.' },
  ];
  const page = () => {
    const data = { ...podPage(), modifiers: [{ id: OAT, name: 'Oat milk' }], flavors };
    return { data, sel: parseSelection({}, data.product.selectors, data.product.variants[0]) };
  };

  it('needs a flavor before the drink can be added, and shows its description when it is picked', async () => {
    stubFetch({ ...base, ...lines });
    const { data, sel } = page();
    renderShell(<InstoreProduct data={data} initialSelection={sel} />);
    const user = userEvent.setup();
    expect(screen.getByTestId('add-to-bag')).toBeDisabled();
    expect(screen.getByTestId('add-to-bag')).toHaveTextContent('Select a coffee pod flavor');
    expect(screen.getByTestId('flavor-description')).toHaveTextContent('');
    await user.click(screen.getByRole('radio', { name: 'Intenso' }));
    expect(screen.getByRole('radio', { name: 'Intenso' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('flavor-description')).toHaveTextContent('Intenso is deep and dense, has a roast & intensity level of 9/11.');
    await user.click(screen.getByRole('radio', { name: 'Melozio' }));
    expect(screen.getByRole('radio', { name: 'Intenso' })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByTestId('flavor-description')).toHaveTextContent('Melozio is smooth & balanced');
    expect(screen.getByTestId('add-to-bag')).toBeEnabled();
  });

  it('sends the flavor with the chosen modifiers', async () => {
    const t = stubFetch({ ...base, ...lines });
    const { data, sel } = page();
    renderShell(<InstoreProduct data={data} initialSelection={sel} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Oat milk' }));
    await user.click(screen.getByRole('radio', { name: 'Melozio' }));
    await user.click(screen.getByTestId('add-to-bag'));
    await waitFor(() => expect(t.calls.some((c) => c.url === '/api/cart/lines')).toBe(true));
    const body = JSON.parse(String(t.calls.find((c) => c.url === '/api/cart/lines')?.init?.body)) as { modifiers: string[] };
    expect([...body.modifiers].sort()).toEqual([OAT, MELOZIO].sort());
  });

  it('a drink whose configuration names no flavor shows no picker and adds as before', async () => {
    stubFetch({ ...base, ...lines });
    const data = { ...podPage(), modifiers: [{ id: OAT, name: 'Oat milk' }], flavors: [] };
    renderShell(<InstoreProduct data={data} initialSelection={parseSelection({}, data.product.selectors, data.product.variants[0])} />);
    expect(screen.queryByTestId('flavor-picker')).toBeNull();
    expect(screen.getByTestId('add-to-bag')).toBeEnabled();
  });
});

describe('In-store bag', () => {
  it('an empty bag offers the camera and browsing', () => {
    stubFetch(base);
    renderShell(<ScannerProvider><InstoreBag initialCart={null} /></ScannerProvider>);
    expect(screen.getByTestId('instore-empty-bag')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Browse/i })).toHaveAttribute('href', '/');
  });

  it('lists the lines with a total and a checkout link', async () => {
    stubFetch(base);
    const { container } = renderShell(<ScannerProvider><InstoreBag initialCart={viewCart([viewLine({ id: 'a', quantity: 2 })])} /></ScannerProvider>);
    expect(screen.getAllByTestId('bag-line')).toHaveLength(1);
    expect(screen.getByTestId('bag-total')).toHaveTextContent('$28.15');
    expect(screen.getByTestId('bag-checkout')).toHaveAttribute('href', '/checkout');
    await expectNoAxeViolations(container);
  });
});

describe('Manifest and messages', () => {
  it('manifest colours mirror tokens.css', () => {
    const css = readFileSync('app/instore.css', 'utf8').toLowerCase();
    expect(css).toContain(`--canvas: ${MANIFEST_COLOURS.background.toLowerCase()}`);
    expect(css).toContain(`--ink: ${MANIFEST_COLOURS.theme.toLowerCase()}`);
    expect(instoreManifest()).toMatchObject({ display: 'standalone', start_url: '/' });
  });

  it('the instore messages exist in both catalogues with the same keys', () => {
    const keys = (o: unknown, p = ''): string[] => (o && typeof o === 'object' ? Object.entries(o).flatMap(([k, v]) => keys(v, `${p}${k}.`)) : [p]);
    const us = keys((enUS as Record<string, unknown>).instore);
    expect(us.length).toBeGreaterThan(40);
    expect(keys((enCA as Record<string, unknown>).instore)).toEqual(us);
  });
});
