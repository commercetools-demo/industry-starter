import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations } from '@/test/axe';
import { viewCart, viewLine } from '@/test/cart';
import { fakeEngine, notFoundBody, scanProduct } from '@/test/instore';
import { renderShell, stubFetch } from '@/test/shell';

vi.mock('@/i18n/routing', async () => (await import('@/test/shell')).routingMock());

import ScanDialog from '@/components/instore/scan/ScanDialog';

afterEach(() => vi.unstubAllGlobals());

type Routes = Parameters<typeof stubFetch>[0];

function setup(opts: { camera?: 'on' | 'denied' | 'none' | 'error'; routes?: Routes; open?: boolean } = {}) {
  const cam = fakeEngine(opts.camera ?? 'on');
  const onClose = vi.fn();
  const stub = stubFetch({
    '/api/cart/count': () => ({ count: 0 }),
    '/api/cart/lines': () => ({ cart: { id: 'c1', version: 2, count: 1, lines: [] } }),
    '/api/cart': () => ({ cart: null }),
    '/api/instore/scan': () => ({ product: scanProduct() }),
    ...opts.routes,
  });
  const view = renderShell(<ScanDialog open={opts.open ?? true} onClose={onClose} engine={cam.engine} />);
  const scans = () => stub.calls.filter((c) => c.url.startsWith('/api/instore/scan'));
  return { ...cam, stub, onClose, scans, ...view };
}

const type = async (value: string) => {
  const user = userEvent.setup();
  await user.type(screen.getByRole('textbox', { name: 'Or type the code' }), value);
  await user.click(screen.getByRole('button', { name: 'Look up' }));
};

describe('Scanner dialog: a successful scan', () => {
  it('shows image, name, variant attributes, price and availability, and adds to the bag', async () => {
    const t = setup();
    await waitFor(() => expect(t.state.starts).toBe(1));
    act(() => t.scan('MCF-POD-EMBER-50'));
    const result = await screen.findByTestId('scan-result');
    expect(result).toHaveTextContent('Ember Ristretto');
    expect(result).toHaveTextContent('Intensity 12 · 50 capsules');
    expect(screen.getByTestId('scan-price')).toHaveTextContent('$25.95');
    expect(result).toHaveTextContent('In stock');
    expect(result.querySelector('img')).not.toBeNull();
    expect(t.scans()[0]?.url).toBe('/api/instore/scan?sku=MCF-POD-EMBER-50');

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Increase quantity' }));
    expect(screen.getByTestId('scan-add')).toHaveTextContent('Add to bag - $51.90');
    await user.click(screen.getByTestId('scan-add'));
    expect(await screen.findByTestId('scan-added')).toHaveTextContent('Added 2 to your bag');
    const add = t.stub.calls.find((c) => c.url === '/api/cart/lines');
    expect(JSON.parse(String(add?.init?.body))).toEqual({ sku: 'MCF-POD-EMBER-50', quantity: 2, fulfilment: 'delivery' });
    expect(screen.getByRole('link', { name: 'View bag' })).toHaveAttribute('href', '/bag');
  });

  it('Scan another goes back to the camera and the next code works', async () => {
    const t = setup();
    act(() => t.scan('MCF-POD-EMBER-50'));
    await screen.findByTestId('scan-result');
    const user = userEvent.setup();
    await user.click(screen.getAllByRole('button', { name: 'Scan another' })[0] as HTMLElement);
    expect(screen.getByTestId('scan-sheet')).toHaveAttribute('data-result', 'none');
    act(() => t.scan('MCF-POD-CASA-10'));
    await waitFor(() => expect(t.scans()).toHaveLength(2));
    expect(t.scans()[1]?.url).toContain('MCF-POD-CASA-10');
  });

  it('a barcode with a symbology prefix and a line feed is read as the SKU', async () => {
    const t = setup();
    act(() => t.scan(']C1MCF-POD-EMBER-50\r\n'));
    await screen.findByTestId('scan-result');
    expect(t.scans()[0]?.url).toBe('/api/instore/scan?sku=MCF-POD-EMBER-50');
  });
});

describe('Scanner dialog: scanning the same code twice', () => {
  it('Same code seen many times in a second is one lookup and one result', async () => {
    const t = setup();
    act(() => {
      t.scan('MCF-POD-EMBER-50');
      t.scan('MCF-POD-EMBER-50');
      t.scan('MCF-POD-EMBER-50');
    });
    await screen.findByTestId('scan-result');
    act(() => t.scan('MCF-POD-EMBER-50'));
    expect(t.scans()).toHaveLength(1);
    expect(screen.getAllByTestId('scan-result')).toHaveLength(1);
  });

  it('a different code while a result is on screen is ignored until the shopper scans again', async () => {
    const t = setup();
    act(() => t.scan('MCF-POD-EMBER-50'));
    await screen.findByTestId('scan-result');
    act(() => t.scan('MCF-POD-CASA-10'));
    expect(t.scans()).toHaveLength(1);
  });
});

describe('Scanner dialog: the camera cannot be used', () => {
  it('Permission denied: says so, offers the camera again and manual entry', async () => {
    const t = setup({ camera: 'denied' });
    const problem = await screen.findByTestId('camera-problem');
    expect(problem).toHaveAttribute('data-camera', 'denied');
    expect(problem).toHaveTextContent('Camera access is off');
    expect(screen.getByRole('textbox', { name: 'Or type the code' })).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Try the camera again' }));
    await waitFor(() => expect(t.state.starts).toBe(2));
  });

  it('Permission denied: manual entry still finds the product', async () => {
    const t = setup({ camera: 'denied' });
    await screen.findByTestId('camera-problem');
    await type('MCF-POD-EMBER-50');
    expect(await screen.findByTestId('scan-result')).toHaveTextContent('Ember Ristretto');
    expect(t.scans()).toHaveLength(1);
  });

  it('No camera: says so, no retry button, manual entry offered', async () => {
    setup({ camera: 'none' });
    const problem = await screen.findByTestId('camera-problem');
    expect(problem).toHaveAttribute('data-camera', 'none');
    expect(problem).toHaveTextContent('No camera found');
    expect(screen.queryByRole('button', { name: 'Try the camera again' })).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Or type the code' })).toBeInTheDocument();
  });

  it('the camera is busy or broken: a generic message with a retry', async () => {
    setup({ camera: 'error' });
    const problem = await screen.findByTestId('camera-problem');
    expect(problem).toHaveTextContent('The camera could not start');
    expect(screen.getByRole('button', { name: 'Try the camera again' })).toBeInTheDocument();
  });
});

describe('Scanner dialog: codes that do not lead to a product', () => {
  it('Unknown SKU: says the shop does not sell it and goes back to scanning', async () => {
    const t = setup({ routes: { '/api/instore/scan': () => new Response(JSON.stringify(notFoundBody), { status: 404 }) } });
    act(() => t.scan('NOPE-1'));
    const unknown = await screen.findByTestId('scan-unknown');
    expect(unknown).toHaveTextContent("We don't know this code");
    expect(unknown).toHaveTextContent('NOPE-1 is not a product we sell');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Scan another' }));
    expect(screen.getByTestId('scan-sheet')).toHaveAttribute('data-result', 'none');
  });

  it('A code that is not shaped like a SKU is refused in the browser and never sent', async () => {
    const t = setup();
    act(() => t.scan('https://example.com/offer?x=1'));
    expect(await screen.findByTestId('scan-invalid')).toHaveTextContent('That is not one of our barcodes');
    expect(t.scans()).toHaveLength(0);
  });

  it('Manual entry of text that is not a SKU explains itself and sends nothing', async () => {
    const t = setup({ camera: 'none' });
    await type('not a code!');
    expect(await screen.findByText(/doesn't look like one of our codes/)).toBeInTheDocument();
    expect(t.scans()).toHaveLength(0);
  });

  it('the server cannot answer: a retry that works shows the product', async () => {
    let n = 0;
    const t = setup({
      routes: { '/api/instore/scan': () => (n++ === 0 ? new Response(JSON.stringify({ error: { code: 'internal_error', message: 'x' } }), { status: 500 }) : { product: scanProduct() }) },
    });
    act(() => t.scan('MCF-POD-EMBER-50'));
    const failed = await screen.findByTestId('scan-failed');
    expect(failed).toHaveTextContent("We couldn't look that up");
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByTestId('scan-result')).toHaveTextContent('Ember Ristretto');
  });
});

describe('Scanner dialog: availability', () => {
  it('Out of stock: add is not offered and the reason is given', async () => {
    const t = setup({ routes: { '/api/instore/scan': () => ({ product: scanProduct({ availability: { state: 'out', quantity: 0 } }) }) } });
    act(() => t.scan('MCF-POD-EMBER-50'));
    const blocked = await screen.findByTestId('scan-blocked');
    expect(blocked).toHaveAttribute('data-reason', 'outOfStock');
    expect(blocked).toHaveTextContent('Out of stock right now.');
    expect(screen.queryByTestId('scan-add')).not.toBeInTheDocument();
    expect(screen.getByTestId('scan-result')).toHaveTextContent('Out of stock');
  });

  it('a failed stock read never claims stock', async () => {
    const t = setup({ routes: { '/api/instore/scan': () => ({ product: scanProduct({ inventoryFailed: true, availability: { state: 'out', quantity: 0 } }) }) } });
    act(() => t.scan('MCF-POD-EMBER-50'));
    expect(await screen.findByTestId('scan-blocked')).toHaveAttribute('data-reason', 'stockUnknown');
    expect(screen.getByTestId('scan-result')).toHaveTextContent('Stock unknown');
  });

  it('a product with no price in this market cannot be added', async () => {
    const t = setup({ routes: { '/api/instore/scan': () => ({ product: scanProduct({ price: null }) }) } });
    act(() => t.scan('MCF-POD-EMBER-50'));
    expect(await screen.findByTestId('scan-blocked')).toHaveAttribute('data-reason', 'noPrice');
  });

  it('Low stock is said, and the stepper stops at the stock', async () => {
    const t = setup({ routes: { '/api/instore/scan': () => ({ product: scanProduct({ availability: { state: 'low', quantity: 2 }, maxQuantity: 2 }) }) } });
    act(() => t.scan('MCF-POD-EMBER-50'));
    await screen.findByTestId('scan-result');
    expect(screen.getByTestId('scan-result')).toHaveTextContent('Only a few left');
    const user = userEvent.setup();
    const more = screen.getByRole('button', { name: 'Increase quantity' });
    await user.click(more);
    await user.click(more);
    expect(screen.getByTestId('scan-add')).toHaveTextContent('Add to bag - $51.90');
    expect(screen.getByText('Only 2 available')).toBeInTheDocument();
  });

  it('what is already in the bag counts against the stock', async () => {
    const bag = viewCart([viewLine({ id: 'l1', sku: 'MCF-POD-EMBER-50', quantity: 2 })]);
    const t = setup({
      routes: {
        '/api/cart': () => ({ cart: bag }),
        '/api/instore/scan': () => ({ product: scanProduct({ availability: { state: 'low', quantity: 2 }, maxQuantity: 2 }) }),
      },
    });
    act(() => t.scan('MCF-POD-EMBER-50'));
    const blocked = await screen.findByTestId('scan-blocked');
    expect(blocked).toHaveAttribute('data-reason', 'allInBag');
  });

  it('shows how many are already in the bag', async () => {
    const bag = viewCart([viewLine({ id: 'l1', sku: 'MCF-POD-EMBER-50', quantity: 3 })]);
    const t = setup({ routes: { '/api/cart': () => ({ cart: bag }) } });
    act(() => t.scan('MCF-POD-EMBER-50'));
    expect(await screen.findByTestId('scan-in-bag')).toHaveTextContent('In your bag: 3');
  });
});

describe('Scanner dialog: lifecycle', () => {
  it('releases the camera when it closes', async () => {
    const t = setup();
    await waitFor(() => expect(t.state.starts).toBe(1));
    await waitFor(() => expect(t.state.stops).toBe(0));
    t.unmount();
    expect(t.state.stops).toBe(1);
  });

  it('a closed dialog starts no camera', () => {
    const t = setup({ open: false });
    expect(t.state.starts).toBe(0);
  });

  it('the test seam feeds the same handler as the camera, outside production only', async () => {
    const t = setup();
    await waitFor(() => expect(typeof window.__mcfInstoreScan).toBe('function'));
    act(() => window.__mcfInstoreScan?.('MCF-POD-EMBER-50'));
    await screen.findByTestId('scan-result');
    expect(t.scans()).toHaveLength(1);
    t.unmount();
    expect(window.__mcfInstoreScan).toBeUndefined();
  });

  it('is a modal dialog with a name, a 48 px close button and no accessibility violations', async () => {
    setup({ camera: 'denied' });
    const dialog = await screen.findByRole('dialog', { name: 'Scan a barcode' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('button', { name: 'Close the scanner' }).className).toMatch(/h-12 w-12/);
    await expectNoAxeViolations(dialog);
  });
});
