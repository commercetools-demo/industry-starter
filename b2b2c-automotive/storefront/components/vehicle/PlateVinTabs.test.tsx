// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { installFakeApi, renderVehicle } from '@/test/vehicle';
import { PlateVinTabs } from './PlateVinTabs';

vi.mock('@/i18n/routing', () => ({ useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }), usePathname: () => '/shop', Link: 'a' }));
afterEach(() => vi.unstubAllGlobals());

const golf = { id: 'volkswagen.golf.2016.2-0-tdi', make: 'Volkswagen', model: 'Golf', year: 2016, engine: '2.0 TDI', label: '2016 Volkswagen Golf · 2.0 TDI' };

async function openPlate(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('tab', { name: 'Plate' }));
}

describe('Plate and VIN tabs (mock provider, Demo lookup)', () => {
  it('tabs hidden when lookup disabled', async () => {
    installFakeApi();
    renderVehicle(<PlateVinTabs />, { lookupEnabled: false });
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(await screen.findByRole('combobox', { name: 'Make' })).toBeInTheDocument();
  });

  it('shows the three tabs with make, model, year first', async () => {
    installFakeApi();
    renderVehicle(<PlateVinTabs />, { lookupEnabled: true });
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual(['Make, model, year', 'Plate', 'VIN']);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    expect(await screen.findByRole('combobox', { name: 'Make' })).toBeInTheDocument();
  });

  it('plate resolves and asks for confirmation', async () => {
    const api = installFakeApi();
    api.lookup({ status: 'resolved', vehicle: golf });
    const user = userEvent.setup();
    const onAdded = vi.fn();
    renderVehicle(<PlateVinTabs onAdded={onAdded} />, { lookupEnabled: true });
    await openPlate(user);
    await user.type(screen.getByRole('textbox', { name: 'Registration plate' }), 'B-AB 1234');
    await user.click(screen.getByRole('button', { name: 'Look up' }));
    expect(await screen.findByText('2016 Volkswagen Golf · 2.0 TDI')).toBeInTheDocument();
    expect(screen.getByText('Demo lookup')).toBeInTheDocument();
    expect(api.state().vehicles).toHaveLength(0);
    expect(api.calls().filter((c) => c.startsWith('POST /api/garage'))).toEqual([]);
    await user.click(screen.getByRole('button', { name: 'Save to garage' }));
    await waitFor(() => expect(onAdded).toHaveBeenCalled());
    expect(api.state().active?.id).toBe(golf.id);
  });

  it('Not my car clears the result and saves nothing', async () => {
    const api = installFakeApi();
    api.lookup({ status: 'resolved', vehicle: golf });
    const user = userEvent.setup();
    renderVehicle(<PlateVinTabs />, { lookupEnabled: true });
    await openPlate(user);
    await user.type(screen.getByRole('textbox', { name: 'Registration plate' }), 'B-AB 1234');
    await user.click(screen.getByRole('button', { name: 'Look up' }));
    await user.click(await screen.findByRole('button', { name: 'Not my car' }));
    expect(screen.queryByText('2016 Volkswagen Golf · 2.0 TDI')).not.toBeInTheDocument();
    expect(api.state().vehicles).toHaveLength(0);
  });

  it('plate matches several engines requires engine pick', async () => {
    const api = installFakeApi();
    api.lookup({
      status: 'needs-engine',
      make: 'Volkswagen',
      model: 'Golf',
      year: 2016,
      engines: [
        { key: '1-4-tsi', label: '1.4 TSI' },
        { key: '2-0-tdi', label: '2.0 TDI' },
      ],
    });
    const user = userEvent.setup();
    renderVehicle(<PlateVinTabs />, { lookupEnabled: true });
    await openPlate(user);
    await user.type(screen.getByRole('textbox', { name: 'Registration plate' }), 'HH-XY 99');
    await user.click(screen.getByRole('button', { name: 'Look up' }));
    expect(await screen.findByText(/We found a 2016 Volkswagen Golf\. Choose the engine to continue\./)).toBeInTheDocument();
    const save = screen.getByRole('button', { name: 'Save to garage' });
    expect(save).toBeDisabled();
    expect(api.state().vehicles).toHaveLength(0);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Engine' }), '2-0-tdi');
    expect(save).toBeEnabled();
    await user.click(save);
    await waitFor(() => expect(api.state().active?.id).toBe('volkswagen.golf.2016.2-0-tdi'));
  });

  it('lookup failure offers make model year route and saves nothing', async () => {
    const api = installFakeApi();
    api.lookup({ status: 'not-found' });
    const user = userEvent.setup();
    renderVehicle(<PlateVinTabs />, { lookupEnabled: true });
    await openPlate(user);
    const field = screen.getByRole('textbox', { name: 'Registration plate' });
    await user.type(field, 'ZZ 0');
    await user.click(screen.getByRole('button', { name: 'Look up' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('We could not find that plate. Check it or choose your vehicle by make, model and year.');
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(field.getAttribute('aria-describedby')).toContain(alert.id);
    expect(api.state().vehicles).toHaveLength(0);
    await user.click(screen.getByRole('button', { name: 'Choose by make, model and year' }));
    expect(screen.getByRole('tab', { name: 'Make, model, year' })).toHaveAttribute('aria-selected', 'true');
    expect(await screen.findByRole('combobox', { name: 'Make' })).toBeInTheDocument();
  });

  it('an invalid plate is explained without a request', async () => {
    const api = installFakeApi();
    const user = userEvent.setup();
    renderVehicle(<PlateVinTabs />, { lookupEnabled: true });
    await openPlate(user);
    await user.type(screen.getByRole('textbox', { name: 'Registration plate' }), 'B*AB');
    await user.click(screen.getByRole('button', { name: 'Look up' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('This is not a plate we can read');
    expect(api.calls().some((c) => c.includes('/lookup'))).toBe(false);
  });

  it('vin with a bad length shows the error', async () => {
    const api = installFakeApi();
    const user = userEvent.setup();
    renderVehicle(<PlateVinTabs />, { lookupEnabled: true });
    await user.click(screen.getByRole('tab', { name: 'VIN' }));
    await user.type(screen.getByRole('textbox', { name: 'VIN' }), 'WVWZZZAUZGW00000');
    await user.click(screen.getByRole('button', { name: 'Look up' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('A VIN has exactly 17 characters.');
    expect(api.state().vehicles).toHaveLength(0);
  });

  it('vin with a forbidden letter shows the characters error', async () => {
    installFakeApi();
    const user = userEvent.setup();
    renderVehicle(<PlateVinTabs />, { lookupEnabled: true });
    await user.click(screen.getByRole('tab', { name: 'VIN' }));
    await user.type(screen.getByRole('textbox', { name: 'VIN' }), 'WVWZZZAUZGW00000I');
    await user.click(screen.getByRole('button', { name: 'Look up' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('never I, O or Q');
  });

  it('a known vin resolves', async () => {
    const api = installFakeApi();
    api.lookup({ status: 'resolved', vehicle: golf });
    const user = userEvent.setup();
    renderVehicle(<PlateVinTabs />, { lookupEnabled: true });
    await user.click(screen.getByRole('tab', { name: 'VIN' }));
    await user.type(screen.getByRole('textbox', { name: 'VIN' }), 'wvwzzzauzgw000001');
    await user.click(screen.getByRole('button', { name: 'Look up' }));
    expect(await screen.findByText('2016 Volkswagen Golf · 2.0 TDI')).toBeInTheDocument();
  });

  it('an unavailable lookup points to the selectors', async () => {
    const api = installFakeApi();
    api.lookup({ status: 'unavailable' });
    const user = userEvent.setup();
    renderVehicle(<PlateVinTabs />, { lookupEnabled: true });
    await openPlate(user);
    await user.type(screen.getByRole('textbox', { name: 'Registration plate' }), 'ZZ 0');
    await user.click(screen.getByRole('button', { name: 'Look up' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('The lookup is not available right now');
  });

  it('arrow keys move between tabs', async () => {
    installFakeApi();
    const user = userEvent.setup();
    renderVehicle(<PlateVinTabs />, { lookupEnabled: true });
    screen.getByRole('tab', { name: 'Make, model, year' }).focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Plate' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Plate' })).toHaveFocus();
  });

  it('no axe violations', async () => {
    installFakeApi();
    const user = userEvent.setup();
    const { container } = renderVehicle(<PlateVinTabs />, { lookupEnabled: true });
    await openPlate(user);
    expect(await axe(container)).toHaveNoViolations();
  });
});
