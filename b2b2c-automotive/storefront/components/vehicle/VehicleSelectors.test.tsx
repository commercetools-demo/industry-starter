// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { installFakeApi, renderVehicle } from '@/test/vehicle';
import { VehicleSelectors } from './VehicleSelectors';

vi.mock('@/i18n/routing', () => ({ useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }), usePathname: () => '/shop', Link: 'a' }));
afterEach(() => vi.unstubAllGlobals());

const select = (name: string) => screen.getByRole('combobox', { name }) as HTMLSelectElement;
const optionTexts = (name: string) => Array.from(select(name).options).map((o) => o.textContent);

async function chooseAll(user: ReturnType<typeof userEvent.setup>) {
  await waitFor(() => expect(optionTexts('Make')).toContain('Volkswagen'));
  await user.selectOptions(select('Make'), 'volkswagen');
  await waitFor(() => expect(optionTexts('Model')).toContain('Golf'));
  await user.selectOptions(select('Model'), 'golf');
  await waitFor(() => expect(optionTexts('Year')).toContain('2016'));
  await user.selectOptions(select('Year'), '2016');
  await waitFor(() => expect(optionTexts('Engine')).toContain('2.0 TDI'));
  await user.selectOptions(select('Engine'), '2-0-tdi');
}

describe('Vehicle selectors', () => {
  it('starts with only Make enabled and Verify disabled', async () => {
    installFakeApi();
    renderVehicle(<VehicleSelectors />);
    await waitFor(() => expect(optionTexts('Make')).toContain('Volkswagen'));
    expect(select('Make')).toBeEnabled();
    for (const name of ['Model', 'Year', 'Engine']) expect(select(name)).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Verify fitment' })).toBeDisabled();
  });

  it('models load after make', async () => {
    const api = installFakeApi();
    const user = userEvent.setup();
    renderVehicle(<VehicleSelectors />);
    await waitFor(() => expect(optionTexts('Make')).toContain('Volkswagen'));
    await user.selectOptions(select('Make'), 'volkswagen');
    await waitFor(() => expect(optionTexts('Model')).toContain('Golf'));
    expect(select('Model')).toBeEnabled();
    expect(api.calls()).toContain('GET /api/vehicles/options?market=DE&make=volkswagen');
  });

  it('years run over every year of the ranges, newest first', async () => {
    installFakeApi();
    const user = userEvent.setup();
    renderVehicle(<VehicleSelectors />, { locale: 'de-DE' });
    await waitFor(() => expect(optionTexts('Make')).toContain('Volkswagen'));
    await user.selectOptions(select('Make'), 'volkswagen');
    await waitFor(() => expect(optionTexts('Model')).toContain('Golf'));
    await user.selectOptions(select('Model'), 'golf');
    await waitFor(() => expect(optionTexts('Year')).toContain('2012'));
    expect(optionTexts('Year').slice(1, 3)).toEqual(['2024', '2023']);
  });

  it('changing make clears the rest', async () => {
    installFakeApi();
    const user = userEvent.setup();
    renderVehicle(<VehicleSelectors />, { locale: 'de-DE' });
    await chooseAll(user);
    await user.selectOptions(select('Make'), 'audi');
    expect(select('Model').value).toBe('');
    expect(select('Year').value).toBe('');
    expect(select('Engine').value).toBe('');
    expect(select('Year')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Verify fitment' })).toBeDisabled();
  });

  it('verify is disabled until engine chosen', async () => {
    installFakeApi();
    const user = userEvent.setup();
    renderVehicle(<VehicleSelectors />, { locale: 'de-DE' });
    await waitFor(() => expect(optionTexts('Make')).toContain('Volkswagen'));
    await user.selectOptions(select('Make'), 'volkswagen');
    await waitFor(() => expect(optionTexts('Model')).toContain('Golf'));
    await user.selectOptions(select('Model'), 'golf');
    await waitFor(() => expect(optionTexts('Year')).toContain('2016'));
    await user.selectOptions(select('Year'), '2016');
    await waitFor(() => expect(optionTexts('Engine')).toContain('2.0 TDI'));
    expect(screen.getByRole('button', { name: 'Verify fitment' })).toBeDisabled();
    await user.selectOptions(select('Engine'), '2-0-tdi');
    expect(screen.getByRole('button', { name: 'Verify fitment' })).toBeEnabled();
  });

  it('verify adds and activates the vehicle', async () => {
    const api = installFakeApi();
    const onAdded = vi.fn();
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderVehicle(<VehicleSelectors onAdded={onAdded} />, { locale: 'de-DE', onChange });
    await chooseAll(user);
    await user.click(screen.getByRole('button', { name: 'Verify fitment' }));
    await waitFor(() => expect(onAdded).toHaveBeenCalledTimes(1));
    expect(api.state().active?.id).toBe('volkswagen.golf.2016.2-0-tdi');
    expect(onChange).toHaveBeenCalled();
    expect(select('Model').value).toBe('');
  });

  it('shows a plain error and keeps the choice when saving fails', async () => {
    installFakeApi(undefined, { failGarage: true });
    const user = userEvent.setup();
    renderVehicle(<VehicleSelectors />, { locale: 'de-DE' });
    await chooseAll(user);
    await user.click(screen.getByRole('button', { name: 'Verify fitment' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('The vehicle could not be saved');
    expect(select('Engine').value).toBe('2-0-tdi');
    expect(screen.getByRole('button', { name: 'Verify fitment' })).toBeEnabled();
  });

  it('shows an error with a retry when the options cannot be loaded', async () => {
    installFakeApi(undefined, { failOptions: true });
    renderVehicle(<VehicleSelectors />);
    expect(await screen.findByRole('alert')).toHaveTextContent('The vehicle list could not be loaded');
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('no axe violations', async () => {
    installFakeApi();
    const { container } = renderVehicle(<VehicleSelectors />);
    await waitFor(() => expect(optionTexts('Make')).toContain('Volkswagen'));
    expect(await axe(container)).toHaveNoViolations();
  });
});
