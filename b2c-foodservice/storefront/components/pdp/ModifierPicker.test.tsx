// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProductPageData, SelectorDef } from '@/lib/types';
import { podPage, renderPdp, variantView } from '@/test/pdp';

vi.mock('@/i18n/routing', async () => (await import('@/test/shell')).routingMock());
vi.mock('next/image', () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

const OAT = '572a1c72-24e1-4a96-a693-d022be0cd867';
const ALMOND = 'f8716393-8508-46cb-865a-7dac4731e22a';
const INTENSO = '61b32504-89d7-4f24-b434-e9e6276e7e05';

/** A ready-made coffee page: two sizes, three modifiers. */
function drinkPage(over: Partial<ProductPageData> = {}): ProductPageData {
  const base = podPage();
  const variants = [
    variantView('RD-SMALL', { size: 'small' }, 325, { attrLabels: { size: 'Small (12 oz)' } }),
    variantView('RD-LARGE', { size: 'large' }, 375, { attrLabels: { size: 'Large (16 oz)' } }),
  ];
  const selectors: SelectorDef[] = [
    { attr: 'size', renderer: 'pill', required: true, options: [{ value: 'small', label: 'Small (12 oz)' }, { value: 'large', label: 'Large (16 oz)' }] },
  ];
  return {
    ...base,
    product: { ...base.product, name: 'Americano', shape: 'readyDrink', subscribable: false, variants, selectors, defaultSku: 'RD-SMALL' },
    policies: [],
    modifiers: [{ id: OAT, name: 'Oat milk' }, { id: ALMOND, name: 'Almond milk' }, { id: INTENSO, name: 'Intenso' }],
    ...over,
  };
}

let posted: Record<string, unknown>[] = [];
const render = (data = drinkPage()) =>
  renderPdp(data, {
    routes: {
      '/api/cart/lines': (init) => {
        posted.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
        return { cart: { id: 'c1', version: 2, count: 1, lines: [] } };
      },
    },
  });

beforeEach(() => {
  posted = [];
});

describe('ready-made coffee: size and modifiers', () => {
  it('picks a size and several modifiers; the drink is added at its own price with the modifiers in offered order', async () => {
    const user = userEvent.setup();
    await render();
    await user.click(screen.getByRole('button', { name: 'Large (16 oz)' }));
    await user.click(screen.getByRole('button', { name: 'Intenso' }));
    await user.click(screen.getByRole('button', { name: 'Oat milk' }));
    expect(screen.getByRole('button', { name: 'Oat milk' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(/Customize - Oat milk, Intenso/)).toBeInTheDocument();
    expect(screen.getByTestId('add-to-bag')).toHaveTextContent('$3.75');
    await user.click(screen.getByTestId('add-to-bag'));
    expect(posted).toEqual([{ sku: 'RD-LARGE', quantity: 1, fulfilment: 'delivery', modifiers: [OAT, INTENSO] }]);
  });

  it('a second click removes a modifier; with none chosen nothing extra is sent', async () => {
    const user = userEvent.setup();
    await render();
    await user.click(screen.getByRole('button', { name: 'Almond milk' }));
    await user.click(screen.getByRole('button', { name: 'Almond milk' }));
    expect(screen.getByRole('button', { name: 'Almond milk' })).toHaveAttribute('aria-pressed', 'false');
    await user.click(screen.getByTestId('add-to-bag'));
    expect(posted).toEqual([{ sku: 'RD-SMALL', quantity: 1, fulfilment: 'delivery' }]);
  });

  it('no picker when the configuration offers nothing or could not be read', async () => {
    await render(drinkPage({ modifiers: null }));
    expect(screen.queryByTestId('modifier-picker')).toBeNull();
  });
});
