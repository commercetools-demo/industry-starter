// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Account settings screens (workstream U-10): live password messages, error mapping, units table, tabs.
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ViewerProvider } from '@/context/ViewerContext';
import type { Viewer } from '@/lib/portal/types';
import en from '@/messages/en-US.json';
import { renderWithProviders } from '@/test/render';

let pathname = '/account/general';
vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  usePathname: () => pathname,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), refresh: vi.fn() }),
}));

import { AccountTabs } from './AccountTabs';
import { BusinessUnitsTab } from './BusinessUnitsTab';
import { GeneralTab } from './GeneralTab';
import { SecurityTab } from './SecurityTab';

const viewer: Viewer = { customerId: 'cust-1', name: 'Anna Test', email: 'anna@example.com', roles: ['buyer'], ctPermissions: [], businessUnitKey: 'bu-1', businessUnitName: 'Test Garage', storeKey: 'store-1', storeName: 'Test Store' };

const fetchMock = vi.fn();
let putResult: { status: number; body: unknown } = { status: 200, body: {} };
beforeEach(() => {
  pathname = '/account/general';
  putResult = { status: 200, body: {} };
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    if (init?.method === 'PUT') return Response.json(putResult.body, { status: putResult.status });
    if (url === '/api/account/profile') return Response.json({ profile: { firstName: 'Anna', lastName: 'Test', email: 'anna@example.com' } });
    if (url === '/api/account/business-units') {
      return Response.json({ units: [{ key: 'bu-1', name: 'Test Garage', type: 'Company', roles: ['Buyer'], storeName: 'Test Store', storeMode: 'FromParent' }, { key: 'bu-2', name: 'Branch', type: 'Division', roles: ['Admin'], storeName: 'Other Store', storeMode: 'Explicit' }] });
    }
    return Response.json({});
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

const render = (ui: React.ReactElement) => renderWithProviders(<ViewerProvider viewer={viewer}>{ui}</ViewerProvider>, { messages: en, locale: 'en-US' });

describe('Security tab', () => {
  it('shows the four live messages', async () => {
    render(<SecurityTab />);
    expect(screen.getByText('Enter a new password')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('New password'), 'short');
    expect(screen.getByText('Too short')).toBeInTheDocument();
    await userEvent.clear(screen.getByLabelText('New password'));
    await userEvent.type(screen.getByLabelText('New password'), 'dummy-long-enough-password');
    expect(screen.getByText("Passwords don't match")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Repeat the new password'), 'dummy-long-enough-password');
    expect(screen.getByText('Looks good')).toBeInTheDocument();
  });

  it('Update password reports "Fix the password first" and sends nothing while invalid', async () => {
    render(<SecurityTab />);
    await userEvent.type(screen.getByLabelText('Current password'), 'old');
    await userEvent.type(screen.getByLabelText('New password'), 'short');
    await userEvent.click(screen.getByRole('button', { name: 'Update password' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Fix the password first');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('a wrong current password shows "Current password is incorrect."', async () => {
    putResult = { status: 400, body: { error: 'Current password is incorrect.' } };
    render(<SecurityTab />);
    await userEvent.type(screen.getByLabelText('Current password'), 'wrong');
    await userEvent.type(screen.getByLabelText('New password'), 'dummy-long-enough-password');
    await userEvent.type(screen.getByLabelText('Repeat the new password'), 'dummy-long-enough-password');
    await userEvent.click(screen.getByRole('button', { name: 'Update password' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Current password is incorrect.');
  });

  it('success clears the fields', async () => {
    render(<SecurityTab />);
    await userEvent.type(screen.getByLabelText('Current password'), 'old-password-12');
    await userEvent.type(screen.getByLabelText('New password'), 'dummy-long-enough-password');
    await userEvent.type(screen.getByLabelText('Repeat the new password'), 'dummy-long-enough-password');
    await userEvent.click(screen.getByRole('button', { name: 'Update password' }));
    expect(await screen.findByText('Your password was changed')).toBeInTheDocument();
    expect(screen.getByLabelText('New password')).toHaveValue('');
  });
});

describe('General tab', () => {
  it('loads the own details; a duplicate email shows "That email is already in use."', async () => {
    putResult = { status: 409, body: { error: 'Conflict' } };
    render(<GeneralTab />);
    expect(await screen.findByLabelText('First name')).toHaveValue('Anna');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('That email is already in use.');
  });
});

describe('Business units tab', () => {
  it('shows role and store with the Explicit store or From parent caption', async () => {
    render(<BusinessUnitsTab />);
    expect(await screen.findByText('Test Garage')).toBeInTheDocument();
    expect(screen.getByText('From parent')).toBeInTheDocument();
    expect(screen.getByText('Explicit store')).toBeInTheDocument();
  });
});

describe('Account tabs', () => {
  it('has General, Security, Addresses and Business units', () => {
    pathname = '/account/business-units';
    render(<AccountTabs />);
    expect(screen.getAllByRole('link').map((a) => a.textContent)).toEqual(['General', 'Security', 'Addresses', 'Business units']);
    expect(screen.getByRole('link', { name: 'Business units' })).toHaveAttribute('aria-current', 'page');
  });
});

describe('a11y: account tabs', () => {
  it('Security, General, Business units and the tab links have no axe violations', async () => {
    pathname = '/account/general';
    for (const ui of [<AccountTabs key="t" />, <SecurityTab key="s" />, <GeneralTab key="g" />, <BusinessUnitsTab key="b" />]) {
      const { container, unmount } = render(ui);
      await screen.findAllByText(/./);
      expect(await axe(container, { rules: { region: { enabled: false } } })).toHaveNoViolations();
      unmount();
    }
  });
});
