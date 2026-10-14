// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GarageState } from '@/lib/types';

vi.mock('@/i18n/routing', async () => (await import('./test-support')).routingMock());
vi.mock('@/components/vehicle/PlateVinTabs', () => ({ PlateVinTabs: () => <div data-testid="add-selectors">selectors</div> }));

import { AddressBook } from './AddressBook';
import { GaragePanel } from './GaragePanel';
import { renderAccount, router, stubFetch } from './test-support';

const entry = (id: string, model: string, nickname?: string) => ({ id, make: 'Volkswagen', model, year: 2016, engine: '2.0 TDI', fitmentKey: 'k', ...(nickname ? { nickname } : {}) });
const state = (entries: ReturnType<typeof entry>[], activeId: string | null): GarageState => ({
  garage: { vehicles: entries, activeId },
  vehicles: entries.map((e) => ({ id: e.id, make: e.make, model: e.model, year: e.year, engine: e.engine, label: `${e.year} ${e.make} ${e.model} · ${e.engine}` })),
  active: entries.filter((e) => e.id === activeId).map((e) => ({ id: e.id, make: e.make, model: e.model, year: e.year, engine: e.engine, label: `${e.year} ${e.make} ${e.model} · ${e.engine}` }))[0] ?? null,
});

beforeEach(() => {
  for (const fn of Object.values(router)) fn.mockReset();
  vi.unstubAllGlobals();
});

describe('GaragePanel', () => {
  const two = state([entry('a', 'Golf', 'Daily'), entry('b', 'Polo')], 'a');

  it('lists vehicles and marks active', async () => {
    stubFetch({ 'GET /api/garage': two });
    const { container } = renderAccount(<GaragePanel />);
    const list = await screen.findByRole('list', { name: 'Vehicles in your garage' });
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(within(items[0]).getByText('Active')).toBeInTheDocument();
    expect(within(items[0]).getByText('Daily')).toBeInTheDocument();
    expect(within(items[1]).queryByText('Active')).not.toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('sixth vehicle is refused with the full message', async () => {
    const five = state(['a', 'b', 'c', 'd', 'e'].map((id) => entry(id, `Model ${id}`)), 'a');
    stubFetch({ 'GET /api/garage': five });
    renderAccount(<GaragePanel />);
    expect(await screen.findByText('Your garage is full. Remove a vehicle to add another.')).toBeInTheDocument();
    expect(screen.queryByTestId('add-selectors')).not.toBeInTheDocument();
  });

  it('shows the add form while there is room', async () => {
    stubFetch({ 'GET /api/garage': two });
    renderAccount(<GaragePanel />);
    expect(await screen.findByTestId('add-selectors')).toBeInTheDocument();
  });

  it('rename saves', async () => {
    const renamed = state([entry('a', 'Golf', 'Weekend'), entry('b', 'Polo')], 'a');
    const calls = stubFetch({ 'GET /api/garage': two, 'PATCH /api/garage': renamed });
    renderAccount(<GaragePanel />);
    await userEvent.click(await screen.findByRole('button', { name: 'Rename Daily (2016 Volkswagen Golf · 2.0 TDI)' }));
    const input = screen.getByLabelText('Nickname');
    await userEvent.clear(input);
    await userEvent.type(input, 'Weekend');
    await userEvent.click(screen.getByRole('button', { name: 'Rename' }));
    await waitFor(() => expect(calls.some((c) => c.key === 'PATCH /api/garage')).toBe(true));
    expect(calls.find((c) => c.key === 'PATCH /api/garage')?.body).toEqual({ vehicleId: 'a', nickname: 'Weekend' });
    expect(await screen.findByText('Weekend')).toBeInTheDocument();
  });

  it('set active changes chip', async () => {
    const polo = state([entry('a', 'Golf', 'Daily'), entry('b', 'Polo')], 'b');
    const calls = stubFetch({ 'GET /api/garage': two, 'POST /api/garage/active': polo });
    renderAccount(<GaragePanel />);
    await userEvent.click(await screen.findByRole('button', { name: /Set active: 2016 Volkswagen Polo · 2.0 TDI/ }));
    await waitFor(() => expect(calls.some((c) => c.key === 'POST /api/garage/active')).toBe(true));
    expect(calls.find((c) => c.key === 'POST /api/garage/active')?.body).toEqual({ vehicleId: 'b' });
    await waitFor(() => {
      const items = within(screen.getByRole('list', { name: 'Vehicles in your garage' })).getAllByRole('listitem');
      expect(within(items[1]).getByText('Active')).toBeInTheDocument();
    });
  });

  it('remove asks to confirm', async () => {
    const calls = stubFetch({ 'GET /api/garage': two, 'DELETE /api/garage?vehicleId=b': state([entry('a', 'Golf', 'Daily')], 'a') });
    renderAccount(<GaragePanel />);
    await userEvent.click(await screen.findByRole('button', { name: 'Remove 2016 Volkswagen Polo · 2.0 TDI from your garage' }));
    expect(calls.some((c) => c.key.startsWith('DELETE'))).toBe(false);
    expect(screen.getByText('Remove 2016 Volkswagen Polo · 2.0 TDI from your garage?')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Yes, remove it' }));
    await waitFor(() => expect(calls.some((c) => c.key === 'DELETE /api/garage?vehicleId=b')).toBe(true));
    await waitFor(() => expect(within(screen.getByRole('list', { name: 'Vehicles in your garage' })).getAllByRole('listitem')).toHaveLength(1));
  });

  it('last vehicle removed returns no-vehicle state', async () => {
    const one = state([entry('a', 'Golf')], 'a');
    const calls = stubFetch({ 'GET /api/garage': one, 'DELETE /api/garage?vehicleId=a': state([], null) });
    renderAccount(<GaragePanel />);
    await userEvent.click(await screen.findByRole('button', { name: /Remove 2016 Volkswagen Golf/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Yes, remove it' }));
    await waitFor(() => expect(calls.some((c) => c.key.startsWith('DELETE'))).toBe(true));
    // The shared "no vehicle" text of the listings (`vehicleFit.unknown`) is what the page says now.
    expect(await screen.findByText(/Select your vehicle to check fit/)).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Vehicles in your garage' })).not.toBeInTheDocument();
  });

  it('empty garage shows add prompt', async () => {
    stubFetch({ 'GET /api/garage': state([], null) });
    renderAccount(<GaragePanel />);
    expect(await screen.findByText('Your garage is empty.')).toBeInTheDocument();
    expect(screen.getByTestId('add-selectors')).toBeInTheDocument();
  });

  it('a failed change is announced', async () => {
    stubFetch({ 'GET /api/garage': two, 'POST /api/garage/active': new Response('{}', { status: 500 }) });
    renderAccount(<GaragePanel />);
    await userEvent.click(await screen.findByRole('button', { name: /Set active: 2016 Volkswagen Polo/ }));
    expect(await screen.findByText('We could not update your garage. Please try again.')).toBeInTheDocument();
  });
});

describe('AddressBook', () => {
  const address = (id: string, city: string, isDefault = false) => ({ id, firstName: 'Anna', lastName: 'Schneider', streetName: 'Hauptstr.', streetNumber: '1', postalCode: '10115', city, country: 'DE', phone: null, isDefault });
  const book = (addresses: ReturnType<typeof address>[]) => ({ addresses, defaultShippingAddressId: addresses.find((a) => a.isDefault)?.id ?? null, countries: ['DE', 'AT'] });

  it('lists addresses with a default chip', async () => {
    stubFetch({ 'GET /api/account/addresses': book([address('a1', 'Berlin', true), address('a2', 'Hamburg')]) });
    const { container } = renderAccount(<AddressBook />);
    const list = await screen.findByRole('list', { name: 'Your addresses' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    expect(within(list).getAllByText('Default')).toHaveLength(1);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('empty state offers to add', async () => {
    stubFetch({ 'GET /api/account/addresses': book([]) });
    renderAccount(<AddressBook />);
    expect(await screen.findByText('You have no saved addresses.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add address' })).toBeInTheDocument();
  });

  it('the error state has a retry that reads again', async () => {
    let calls = 0;
    stubFetch({
      'GET /api/account/addresses': () => {
        calls += 1;
        return calls === 1 ? new Response('{}', { status: 500 }) : book([address('a1', 'Berlin', true)]);
      },
    });
    renderAccount(<AddressBook />);
    expect(await screen.findByText('We could not load this page.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('list', { name: 'Your addresses' })).toBeInTheDocument();
  });

  it('adds an address through the form, with autocomplete tokens', async () => {
    const calls = stubFetch({
      'GET /api/account/addresses': book([address('a1', 'Berlin', true)]),
      'POST /api/account/addresses': book([address('a1', 'Berlin', true), address('a2', 'Hamburg')]),
    });
    renderAccount(<AddressBook />);
    await userEvent.click(await screen.findByRole('button', { name: 'Add address' }));
    expect(screen.getByLabelText('Postal code')).toHaveAttribute('autocomplete', 'postal-code');
    expect(screen.getByLabelText('First name')).toHaveAttribute('autocomplete', 'given-name');
    await userEvent.type(screen.getByLabelText('First name'), 'Anna');
    await userEvent.type(screen.getByLabelText('Last name'), 'Schneider');
    await userEvent.type(screen.getByLabelText('Street'), 'Elbchaussee');
    await userEvent.type(screen.getByLabelText('Postal code'), '22765');
    await userEvent.type(screen.getByLabelText('City'), 'Hamburg');
    await userEvent.click(screen.getByLabelText('Use as my default delivery address'));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(calls.some((c) => c.key === 'POST /api/account/addresses')).toBe(true));
    expect(calls.find((c) => c.key === 'POST /api/account/addresses')?.body).toMatchObject({ postalCode: '22765', city: 'Hamburg', country: 'DE', makeDefault: true });
    expect(await screen.findByRole('list', { name: 'Your addresses' })).toBeInTheDocument();
  });

  it('shows the refusal of the server in words', async () => {
    stubFetch({
      'GET /api/account/addresses': book([]),
      'POST /api/account/addresses': new Response(JSON.stringify({ error: 'postal-invalid' }), { status: 400 }),
    });
    renderAccount(<AddressBook />);
    await userEvent.click(await screen.findByRole('button', { name: 'Add address' }));
    for (const [label, value] of [['First name', 'A'], ['Last name', 'B'], ['Street', 'S'], ['Postal code', '1'], ['City', 'C']] as const) await userEvent.type(screen.getByLabelText(label), value);
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Check the postal code.')).toBeInTheDocument();
  });

  it('make default and delete (asks first)', async () => {
    const after = book([address('a1', 'Berlin'), address('a2', 'Hamburg', true)]);
    const calls = stubFetch({
      'GET /api/account/addresses': book([address('a1', 'Berlin', true), address('a2', 'Hamburg')]),
      'PATCH /api/account/addresses/a2': after,
      'DELETE /api/account/addresses/a1': book([address('a2', 'Hamburg', true)]),
    });
    renderAccount(<AddressBook />);
    const list = await screen.findByRole('list', { name: 'Your addresses' });
    await userEvent.click(within(within(list).getAllByRole('listitem')[1]).getByRole('button', { name: 'Make default' }));
    await waitFor(() => expect(calls.some((c) => c.key === 'PATCH /api/account/addresses/a2')).toBe(true));
    await waitFor(() => expect(within(screen.getByRole('list', { name: 'Your addresses' })).getAllByRole('listitem')[1]).toHaveTextContent('Default'));
    await userEvent.click(screen.getAllByRole('button', { name: /Delete address/ })[0]);
    expect(calls.some((c) => c.key.startsWith('DELETE'))).toBe(false);
    await userEvent.click(screen.getByRole('button', { name: 'Yes, delete it' }));
    await waitFor(() => expect(calls.some((c) => c.key === 'DELETE /api/account/addresses/a1')).toBe(true));
  });

  it('twenty addresses show the limit and no add button', async () => {
    stubFetch({ 'GET /api/account/addresses': book(Array.from({ length: 20 }, (_, i) => address(`a${i}`, `City ${i}`, i === 0))) });
    renderAccount(<AddressBook />);
    expect(await screen.findByText('You can save up to 20 addresses. Delete one to add another.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add address' })).not.toBeInTheDocument();
  });

  it('de-DE', async () => {
    stubFetch({ 'GET /api/account/addresses': book([]) });
    renderAccount(<AddressBook />, 'de-DE');
    expect(await screen.findByText('Sie haben keine gespeicherten Adressen.')).toBeInTheDocument();
  });
});
