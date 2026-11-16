// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { nav } from '@/test/shell';
import { expectNoAxeViolations } from '@/test/axe';
import { renderShell } from '@/test/shell';
import { BUNDLE_CONFIG_VALUE, BUNDLE_SKU, componentProducts, inventoryFor } from '@/test/preset-bundle';
import { mapBundleView, parseBundleConfig } from '@/lib/mappers/preset-bundle';
import type { BundleView, ProductPageData } from '@/lib/types';

const h = vi.hoisted(() => ({
  add: vi.fn(), openCart: vi.fn(), show: vi.fn(), error: null as string | null,
}));

vi.mock('@/i18n/routing', async () => (await import('@/test/shell')).routingMock());
vi.mock('@/hooks/useAddPresetBundle', () => ({
  useAddPresetBundle: () => ({ add: h.add, isAdding: false, error: h.error }),
}));
vi.mock('@/context/shell-ui-context', async (orig) => ({ ...(await orig<object>()), useShellUi: () => ({ openCart: h.openCart }) }));
vi.mock('@/context/toast', async (orig) => ({ ...(await orig<object>()), useToast: () => ({ show: h.show }) }));

import PresetBundleDetail from './PresetBundleDetail';

function viewOf(inventory = inventoryFor()): BundleView {
  const config = parseBundleConfig(BUNDLE_CONFIG_VALUE);
  if (!config) throw new Error('config');
  return mapBundleView(config, componentProducts(), inventory, { locale: 'en-US', currency: 'USD' }, BUNDLE_SKU);
}
const product = { name: 'Fast forward' } as unknown as ProductPageData['product'];

beforeEach(() => {
  h.add.mockReset().mockResolvedValue({ id: 'cart-1' });
  h.openCart.mockReset();
  h.show.mockReset();
  h.error = null;
  nav.replace.mockReset();
});

describe('preset bundle product page (V-14)', () => {
  it('shows one radio card per preset with the names, prices and savings', () => {
    renderShell(<PresetBundleDetail product={product} bundle={viewOf()} requestedPreset={null} />);
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(2);
    expect(screen.getByText('Vertuo bundle')).toBeInTheDocument();
    expect(screen.getByText('$349.16')).toBeInTheDocument();
    expect(screen.getByText('$387.95')).toBeInTheDocument();
    expect(screen.getByText('Pod plus')).toBeInTheDocument();
    expect(screen.getByText('$416.15')).toBeInTheDocument();
  });

  it('?preset=1 opens with the second preset selected', () => {
    renderShell(<PresetBundleDetail product={product} bundle={viewOf()} requestedPreset={1} />);
    const radios = screen.getAllByRole('radio') as HTMLInputElement[];
    expect(radios[1].checked).toBe(true);
    expect(screen.getByRole('button', { name: 'Add bundle to bag · $416.15' })).toBeInTheDocument();
  });

  it('a requested preset that is unavailable falls back to the first available one', () => {
    const view = viewOf(inventoryFor({ 'MCF-MAC-VERTUO-BLA-M': 0, 'MCF-MAC-VERTUO-BLA-S': 0 }));
    renderShell(<PresetBundleDetail product={product} bundle={view} requestedPreset={0} />);
    const radios = screen.getAllByRole('radio') as HTMLInputElement[];
    expect(radios[0].disabled).toBe(true);
    expect(radios[1].checked).toBe(true);
  });

  it('an out-of-stock preset is disabled with its reason', () => {
    renderShell(<PresetBundleDetail product={product} bundle={viewOf(inventoryFor({ 'MCF-MAC-VERTUO-BLA-M': 0, 'MCF-MAC-VERTUO-BLA-S': 0 }))} requestedPreset={null} />);
    expect(screen.getAllByText('Out of stock').length).toBeGreaterThan(0);
  });

  it('changing the preset updates the picture, the names and the query (replaced, not pushed)', async () => {
    renderShell(<PresetBundleDetail product={product} bundle={viewOf()} requestedPreset={null} />);
    expect(screen.getByRole('img', { name: 'Vertuo Studio' })).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole('radio')[1]);
    expect(screen.getByRole('img', { name: 'Pod Plus Milk' })).toBeInTheDocument();
    const contents = screen.getByRole('heading', { name: "What's in the box" }).closest('section') as HTMLElement;
    expect(within(contents).getByText('Pod carousel holder')).toBeInTheDocument();
    expect(nav.replace).toHaveBeenCalledWith('/?preset=1');
  });

  it('adds with the preset, the machine and the quantity only, and opens the bag', async () => {
    renderShell(<PresetBundleDetail product={product} bundle={viewOf()} requestedPreset={null} />);
    await userEvent.click(screen.getByRole('button', { name: 'Add bundle to bag · $349.16' }));
    await waitFor(() => expect(h.add).toHaveBeenCalledTimes(1));
    expect(h.add).toHaveBeenCalledWith({ sku: BUNDLE_SKU, preset: 0, quantity: 1, machineSku: 'MCF-MAC-VERTUO-BLA-M', fulfilment: 'delivery' });
    expect(h.openCart).toHaveBeenCalled();
  });

  it('an error code shows its message', () => {
    h.error = 'bundle_preset_unavailable';
    renderShell(<PresetBundleDetail product={product} bundle={viewOf()} requestedPreset={null} />);
    expect(screen.getByRole('alert')).toHaveTextContent('That bundle is not available right now');
  });

  it('no preset available shows "not available" and no add button', () => {
    const none = viewOf(inventoryFor({ 'MCF-MAC-VERTUO-BLA-M': 0, 'MCF-MAC-VERTUO-BLA-S': 0, 'MCF-MAC-PODPLUS-WHI-M': 0 }));
    renderShell(<PresetBundleDetail product={product} bundle={none} requestedPreset={null} />);
    expect(screen.getAllByText('This bundle is not available right now').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: /Add bundle to bag/ })).not.toBeInTheDocument();
  });

  it('passes an axe check', async () => {
    const { container } = renderShell(<PresetBundleDetail product={product} bundle={viewOf()} requestedPreset={null} />);
    await expectNoAxeViolations(container);
  });
});
