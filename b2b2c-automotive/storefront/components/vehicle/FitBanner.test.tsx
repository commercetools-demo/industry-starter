// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { installFakeApi, renderVehicle, stateOf } from '@/test/vehicle';
import { FitBanner } from './FitBanner';

vi.mock('@/i18n/routing', () => ({ useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }), usePathname: () => '/shop', Link: 'a' }));
afterEach(() => vi.unstubAllGlobals());

const part = { fitmentKeys: ['Volkswagen|Golf|2012|2019|2.0 TDI'], universalFit: false };
const GOLF = 'volkswagen.golf.2016.2-0-tdi';
const href = '/store/parts?fit=1&category=brakes';

describe('Fit banner (product page)', () => {
  it('shows the success banner for a fitting part', () => {
    installFakeApi(stateOf(GOLF));
    renderVehicle(<FitBanner product={part} alternativesHref={href} />, { garage: stateOf(GOLF) });
    expect(screen.getByRole('status')).toHaveTextContent('✓ Fits your 2016 Volkswagen Golf · 2.0 TDI');
    expect(screen.queryByRole('link', { name: 'View fitting alternatives' })).not.toBeInTheDocument();
  });

  it('banner shows alternatives link for non fit', () => {
    installFakeApi(stateOf('volkswagen.golf.2022.2-0-tdi'));
    renderVehicle(<FitBanner product={part} alternativesHref={href} />, { garage: stateOf('volkswagen.golf.2022.2-0-tdi') });
    expect(screen.getByRole('status')).toHaveTextContent('✕ This part does not fit your 2022 Volkswagen Golf · 2.0 TDI');
    expect(screen.getByRole('link', { name: 'View fitting alternatives' })).toHaveAttribute('href', href);
  });

  it('universal parts fit every vehicle', () => {
    installFakeApi(stateOf(GOLF));
    renderVehicle(<FitBanner product={{ fitmentKeys: [], universalFit: true }} alternativesHref={href} />, { garage: stateOf(GOLF) });
    expect(screen.getByRole('status')).toHaveTextContent('Fits your');
  });

  it('asks for a vehicle when there is none', () => {
    installFakeApi();
    renderVehicle(<FitBanner product={part} alternativesHref={href} />);
    expect(screen.getByRole('status')).toHaveTextContent('Select your vehicle to check fit');
    expect(screen.getByRole('button', { name: 'Select your vehicle' })).toBeInTheDocument();
  });

  it('quantity stays when the vehicle changes on a PDP', async () => {
    const garage = stateOf(GOLF, 'volkswagen.golf.2022.2-0-tdi');
    const api = installFakeApi(garage);
    const user = userEvent.setup();
    function Pdp() {
      const [qty, setQty] = useState('1');
      return (
        <>
          <label>
            Quantity
            <input value={qty} onChange={(e) => setQty(e.target.value)} />
          </label>
          <FitBanner product={part} alternativesHref={href} />
        </>
      );
    }
    renderVehicle(<Pdp />, { garage });
    const quantity = screen.getByRole('textbox', { name: 'Quantity' }) as HTMLInputElement;
    await user.clear(quantity);
    await user.type(quantity, '3');
    expect(screen.getByRole('status')).toHaveTextContent('does not fit your 2022');

    await user.click(screen.getByRole('button', { name: 'Change vehicle' }));
    const dialog = await screen.findByRole('dialog', { name: 'Your vehicles' });
    await user.click(within(dialog).getByRole('button', { name: /Set active: 2016 Volkswagen Golf · 2.0 TDI/ }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('✓ Fits your 2016 Volkswagen Golf'));
    expect(api.state().active?.id).toBe(GOLF);
    expect((screen.getByRole('textbox', { name: 'Quantity' }) as HTMLInputElement).value).toBe('3');
    expect(screen.getByRole('textbox', { name: 'Quantity' })).toBe(quantity);
  });

  it('no axe violations', async () => {
    installFakeApi(stateOf(GOLF));
    const { container } = renderVehicle(<FitBanner product={part} alternativesHref={href} />, { garage: stateOf(GOLF) });
    expect(await axe(container)).toHaveNoViolations();
  });
});
