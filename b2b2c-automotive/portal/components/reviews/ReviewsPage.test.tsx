/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/context/ToastContext';
import { ViewerProvider } from '@/context/ViewerContext';
import type { ReviewList } from '@/lib/v-types';
import type { Viewer } from '@/lib/portal/types';
import en from '@/messages/en-US.json';
import { renderWithProviders } from '@/test/render';
import { ReviewsPage } from './ReviewsPage';

const api = vi.hoisted(() => ({ list: { current: null as unknown }, reply: vi.fn(), setVisibility: vi.fn(), can: { current: true } }));
vi.mock('@/hooks/vApi', () => ({
  useReviews: () => ({ data: api.list.current, error: undefined, mutate: vi.fn() }),
  reviewApi: { reply: (...a: unknown[]) => api.reply(...a), setVisibility: (...a: unknown[]) => api.setVisibility(...a) },
}));
vi.mock('@/hooks/usePermissions', () => ({ usePermissions: () => ({ roles: ['admin'], can: () => api.can.current, isLoading: false }) }));

const viewer: Viewer = { customerId: 'c1', name: 'N T', email: 'n@example.com', roles: ['admin'], ctPermissions: [], businessUnitKey: 'bu-1', businessUnitName: 'Garage', storeKey: 'store-a', storeName: 'DACH Online' };
const screenOf = (ui: ReactNode) =>
  renderWithProviders(
    <ViewerProvider viewer={viewer}>
      <ToastProvider>{ui}</ToastProvider>
    </ViewerProvider>,
    { locale: 'en-US', messages: en },
  );

const list: ReviewList = {
  rows: [
    { id: 'r1', productId: 'p1', productName: 'Brake pads', rating: 2, title: 'Squeaks', text: 'Squeaks a lot.', author: 'Ben B.', createdAt: '2026-10-05T00:00:00Z', visibility: 'published', reply: null },
    { id: 'r2', productId: 'p1', productName: 'Brake pads', rating: 5, title: 'Great', text: 'Great pads.', author: 'Anna M.', createdAt: '2026-10-04T00:00:00Z', visibility: 'published', reply: { text: 'Thanks!', at: null, by: 'DACH Online' } },
    { id: 'r3', productId: 'p2', productName: 'Oil', rating: 1, title: 'Spam', text: 'Spam.', author: 'X Y.', createdAt: '2026-10-03T00:00:00Z', visibility: 'hidden', reply: null },
  ],
  kpis: { average: 3.5, thisMonth: 2, unanswered: 1 },
};

beforeEach(() => {
  api.list.current = list;
  api.can.current = true;
  api.reply.mockReset();
  api.setVisibility.mockReset();
});

describe('Reviews page', () => {
  it('shows the KPIs, stars as text, the public reply with the store name, and a hidden chip', async () => {
    const { container } = screenOf(<ReviewsPage />);
    expect(screen.getByTestId('kpi-average-value')).toHaveTextContent('3.5');
    expect(screen.getByTestId('kpi-unanswered-value')).toHaveTextContent('1');
    expect(screen.getByText('2 of 5')).toBeInTheDocument();
    expect(screen.getByText('Reply from DACH Online')).toBeInTheDocument();
    expect(screen.getByText('Hidden')).toBeInTheDocument();
    expect(await axe(container, { rules: { region: { enabled: false } } })).toHaveNoViolations();
  });

  it('posts a reply for the review and shows the toast', async () => {
    api.reply.mockResolvedValue({ ok: true, status: 200, data: { id: 'r1' } });
    screenOf(<ReviewsPage />);
    const card = screen.getByTestId('review-r1');
    await userEvent.click(card.querySelector('button') as HTMLButtonElement);
    await userEvent.type(screen.getByLabelText('Public reply'), 'Sorry about that');
    await userEvent.click(screen.getByRole('button', { name: 'Post reply' }));
    expect(api.reply).toHaveBeenCalledWith('store-a', 'r1', 'Sorry about that');
    expect(await screen.findByText('Reply posted')).toBeInTheDocument();
  });

  it('hides a published review and shows a hidden one', async () => {
    api.setVisibility.mockResolvedValue({ ok: true, status: 200, data: { id: 'r1' } });
    screenOf(<ReviewsPage />);
    await userEvent.click(screen.getAllByRole('button', { name: 'Hide' })[0]);
    expect(api.setVisibility).toHaveBeenCalledWith('store-a', 'r1', 'hidden');
    await userEvent.click(screen.getByRole('button', { name: 'Show' }));
    expect(api.setVisibility).toHaveBeenLastCalledWith('store-a', 'r3', 'published');
  });

  it('a role that may not moderate sees no reply or hide controls', () => {
    api.can.current = false;
    screenOf(<ReviewsPage />);
    expect(screen.queryByRole('button', { name: 'Hide' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Reply|Edit reply/ })).toBeNull();
  });
});
