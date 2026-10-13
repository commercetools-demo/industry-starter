// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { installFakeApi, renderVehicle, stateOf } from '@/test/vehicle';
import { ChangeVehicleDialog } from './ChangeVehicleDialog';
import { GarageBar } from './GarageBar';
import { GarageChip } from './GarageChip';
import { VehicleFinderCard } from './VehicleFinderCard';

vi.mock('@/i18n/routing', () => ({ useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }), usePathname: () => '/shop', Link: 'a' }));
afterEach(() => vi.unstubAllGlobals());

const GOLF = 'volkswagen.golf.2016.2-0-tdi';
const A3 = 'audi.a3.2018.1-4-tfsi';
const CARDS = { five: ['volkswagen.golf.2016.2-0-tdi', 'audi.a3.2018.1-4-tfsi', 'opel.astra.2019.1-4-turbo', 'bmw.3-series.2017.320d', 'renault.clio.2021.1-0-tce'] };

describe('Vehicle finder card (home page)', () => {
  it('empty garage shows selectors', async () => {
    installFakeApi();
    renderVehicle(<VehicleFinderCard partsHref="/store/parts" />);
    expect(screen.getByRole('heading', { name: 'Find parts for your vehicle' })).toBeInTheDocument();
    expect(await screen.findByRole('combobox', { name: 'Make' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Verify fitment' })).toBeDisabled();
    expect(screen.queryByRole('link', { name: 'Shop parts that fit' })).not.toBeInTheDocument();
  });

  it('saved vehicle shows chip Change and Shop parts that fit', () => {
    const garage = stateOf(GOLF);
    installFakeApi(garage);
    renderVehicle(<VehicleFinderCard partsHref="/store/parts" />, { garage });
    expect(screen.getByText('2016 Volkswagen Golf · 2.0 TDI')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Change' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Shop parts that fit' })).toHaveAttribute('href', '/store/parts');
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Vehicles in your garage' })).not.toBeInTheDocument();
  });

  it('lists the garage with Set active and Remove when there is more than one vehicle', async () => {
    const garage = stateOf(GOLF, A3);
    const api = installFakeApi(garage);
    const user = userEvent.setup();
    renderVehicle(<VehicleFinderCard partsHref="/store/parts" />, { garage });
    const list = screen.getByRole('list', { name: 'Vehicles in your garage' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    await user.click(within(list).getByRole('button', { name: /Set active: 2016 Volkswagen Golf · 2.0 TDI/ }));
    await waitFor(() => expect(api.state().active?.id).toBe(GOLF));
    await user.click(within(list).getByRole('button', { name: /Remove 2018 Audi A3/ }));
    await waitFor(() => expect(api.state().vehicles).toHaveLength(1));
    expect(screen.getByText('2016 Volkswagen Golf · 2.0 TDI')).toBeInTheDocument();
  });

  it('change opens the dialog and keeps focus management', async () => {
    const garage = stateOf(GOLF);
    installFakeApi(garage);
    const user = userEvent.setup();
    renderVehicle(<VehicleFinderCard partsHref="/store/parts" />, { garage });
    const change = screen.getByRole('button', { name: 'Change' });
    await user.click(change);
    const dialog = await screen.findByRole('dialog', { name: 'Your vehicles' });
    expect(dialog).toBeInTheDocument();
    expect(dialog.contains(document.activeElement)).toBe(true);
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(change).toHaveFocus();
  });

  it('five vehicles cap shows a message when adding a sixth', async () => {
    const garage = stateOf(...CARDS.five);
    const api = installFakeApi(garage);
    const user = userEvent.setup();
    renderVehicle(<VehicleFinderCard partsHref="/store/parts" />, { garage });
    await user.click(screen.getByRole('button', { name: 'Change' }));
    const dialog = await screen.findByRole('dialog', { name: 'Your vehicles' });
    expect(within(dialog).getByRole('status')).toHaveTextContent('Your garage holds five vehicles');
    expect(api.state().vehicles).toHaveLength(5);
  });

  it('adding a sixth vehicle through the dialog replaces the oldest and closes it', async () => {
    const garage = stateOf(...CARDS.five);
    const api = installFakeApi(garage);
    const user = userEvent.setup();
    renderVehicle(<VehicleFinderCard partsHref="/store/parts" />, { garage });
    await user.click(screen.getByRole('button', { name: 'Change' }));
    const dialog = await screen.findByRole('dialog', { name: 'Your vehicles' });
    await waitFor(() => expect(within(dialog).getByRole('combobox', { name: 'Make' })).toHaveTextContent('Ford'));
    await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Make' }), 'ford');
    await waitFor(() => expect(within(dialog).getByRole('combobox', { name: 'Model' })).toHaveTextContent('Focus'));
    await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Model' }), 'focus');
    await waitFor(() => expect(within(dialog).getByRole('combobox', { name: 'Year' })).toHaveTextContent('2020'));
    await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Year' }), '2020');
    await waitFor(() => expect(within(dialog).getByRole('combobox', { name: 'Engine' })).toHaveTextContent('1.0 EcoBoost'));
    await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Engine' }), '1-0-ecoboost');
    await user.click(within(dialog).getByRole('button', { name: 'Verify fitment' }));
    await waitFor(() => expect(api.state().active?.id).toBe('ford.focus.2020.1-0-ecoboost'));
    expect(api.state().vehicles).toHaveLength(5);
    expect(api.state().vehicles.map((v) => v.id)).not.toContain(GOLF);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('shows the Plate and VIN tabs when lookup is enabled', async () => {
    installFakeApi();
    renderVehicle(<VehicleFinderCard partsHref="/store/parts" />, { lookupEnabled: true });
    expect(screen.getByRole('tab', { name: 'Plate' })).toBeInTheDocument();
    expect(await screen.findByRole('combobox', { name: 'Make' })).toBeInTheDocument();
  });

  it('no axe violations', async () => {
    const garage = stateOf(GOLF, A3);
    installFakeApi(garage);
    const { container } = renderVehicle(<VehicleFinderCard partsHref="/store/parts" />, { garage });
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('Garage chip (header slot)', () => {
  it('shows the active vehicle and Change', async () => {
    const garage = stateOf(GOLF);
    installFakeApi(garage);
    const user = userEvent.setup();
    renderVehicle(<GarageChip />, { garage });
    expect(screen.getByText('2016 Volkswagen Golf · 2.0 TDI')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Change' }));
    expect(await screen.findByRole('dialog', { name: 'Your vehicles' })).toBeInTheDocument();
  });

  it('asks to select a vehicle when the garage is empty', async () => {
    installFakeApi();
    const user = userEvent.setup();
    renderVehicle(<GarageChip />);
    await user.click(screen.getByRole('button', { name: 'Select your vehicle' }));
    expect(await screen.findByRole('combobox', { name: 'Make' })).toBeInTheDocument();
  });
});

describe('Garage bar (listing)', () => {
  it('shows MY GARAGE, the chip and Change vehicle', () => {
    const garage = stateOf(GOLF);
    installFakeApi(garage);
    renderVehicle(<GarageBar />, { garage });
    expect(screen.getByText('My garage')).toBeInTheDocument();
    expect(screen.getByText('2016 Volkswagen Golf · 2.0 TDI')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Change vehicle' })).toBeInTheDocument();
  });

  it('without a vehicle shows Select your vehicle and a collapsed selector row', async () => {
    installFakeApi();
    const user = userEvent.setup();
    const { container } = renderVehicle(<GarageBar />);
    const details = container.querySelector('details') as HTMLDetailsElement;
    expect(details.open).toBe(false);
    await user.click(screen.getByText('Select your vehicle'));
    expect(details.open).toBe(true);
    expect(await screen.findByRole('combobox', { name: 'Make' })).toBeInTheDocument();
  });
});

describe('Change vehicle dialog', () => {
  it('lists vehicles and closes with the Close button', async () => {
    const garage = stateOf(GOLF, A3);
    installFakeApi(garage);
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderVehicle(<ChangeVehicleDialog open onClose={onClose} />, { garage });
    const dialog = await screen.findByRole('dialog', { name: 'Your vehicles' });
    expect(within(dialog).getAllByRole('listitem')).toHaveLength(2);
    await user.click(within(dialog).getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalled();
  });
});
