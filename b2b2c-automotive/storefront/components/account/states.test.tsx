// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Workstream Q-13: every account page has an empty and an error state in plain words, a retry, and is accessible in both languages.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import type { ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DELETE_WORDS } from '@/lib/account/delete-word';
import deMessages from '@/messages/de-DE.json';
import enMessages from '@/messages/en-US.json';

vi.mock('@/i18n/routing', async () => (await import('./test-support')).routingMock());
vi.mock('@/components/vehicle/PlateVinTabs', () => ({ PlateVinTabs: () => <div /> }));

import AccountError from '@/app/[locale]/[store]/(account)/account/error';
import { AddressBook } from './AddressBook';
import { GaragePanel } from './GaragePanel';
import { OrderList } from './OrderList';
import { OverviewPanel } from './OverviewPanel';
import { PaymentMethodsPanel } from './PaymentMethodsPanel';
import { ProfileForm } from './ProfileForm';
import { ReturnList } from './ReturnList';
import { SubscriptionList } from './SubscriptionList';
import { renderAccount, stubFetch } from './test-support';

const emptyGarage = { garage: { vehicles: [], activeId: null }, vehicles: [], active: null };
const serverError = () => new Response('{}', { status: 500 });

interface Page {
  name: string;
  ui: () => ReactElement;
  routes: Record<string, unknown>;
  empty: string;
  de: string;
  error?: { routes: Record<string, unknown> };
}

const pages: Page[] = [
  { name: 'overview', ui: () => <OverviewPanel store="s" firstName="Anna" latest={null} ready={[]} timeZone="UTC" />, routes: { 'GET /api/garage': emptyGarage }, empty: 'You have not placed an order yet.', de: 'Sie haben noch keine Bestellung aufgegeben.' },
  { name: 'orders', ui: () => <OrderList store="s" list={{ items: [], page: 1, pageSize: 10, total: 0 }} />, routes: {}, empty: 'You have no orders yet.', de: 'Sie haben noch keine Bestellungen.' },
  { name: 'garage', ui: () => <GaragePanel />, routes: { 'GET /api/garage': emptyGarage }, empty: 'Your garage is empty.', de: 'Ihre Garage ist leer.' },
  { name: 'addresses', ui: () => <AddressBook />, routes: { 'GET /api/account/addresses': { addresses: [], defaultShippingAddressId: null, countries: ['DE'] } }, empty: 'You have no saved addresses.', de: 'Sie haben keine gespeicherten Adressen.', error: { routes: { 'GET /api/account/addresses': serverError() } } },
  {
    name: 'payment methods',
    ui: () => <PaymentMethodsPanel />,
    routes: { 'GET /api/account/payment-methods': { methods: [], hasSubscriptions: false } },
    empty: 'No saved payment methods. Methods saved during checkout, for example for a subscription, appear here.',
    de: 'Keine gespeicherten Zahlungsarten.',
    error: { routes: { 'GET /api/account/payment-methods': serverError() } },
  },
  {
    name: 'subscriptions',
    ui: () => <SubscriptionList store="s" />,
    routes: { 'GET /api/account/subscriptions': { offered: true, subscriptions: [], policies: [] } },
    empty: 'You have no subscriptions yet. Look for Subscribe and save on eligible parts.',
    de: 'Sie haben noch keine Abos.',
    error: { routes: { 'GET /api/account/subscriptions': serverError() } },
  },
  { name: 'returns', ui: () => <ReturnList store="s" returns={[]} />, routes: {}, empty: 'You have not requested a return.', de: 'Sie haben keine Retoure angefordert.' },
  { name: 'profile', ui: () => <ProfileForm />, routes: { 'GET /api/account/profile': { profile: { email: 'a@example.com', firstName: null, lastName: null, mobile: null, marketingConsent: false } } }, empty: 'Your details', de: 'Ihre Angaben', error: { routes: { 'GET /api/account/profile': serverError() } } },
];

beforeEach(() => vi.unstubAllGlobals());

describe('each account page renders an empty state', () => {
  it.each(pages)('$name, in en-US and de-DE, with no axe violations', async (page) => {
    stubFetch(page.routes);
    const en = renderAccount(page.ui(), 'en-US');
    expect(await screen.findByText(page.empty)).toBeInTheDocument();
    expect(await axe(en.container)).toHaveNoViolations();
    en.unmount();
    vi.unstubAllGlobals();
    stubFetch(page.routes);
    const de = renderAccount(page.ui(), 'de-DE');
    expect(await screen.findByText(new RegExp(page.de))).toBeInTheDocument();
    expect(await axe(de.container)).toHaveNoViolations();
  });
});

describe('each account page renders an error state with retry', () => {
  it.each(pages.filter((p) => p.error))('$name', async (page) => {
    stubFetch(page.error?.routes ?? {});
    renderAccount(page.ui());
    expect(await screen.findByText('We could not load this page.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
  it('the server rendered pages share one error boundary whose retry renders the page again', async () => {
    const reset = vi.fn();
    renderAccount(<AccountError error={new Error('boom with secret')} reset={reset} />);
    expect(screen.getByText('We could not load this page.')).toBeInTheDocument();
    expect(screen.queryByText(/secret/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(reset).toHaveBeenCalledTimes(1);
  });
  it('the loading state is announced', async () => {
    const { default: AccountLoading } = await import('@/app/[locale]/[store]/(account)/account/loading');
    renderAccount(<AccountLoading />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading');
  });
});

describe('catalogs and sources', () => {
  it('the typed delete word of both catalogs is one the server accepts', () => {
    expect(DELETE_WORDS).toContain(enMessages.account.profile.deleteConfirmWord);
    expect(DELETE_WORDS).toContain(deMessages.account.profile.deleteConfirmWord);
  });

  const walk = (dir: string): string[] => readdirSync(dir).flatMap((f) => (statSync(path.join(dir, f)).isDirectory() ? walk(path.join(dir, f)) : [path.join(dir, f)]));
  const sources = walk('components/account').filter((f) => /\.tsx?$/.test(f) && !/\.test\.|test-support/.test(f));

  it('no hard-coded currency or tax literal in components/account', () => {
    for (const file of sources) {
      const text = readFileSync(file, 'utf8');
      expect(text, file).not.toMatch(/['"`](EUR|USD|CAD|GBP)['"`]/);
      expect(text, file).not.toMatch(/\bHST\b|\bVAT\b|\bMwSt/);
      expect(text, file).not.toMatch(/[$€£]\s?\d/);
    }
  });

  it('no raw colour, px size or font name in components/account (tokens only)', () => {
    for (const file of sources) {
      const text = readFileSync(file, 'utf8');
      expect(text, file).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(text, file).not.toMatch(/\b\d+px\b/);
      expect(text, file).not.toMatch(/font-family|Archivo|Poppins/);
    }
  });

  it('no unscoped account query: every exported function of the account modules takes the customer (or store and customer)', () => {
    const modules = ['account-orders', 'account-addresses', 'account-subscriptions', 'account-payment-methods', 'account-customer'];
    const allowed = new Set(['registerCustomer', 'requestPasswordResetToken', 'resetPassword', 'verifyPassword', 'getAccountOrder', 'subscriptionsOffered']);
    for (const mod of modules) {
      const text = readFileSync(`lib/ct/${mod}.ts`, 'utf8');
      for (const match of text.matchAll(/export async function (\w+)\(([^)]*)\)/g)) {
        const [, name, params] = match;
        if (allowed.has(name)) continue;
        expect(params, `${mod}.${name}`).toMatch(/customerId/);
      }
    }
    // The ones that take the customer under another name are checked by hand: getAccountOrder and subscriptionsOffered take it too.
    for (const [mod, name] of [['account-orders', 'getAccountOrder'], ['account-subscriptions', 'subscriptionsOffered']]) {
      expect(readFileSync(`lib/ct/${mod}.ts`, 'utf8')).toMatch(new RegExp(`export async function ${name}\\([^)]*customerId`));
    }
  });
});
