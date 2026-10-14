/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ViewerProvider } from '@/context/ViewerContext';
import { PermissionButton } from '@/components/portal/PermissionButton';
import { Shell } from '@/components/layout/Shell';
import en from '@/messages/en-US.json';
import type { Viewer } from '@/lib/portal/types';
import { renderWithProviders } from '@/test/render';

const refresh = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  usePathname: () => '/catalog',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), refresh }),
}));

const viewer = (roles: Viewer['roles']): Viewer => ({
  customerId: 'c1', name: 'N T', email: 'n@example.com', roles, ctPermissions: [], businessUnitKey: 'bu-1', businessUnitName: 'Test Garage Nord', storeKey: 's1', storeName: 'DACH Online',
});

const fetchMock = vi.fn();
beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockImplementation(async () => Response.json({ notifications: [] }));
});
afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
  refresh.mockReset();
});

describe('usePermissions', () => {
  it('disabled edit action shows the insufficient permissions text for buyer', () => {
    renderWithProviders(
      <ViewerProvider viewer={viewer(['buyer'])}>
        <PermissionButton action="price.edit">Edit price</PermissionButton>
      </ViewerProvider>,
      { messages: en },
    );
    const button = screen.getByRole('button', { name: 'Edit price' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('title', 'Insufficient permissions to perform this task');
    expect(screen.getByText('Insufficient permissions to perform this task')).toBeInTheDocument();
  });

  it('the same action is enabled for an admin', () => {
    renderWithProviders(
      <ViewerProvider viewer={viewer(['admin'])}>
        <PermissionButton action="price.edit">Edit price</PermissionButton>
      </ViewerProvider>,
      { messages: en },
    );
    expect(screen.getByRole('button', { name: 'Edit price' })).toBeEnabled();
    expect(screen.queryByText('Insufficient permissions to perform this task')).not.toBeInTheDocument();
  });
});

describe('business unit switcher', () => {
  it('switch toasts, refreshes and posts the chosen unit', async () => {
    const units = [
      { key: 'bu-1', name: 'Test Garage Nord', kind: 'Company', stores: [{ key: 's1', name: 'DACH Online', mode: 'Explicit' }] },
      { key: 'bu-2', name: 'Test Garage Nord Berlin', kind: 'Division', stores: [{ key: 's2', name: 'Workshop Direct', mode: 'FromParent' }] },
    ];
    fetchMock.mockImplementation(async (url: string) => {
      if (url === '/api/business-units') return Response.json({ current: { businessUnitKey: 'bu-1', storeKey: 's1' }, units });
      if (url === '/api/business-units/select') return Response.json({ name: 'Test Garage Nord Berlin', label: 'x' });
      return Response.json({ notifications: [] });
    });
    renderWithProviders(<Shell viewer={viewer(['admin'])}><p>body</p></Shell>, { messages: en });
    await userEvent.click(screen.getByTestId('switcher'));
    expect(await screen.findByText('Explicit store')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Test Garage Nord Berlin/ }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Switched to Test Garage Nord Berlin'));
    const post = fetchMock.mock.calls.find(([url]) => url === '/api/business-units/select')!;
    expect(JSON.parse(post[1].body)).toEqual({ businessUnitKey: 'bu-2' });
    expect(refresh).toHaveBeenCalled();
  });
});
