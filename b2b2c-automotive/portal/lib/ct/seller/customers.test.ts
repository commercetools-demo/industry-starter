/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createVFake, type VFake } from '@/lib/portal/v-fixture-root';
import { addCustomerNote, customerForShopAs, getCustomerDetail, listCustomers } from './customers';
import { parseGarage } from './garage';
import { V_CONTAINERS, listObjects } from './v-objects';
import { setVRootForTest } from './v-root';

const NOW = new Date('2026-10-12T10:00:00Z');
let fake: VFake;

beforeEach(() => {
  fake = createVFake({ now: () => NOW, demo: true });
  setVRootForTest(fake.root);
});
afterEach(() => setVRootForTest(undefined));

describe('customers list', () => {
  it('lists only the store shoppers, masked, and the Guests tab only guests', async () => {
    const all = await listCustomers('fx-store-online');
    expect(all.kpis.registered).toBe(3);
    expect(all.kpis.guests).toBe(2);
    expect(all.rows.every((r) => !r.email.includes('example.com') || r.email.includes('***'))).toBe(true);
    const guests = await listCustomers('fx-store-online', { tab: 'guests' });
    expect(guests.rows.length).toBe(2);
    expect(guests.rows.every((r) => r.type === 'Guest' && r.id === null)).toBe(true);
    const south = await listCustomers('fx-store-south');
    expect(south.kpis.registered).toBe(1);
    expect(JSON.stringify(south)).not.toContain('fx-shopper-online');
  });

  it('searches by name or e-mail without returning the e-mail', async () => {
    const found = await listCustomers('fx-store-online', { q: 'beispiel' });
    expect(found.rows.map((r) => r.name)).toEqual(['Ben Beispiel']);
    expect(JSON.stringify(found)).not.toContain('beispiel.online@example.com');
    expect((await listCustomers('fx-store-online', { q: 'zzz' })).rows).toHaveLength(0);
  });
});

describe('customer detail', () => {
  it("a customer of another store is not found; the read goes through the in-store endpoint", async () => {
    await expect(getCustomerDetail('fx-store-south', 'fx-shopper-online-1', ['admin'])).rejects.toMatchObject({ status: 404 });
    await expect(customerForShopAs('fx-store-south', 'fx-shopper-online-1')).rejects.toMatchObject({ status: 404 });
    expect(fake.calls.filter((c) => c.op === 'customer.get').length).toBe(2);
  });

  it('shows orders, garage, consent, subscriptions and returns; the full e-mail for an Admin only', async () => {
    const admin = await getCustomerDetail('fx-store-online', 'fx-shopper-online-1', ['admin']);
    expect(admin.email).toBe('anna.muster.online@example.com');
    expect(admin.mobile).toBeTruthy();
    expect(admin.orders.length).toBeGreaterThanOrEqual(2);
    expect(admin.garage).toEqual([{ id: 'volkswagen-golf-2016-2-0-tdi', label: '2016 Volkswagen Golf · 2.0 TDI' }]);
    expect(admin.marketingConsent).toBe(true);
    expect(admin.subscriptions.length).toBe(1);
    expect(admin.returns.length).toBe(1);
    const buyer = await getCustomerDetail('fx-store-online', 'fx-shopper-online-1', ['buyer']);
    expect(buyer.email).toBe('a***@e***.com');
    expect(buyer.mobile).toBeUndefined();
  });

  it('notes are added and listed; over 1,000 characters is refused; another store cannot add', async () => {
    await addCustomerNote('fx-store-online', 'fx-shopper-online-1', ' TST-V-note ', 'actor-1', NOW);
    const detail = await getCustomerDetail('fx-store-online', 'fx-shopper-online-1', ['admin']);
    expect(detail.notes).toEqual([{ text: 'TST-V-note', by: 'actor-1', at: NOW.toISOString() }]);
    await expect(addCustomerNote('fx-store-online', 'fx-shopper-online-1', 'x'.repeat(1001), 'a', NOW)).rejects.toMatchObject({ status: 400 });
    await expect(addCustomerNote('fx-store-south', 'fx-shopper-online-1', 'hi', 'a', NOW)).rejects.toMatchObject({ status: 404 });
    expect((await listObjects(V_CONTAINERS.notes)).map((o) => o.key)).toEqual(['fx-store-online--fx-shopper-online-1']);
  });
});

describe('garage guard', () => {
  it('parses the seed JSON, caps at five and drops malformed entries; shows nothing for a missing field', () => {
    const vehicles = Array.from({ length: 7 }, (_, i) => ({ id: `v${i}`, make: 'VW', model: 'Golf', year: 2010 + i, engine: '1.4 TSI' }));
    expect(parseGarage(JSON.stringify({ vehicles, activeId: 'v0' }))).toHaveLength(5);
    expect(parseGarage(JSON.stringify({ vehicles: [{ id: 'x', make: 'VW' }] }))).toEqual([]);
    expect(parseGarage('not json')).toEqual([]);
    expect(parseGarage(undefined)).toEqual([]);
  });
});
