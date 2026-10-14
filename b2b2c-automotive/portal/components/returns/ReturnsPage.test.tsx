/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/context/ToastContext';
import { ViewerProvider } from '@/context/ViewerContext';
import type { OrderForReturn, ReturnDetail, ReturnList } from '@/lib/v-types';
import type { Viewer } from '@/lib/portal/types';
import en from '@/messages/en-US.json';
import { renderWithProviders } from '@/test/render';
import { ReturnsPage } from './ReturnsPage';

const api = vi.hoisted(() => ({ list: { current: null as unknown }, detail: { current: null as unknown }, transition: vi.fn(), create: vi.fn(), lookupOrder: vi.fn() }));
vi.mock('@/hooks/vApi', () => ({
  useReturns: () => ({ data: api.list.current, error: undefined, mutate: vi.fn() }),
  useReturn: (_s: string, number: string | null) => ({ data: number ? api.detail.current : undefined, error: undefined, mutate: vi.fn() }),
  returnApi: { transition: (...a: unknown[]) => api.transition(...a), create: (...a: unknown[]) => api.create(...a), lookupOrder: (...a: unknown[]) => api.lookupOrder(...a) },
}));
vi.mock('@/hooks/usePermissions', () => ({ usePermissions: () => ({ roles: ['admin'], can: () => true, isLoading: false }) }));

const viewer: Viewer = { customerId: 'c1', name: 'N T', email: 'n@example.com', roles: ['admin'], ctPermissions: [], businessUnitKey: 'bu-1', businessUnitName: 'Garage', storeKey: 'store-a', storeName: 'DACH Online' };
const screenOf = (ui: ReactNode) =>
  renderWithProviders(
    <ViewerProvider viewer={viewer}>
      <ToastProvider>{ui}</ToastProvider>
    </ViewerProvider>,
    { locale: 'en-US', messages: en },
  );

const row = { returnNumber: 'RET-MLV-1-1', orderNumber: 'MLV-1', customer: 'Anna M.', customerId: 'c1', items: [{ quantity: 1, name: 'Brake pads' }], tracking: 'RT-1', status: 'inspected' as const, reason: 'wrong-fit', refundState: 'none' as const, refundCents: null, rejectReason: null, createdAt: '2026-10-01T00:00:00Z' };
const list: ReturnList = { rows: [row, { ...row, returnNumber: 'RET-MLV-2-1', status: 'requested' }], kpis: { open: 2, returnRatePercent: 12.5, refundedThisMonthCents: 5900, currency: 'EUR' } };
const detail: ReturnDetail = { ...row, lines: [{ returnItemId: 'ri1', lineItemId: 'l1', name: 'Brake pads', quantity: 1 }], currency: 'EUR', maxRefundCents: 5900, hasPayment: true, comment: null, fitting: { vehicle: '2016 Volkswagen Golf · 2.0 TDI', fit: 'not-fit' } };

beforeEach(() => {
  api.list.current = list;
  api.detail.current = detail;
  for (const f of [api.transition, api.create, api.lookupOrder]) f.mockReset();
});

describe('Returns page', () => {
  it('shows the KPIs and one chip with text per return', () => {
    screenOf(<ReturnsPage />);
    expect(screen.getByTestId('kpi-rate-value')).toHaveTextContent('12.5 %');
    expect(screen.getByTestId('kpi-refunded-value')).toHaveTextContent('€59.00');
    expect(screen.getByText('Requested')).toBeInTheDocument();
    expect(screen.getByText('Inspected')).toBeInTheDocument();
  });

  it('the detail shows the wrong-fit chip with the vehicle at purchase and the fit result; the refund goes out as cents with the Stripe note', async () => {
    api.transition.mockResolvedValue({ ok: true, status: 200, data: { status: 'inspected', refund: { outcome: 'received' } } });
    screenOf(<ReturnsPage />);
    await userEvent.click(screen.getByRole('button', { name: 'Open return RET-MLV-1-1' }));
    expect((await screen.findAllByText('Wrong fit')).length).toBeGreaterThan(0);
    expect(screen.getByText(/2016 Volkswagen Golf/)).toBeInTheDocument();
    expect(screen.getByText('Does not fit')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Refund' }));
    expect(screen.getByText('The refund is sent to Stripe through commercetools Checkout and is final when Stripe confirms.')).toBeInTheDocument();
    expect(screen.getByLabelText('Refund amount')).toHaveValue('59.00');
    await userEvent.clear(screen.getByLabelText('Refund amount'));
    await userEvent.type(screen.getByLabelText('Refund amount'), '12,50');
    await userEvent.click(screen.getByRole('button', { name: 'Request refund' }));
    expect(api.transition).toHaveBeenCalledWith('store-a', 'RET-MLV-1-1', { to: 'refunded', refundCents: 1250 });
  });

  it('a refund above what the server allows shows its message', async () => {
    api.transition.mockResolvedValue({ ok: false, status: 400, data: null, code: 'REFUND_EXCEEDS_PAID' });
    screenOf(<ReturnsPage />);
    await userEvent.click(screen.getByRole('button', { name: 'Open return RET-MLV-1-1' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Refund' }));
    await userEvent.click(screen.getByRole('button', { name: 'Request refund' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('more than was paid');
  });

  it('reject needs a reason', async () => {
    api.transition.mockResolvedValue({ ok: true, status: 200, data: { status: 'rejected' } });
    screenOf(<ReturnsPage />);
    await userEvent.click(screen.getByRole('button', { name: 'Open return RET-MLV-1-1' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Reject' }));
    await userEvent.click(screen.getByRole('button', { name: 'Reject return' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('A reason is required.');
    expect(api.transition).not.toHaveBeenCalled();
    await userEvent.type(screen.getByLabelText('Reason'), 'Worn parts');
    await userEvent.click(screen.getByRole('button', { name: 'Reject return' }));
    expect(api.transition).toHaveBeenCalledWith('store-a', 'RET-MLV-1-1', { to: 'rejected', reason: 'Worn parts' });
  });
});

describe('Record a return', () => {
  const order: OrderForReturn = { orderNumber: 'MLV-1', deliveredAt: '2026-10-01T00:00:00Z', windowOpen: true, lines: [{ lineItemId: 'l1', name: 'Brake pads', purchased: 2, returned: 0, available: 2 }] };

  it('shows the 30 day rule and the delivery date, refuses nothing it should accept, and confirms with number and tracking', async () => {
    api.lookupOrder.mockResolvedValue({ ok: true, status: 200, data: order });
    api.create.mockResolvedValue({ ok: true, status: 201, data: { returnNumber: 'RET-MLV-1-2', tracking: 'RT-20261012-ABCDE' } });
    screenOf(<ReturnsPage />);
    await userEvent.click(screen.getByRole('button', { name: 'Record a return' }));
    expect(screen.getByText('Returns are accepted for 30 days after delivery.')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Order number'), 'MLV-1');
    await userEvent.click(screen.getByRole('button', { name: 'Find order' }));
    expect(await screen.findByText(/Delivered on/)).toBeInTheDocument();
    await userEvent.clear(screen.getByLabelText('Quantity for Brake pads'));
    await userEvent.type(screen.getByLabelText('Quantity for Brake pads'), '1');
    await userEvent.click(screen.getByRole('button', { name: 'Record return' }));
    expect(api.create).toHaveBeenCalledWith('store-a', { orderNumber: 'MLV-1', items: [{ lineItemId: 'l1', quantity: 1 }], reason: 'wrong-fit' });
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Return RET-MLV-1-2 created, tracking RT-20261012-ABCDE'));
  });

  it('an undelivered order cannot be submitted and says so; an order of another store is "Order not found"', async () => {
    api.lookupOrder.mockResolvedValueOnce({ ok: true, status: 200, data: { ...order, deliveredAt: null, windowOpen: false } });
    screenOf(<ReturnsPage />);
    await userEvent.click(screen.getByRole('button', { name: 'Record a return' }));
    await userEvent.type(screen.getByLabelText('Order number'), 'MLV-1');
    await userEvent.click(screen.getByRole('button', { name: 'Find order' }));
    expect(await screen.findByText(/has not been delivered yet/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Record return' })).toBeDisabled();
    api.lookupOrder.mockResolvedValueOnce({ ok: false, status: 404, data: null, code: 'ORDER_NOT_FOUND' });
    await userEvent.click(screen.getByRole('button', { name: 'Find order' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Order not found.');
  });
});
