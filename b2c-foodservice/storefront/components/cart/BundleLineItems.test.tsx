// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import BundleLineItems from '@/components/cart/BundleLineItems';
import CartLineRow from '@/components/cart/CartLineRow';
import type { CartUi } from '@/components/cart/use-cart-ui';
import { expectNoAxeViolations } from '@/test/axe';
import { renderShell } from '@/test/shell';
import { usd, viewLine } from '@/test/cart';
import type { CartLine } from '@/lib/types';

const bundle: NonNullable<CartLine['bundle']> = {
  presetName: 'Vertuo bundle', discountPercent: 10,
  items: [
    { sku: 'MCF-MAC-VERTUO-BLA-M', name: 'Vertuo Studio', role: 'machine' },
    { sku: 'MCF-GFT-STARTER', name: 'Pod One Starter Gift', role: 'item' },
    { sku: 'MCF-GFT-DISCOVERY', name: 'Pod Discovery Gift Set', role: 'item' },
  ],
};
const bundleLine = (over: Partial<CartLine> = {}) => viewLine({
  id: 'P', name: 'Fast forward', sku: '998674532', fulfilment: 'delivery', unitPrice: usd(34916), oldUnitPrice: usd(38795),
  total: usd(34916), bundle, ...over,
});

function uiStub() {
  return {
    mutations: { isPending: () => false },
    ship: vi.fn(), collect: vi.fn(), setQuantity: vi.fn(), remove: vi.fn().mockResolvedValue(undefined),
  } as unknown as CartUi & { setQuantity: ReturnType<typeof vi.fn>; remove: ReturnType<typeof vi.fn> };
}

describe('preset bundle row in the bag (V-13)', () => {
  it('shows the saving badge and the parts, machine first', () => {
    renderShell(<BundleLineItems bundle={bundle} />);
    expect(screen.getByText('Bundle · save 10%')).toBeInTheDocument();
    expect(screen.getByText('Includes')).toBeInTheDocument();
    const parts = screen.getAllByRole('listitem').map((li) => [li.getAttribute('data-bundle-part'), li.textContent]);
    expect(parts).toEqual([['machine', 'Vertuo Studio'], ['item', 'Pod One Starter Gift'], ['item', 'Pod Discovery Gift Set']]);
  });

  it('the row shows the preset name, the struck-through price and the engine total; its chips are offered', async () => {
    const ui = uiStub();
    const { container } = renderShell(<ul><CartLineRow line={bundleLine()} ui={ui} /></ul>);
    expect(screen.getByText('Vertuo bundle')).toBeInTheDocument();
    expect(screen.getByTestId('line-total')).toHaveTextContent('$349.16');
    await expectNoAxeViolations(container);
  });

  it('the stepper and remove act on the bundle (the parent line id)', async () => {
    const ui = uiStub();
    renderShell(<ul><CartLineRow line={bundleLine()} ui={ui} /></ul>);
    const row = document.querySelector<HTMLElement>('[data-line-id="P"]') as HTMLElement;
    await userEvent.click(within(row).getByRole('button', { name: 'Increase quantity' }));
    expect(ui.setQuantity).toHaveBeenCalledWith(expect.objectContaining({ id: 'P' }), 2);
    await userEvent.click(within(row).getByRole('button', { name: 'Remove Fast forward' }));
    expect(ui.remove).toHaveBeenCalledWith(expect.objectContaining({ id: 'P' }));
  });
});
