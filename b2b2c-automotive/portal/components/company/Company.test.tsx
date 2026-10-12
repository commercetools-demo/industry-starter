// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Company & team screens (workstream U-09): role matrix (a Buyer reads, only an Admin writes), the one-time invitation link, tabs.
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ViewerProvider } from '@/context/ViewerContext';
import type { Viewer } from '@/lib/portal/types';
import en from '@/messages/en-US.json';
import de from '@/messages/de-DE.json';
import { renderWithProviders } from '@/test/render';

let pathname = '/company/users';
vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  usePathname: () => pathname,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), refresh: vi.fn() }),
}));

import { AddressesTab } from './AddressesTab';
import { CompanyTabs } from './CompanyTabs';
import { ProfileTab } from './ProfileTab';
import { UsersTab } from './UsersTab';

const viewer = (roles: Viewer['roles']): Viewer => ({
  customerId: 'cust-1',
  name: 'Anna Test',
  email: 'anna@example.com',
  roles,
  ctPermissions: [],
  businessUnitKey: 'bu-1',
  businessUnitName: 'Test Garage Nord',
  storeKey: 'store-1',
  storeName: 'Test Store',
});

const USER = { customerId: 'c1', name: 'Quinn Tester', email: 'qa-u@example.com', role: 'Buyer', roleKey: 'mau-role-buyer', status: 'Invited', lastActive: null };
const BODIES: Record<string, unknown> = {
  '/api/company/users': { users: [USER, { ...USER, customerId: 'c2', name: 'Sam Admin', role: 'Admin', roleKey: 'mau-role-admin', status: 'Active', lastActive: '2026-10-10T10:00:00.000Z' }] },
  '/api/company/roles': { roles: [{ key: 'mau-role-admin', name: 'Admin' }, { key: 'mau-role-buyer', name: 'Buyer' }] },
  '/api/company/addresses': { addresses: [{ id: 'a1', label: 'Workshop', streetName: 'Hafenstrasse', streetNumber: '1', postalCode: '20457', city: 'Hamburg', country: 'DE', type: 'Delivery & billing', isDefault: true }] },
  '/api/company/profile': { profile: { name: 'Test Garage Nord', contactEmail: 'office@example.com', kind: 'reseller', storeKey: 'store-1', storeName: 'Test Store', region: 'DE', currency: 'EUR' } },
};

const fetchMock = vi.fn();
beforeEach(() => {
  pathname = '/company/users';
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    if (init?.method === 'POST' && url === '/api/company/users/invite') return Response.json({ invitePath: '/en-US/accept-invite/one-time-token', user: USER }, { status: 201 });
    return Response.json(BODIES[url] ?? {});
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

const render = (ui: React.ReactElement, roles: Viewer['roles'], messages = en) => renderWithProviders(<ViewerProvider viewer={viewer(roles)}>{ui}</ViewerProvider>, { messages, locale: messages === en ? 'en-US' : 'de-DE' });

describe('Users tab', () => {
  it('lists users with status chips; the Admin can open the invite dialog', async () => {
    render(<UsersTab />, ['admin']);
    expect(await screen.findByText('Quinn Tester')).toBeInTheDocument();
    expect(screen.getByText('Invited')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    const invite = screen.getByRole('button', { name: 'Invite user' });
    expect(invite).toBeEnabled();
    await userEvent.click(invite);
    expect(screen.getByRole('dialog', { name: 'Invite a user' })).toBeInTheDocument();
  });

  it('a Buyer reads the list but Invite is disabled with the permission text', async () => {
    render(<UsersTab />, ['buyer']);
    expect(await screen.findByText('Quinn Tester')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Invite user' })).toBeDisabled();
    expect(screen.getByText('Insufficient permissions to perform this task')).toBeInTheDocument();
  });

  it('inviting shows the one-time link with a Copy button and the shown-once note', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(<UsersTab />, ['admin']);
    await userEvent.click(await screen.findByRole('button', { name: 'Invite user' }));
    await userEvent.type(screen.getByLabelText('First name'), 'Quinn');
    await userEvent.type(screen.getByLabelText('Last name'), 'Tester');
    await userEvent.type(screen.getByLabelText('Email'), 'qa-u@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Create invitation' }));
    const input = (await screen.findByLabelText('Invitation link')) as HTMLInputElement;
    expect(input.value).toMatch(/\/en-US\/accept-invite\/one-time-token$/);
    expect(screen.getByText('Send this link to the invitee yourself. It is shown once.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Copy' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(input.value));
    expect(await screen.findByText('Link copied')).toBeInTheDocument();
    const call = fetchMock.mock.calls.find(([url]) => url === '/api/company/users/invite');
    expect(JSON.parse((call?.[1] as RequestInit).body as string)).toEqual({ firstName: 'Quinn', lastName: 'Tester', email: 'qa-u@example.com', roleKey: 'mau-role-buyer' });
  });

  it('only Admin and Buyer are offered as roles', async () => {
    render(<UsersTab />, ['admin']);
    await userEvent.click(await screen.findByRole('button', { name: 'Invite user' }));
    const options = await screen.findAllByRole('option');
    expect(options.map((o) => o.textContent)).toEqual(['Admin', 'Buyer']);
  });

  it('renders in German', async () => {
    render(<UsersTab />, ['admin'], de);
    expect(await screen.findByRole('button', { name: 'Benutzer einladen' })).toBeEnabled();
  });
});

describe('Addresses tab', () => {
  it('shows type and default; Add address and Make default are Admin only', async () => {
    render(<AddressesTab />, ['buyer']);
    expect(await screen.findByText('Workshop')).toBeInTheDocument();
    expect(screen.getByText('Delivery & billing')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add address' })).toBeDisabled();
  });

  it('an Admin can add an address', async () => {
    render(<AddressesTab />, ['admin']);
    await userEvent.click(await screen.findByRole('button', { name: 'Add address' }));
    expect(screen.getByRole('dialog', { name: 'Add an address' })).toBeInTheDocument();
  });
});

describe('Profile tab', () => {
  it('Admin edits name and contact email; the rest is managed by Malva', async () => {
    render(<ProfileTab />, ['admin']);
    expect(await screen.findByLabelText('Company name')).toBeEnabled();
    expect(screen.getByLabelText('Region')).toHaveAttribute('readonly');
    expect(screen.getAllByText('Managed by Malva').length).toBe(4);
    expect(screen.queryByText('Contact an administrator to change these details.')).toBeNull();
  });

  it('a Buyer sees read-only inputs, the contact note and a disabled Save', async () => {
    render(<ProfileTab />, ['buyer']);
    expect(await screen.findByLabelText('Company name')).toBeDisabled();
    expect(screen.getByText('Contact an administrator to change these details.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
  });
});

describe('Company tabs', () => {
  it('has Users, Addresses and Profile (no Cost centres) and marks the current one', () => {
    pathname = '/company/addresses';
    render(<CompanyTabs />, ['admin']);
    expect(screen.getAllByRole('link').map((a) => a.textContent)).toEqual(['Users', 'Addresses', 'Profile']);
    expect(screen.getByRole('link', { name: 'Addresses' })).toHaveAttribute('aria-current', 'page');
  });
});
