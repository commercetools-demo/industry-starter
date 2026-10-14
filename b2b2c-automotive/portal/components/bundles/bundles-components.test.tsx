/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/context/ToastContext';
import { ViewerProvider } from '@/context/ViewerContext';
import type { Viewer } from '@/lib/portal/types';
import en from '@/messages/en-US.json';
import { renderWithProviders } from '@/test/render';
import { BundleForm } from './BundleForm';
import { BundleList } from './BundleList';

const state = vi.hoisted(() => ({
  components: [] as unknown[],
  create: vi.fn(),
  publish: vi.fn(),
}));

vi.mock('@/hooks/marketingApi', () => ({
  useBundleComponents: () => ({ data: { components: state.components }, isLoading: false }),
  bundleApi: { create: (...a: unknown[]) => state.create(...a), publish: (...a: unknown[]) => state.publish(...a) },
}));

const viewer: Viewer = { customerId: 'c1', name: 'N T', email: 'n@example.com', roles: ['admin'], ctPermissions: [], businessUnitKey: 'bu-1', businessUnitName: 'Garage Nord', storeKey: 'store-a', storeName: 'DACH Online' };

function screenOf(ui: ReactNode) {
  return renderWithProviders(
    <ViewerProvider viewer={viewer}>
      <ToastProvider>{ui}</ToastProvider>
    </ViewerProvider>,
    { locale: 'en-US', messages: en },
  );
}

const A = { sku: 'A-1', name: { 'en-US': 'Brake pad' }, retailCents: 9000 };
const B = { sku: 'B-2', name: { 'en-US': 'Brake disc' }, retailCents: 3920 };

beforeEach(() => {
  state.components = [A, B];
  state.create.mockReset();
  state.publish.mockReset();
});

async function pick(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Bundle name'), 'TST-W bundle');
  await user.click(screen.getByRole('button', { name: 'Add Brake pad' }));
  await user.click(screen.getByRole('button', { name: 'Add Brake disc' }));
  fireEvent.change(screen.getByLabelText('Quantity of Brake disc'), { target: { value: '2' } });
}

describe('BundleForm', () => {
  it('the live price example: 16840 cents and 10 percent give a bundle price of 151.56 and a saving of 16.84', async () => {
    const user = userEvent.setup();
    screenOf(<BundleForm onCreated={vi.fn()} />);
    await pick(user);
    const summary = screen.getByText('Components total').closest('dl') as HTMLElement;
    expect(within(summary).getByText('Components total').nextSibling).toHaveTextContent('€168.40');
    expect(within(summary).getByText('Bundle price').nextSibling).toHaveTextContent('€151.56');
    expect(within(summary).getByText('Customer saving').nextSibling).toHaveTextContent('€16.84');
    expect(screen.getByRole('button', { name: 'Create bundle' })).toBeEnabled();
  });

  it('60 percent shows the inline limit and Create stays disabled', async () => {
    const user = userEvent.setup();
    screenOf(<BundleForm onCreated={vi.fn()} />);
    await pick(user);
    fireEvent.change(screen.getByLabelText('Discount (%)'), { target: { value: '60' } });
    expect(screen.getByRole('alert')).toHaveTextContent('The discount is 1 to 50 percent.');
    expect(screen.getByRole('button', { name: 'Create bundle' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Discount (%)'), { target: { value: '50' } });
    expect(screen.getByRole('button', { name: 'Create bundle' })).toBeEnabled();
  });

  it('one component is not enough and Create stays disabled', async () => {
    const user = userEvent.setup();
    screenOf(<BundleForm onCreated={vi.fn()} />);
    await user.type(screen.getByLabelText('Bundle name'), 'TST-W bundle');
    await user.click(screen.getByRole('button', { name: 'Add Brake pad' }));
    expect(screen.getByRole('alert')).toHaveTextContent('A bundle has 2 to 8 components.');
    expect(screen.getByRole('button', { name: 'Create bundle' })).toBeDisabled();
  });

  it('Create bundle sends the component list and no price field, then refreshes', async () => {
    state.create.mockResolvedValue({ ok: true, status: 201, data: {} });
    const created = vi.fn();
    const user = userEvent.setup();
    screenOf(<BundleForm onCreated={created} />);
    await pick(user);
    await user.click(screen.getByRole('button', { name: 'Create bundle' }));
    await waitFor(() => expect(state.create).toHaveBeenCalledTimes(1));
    expect(state.create).toHaveBeenCalledWith('store-a', { name: 'TST-W bundle', discountPercent: 10, components: [{ sku: 'A-1', qty: 1 }, { sku: 'B-2', qty: 2 }] });
    expect(JSON.stringify(state.create.mock.calls[0])).not.toMatch(/price|cents/i);
    await waitFor(() => expect(created).toHaveBeenCalled());
  });

  it('a COMPONENT_NOT_ASSIGNED failure names the SKU', async () => {
    state.create.mockResolvedValue({ ok: false, status: 409, data: null, code: 'COMPONENT_NOT_ASSIGNED', details: { sku: 'B-2' } });
    const user = userEvent.setup();
    screenOf(<BundleForm onCreated={vi.fn()} />);
    await pick(user);
    await user.click(screen.getByRole('button', { name: 'Create bundle' }));
    expect(await screen.findByText('B-2 is not in your assortment.')).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = screenOf(<BundleForm onCreated={vi.fn()} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});

const bundle = (over: Record<string, unknown> = {}) => ({
  key: 'bundle-1',
  productId: 'p1',
  sku: 'BND-STORE-A-001',
  name: { 'en-US': 'TST-W bundle' },
  discountPercent: 10,
  components: [
    { sku: 'A-1', name: { 'en-US': 'Brake pad' }, qty: 1, retailCents: 9000, assigned: true },
    { sku: 'B-2', name: { 'en-US': 'Brake disc' }, qty: 2, retailCents: 3920, assigned: true },
  ],
  componentsCents: 16840,
  bundleCents: 15156,
  savingCents: 1684,
  status: 'Live',
  unavailableSku: null,
  ...over,
});

describe('BundleList', () => {
  it('shows Live and Draft chips, the prices and the hidden warning row', () => {
    screenOf(
      <BundleList
        loading={false}
        failed={false}
        onChanged={vi.fn()}
        bundles={[bundle(), bundle({ key: 'bundle-2', sku: 'BND-STORE-A-002', name: { 'en-US': 'Second' }, status: 'Draft' }), bundle({ key: 'bundle-3', sku: 'BND-STORE-A-003', name: { 'en-US': 'Third' }, unavailableSku: 'B-2' })] as never}
      />,
    );
    expect(screen.getAllByText('Live')).toHaveLength(2);
    expect(screen.getByText('Draft')).toBeInTheDocument();
    expect(screen.getAllByText('€151.56').length).toBeGreaterThan(0);
    expect(screen.getAllByText('€16.84').length).toBeGreaterThan(0);
    expect(screen.getByText('Hidden: B-2 withdrawn')).toBeInTheDocument();
    expect(screen.getAllByText('Brake disc × 2').length).toBeGreaterThan(0);
  });

  it('Publish is offered for a Draft only and calls the api, then refreshes', async () => {
    state.publish.mockResolvedValue({ ok: true, status: 200, data: {} });
    const changed = vi.fn();
    const user = userEvent.setup();
    screenOf(<BundleList loading={false} failed={false} onChanged={changed} bundles={[bundle(), bundle({ key: 'bundle-2', sku: 'BND-STORE-A-002', name: { 'en-US': 'Second' }, status: 'Draft' })] as never} />);
    expect(screen.getAllByRole('button', { name: /^Publish/ })).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Publish Second' }));
    await waitFor(() => expect(state.publish).toHaveBeenCalledWith('store-a', 'bundle-2'));
    await waitFor(() => expect(changed).toHaveBeenCalled());
  });

  it('a publish refusal names the SKU', async () => {
    state.publish.mockResolvedValue({ ok: false, status: 409, data: null, code: 'COMPONENT_NOT_ASSIGNED', details: { sku: 'B-2' } });
    const user = userEvent.setup();
    screenOf(<BundleList loading={false} failed={false} onChanged={vi.fn()} bundles={[bundle({ status: 'Draft' })] as never} />);
    await user.click(screen.getByRole('button', { name: /^Publish/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('B-2 is not in your assortment.');
  });

  it('has no accessibility violations', async () => {
    const { container } = screenOf(<BundleList loading={false} failed={false} onChanged={vi.fn()} bundles={[bundle(), bundle({ key: 'b2', sku: 'X-2', status: 'Draft', unavailableSku: 'A-1' })] as never} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
