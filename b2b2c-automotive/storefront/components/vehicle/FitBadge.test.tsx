// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { emptyState, installFakeApi, renderVehicle, stateOf } from '@/test/vehicle';
import { FitBadge } from './FitBadge';

vi.mock('@/i18n/routing', () => ({ useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }), usePathname: () => '/shop', Link: 'a' }));
afterEach(() => vi.unstubAllGlobals());

describe('Fit badge', () => {
  it('badge texts per state', () => {
    installFakeApi();
    const { rerender } = renderVehicle(<FitBadge state="fits" />);
    expect(screen.getByText(/Fits your vehicle/)).toHaveTextContent('✓ Fits your vehicle');
    rerender(<FitBadge state="does-not-fit" />);
    expect(screen.getByText(/Does not fit/)).toHaveTextContent('✕ Does not fit');
    rerender(<FitBadge state="unknown" />);
    expect(screen.getByRole('button', { name: 'Select your vehicle to check fit' })).toBeInTheDocument();
  });

  it('the glyph is in the text and the state is not colour only', () => {
    installFakeApi();
    renderVehicle(<FitBadge state="does-not-fit" />);
    expect(screen.getByText(/Does not fit/).textContent).toContain('✕');
  });

  it('does not follow the theme', () => {
    installFakeApi();
    document.documentElement.style.setProperty('--color-danger-500', '#123456');
    document.documentElement.style.setProperty('--color-brand-700', '#123456');
    const { container, rerender } = renderVehicle(<FitBadge state="does-not-fit" />);
    expect(container.firstElementChild).toHaveClass('bg-danger-50', 'text-danger-600');
    expect(container.innerHTML).not.toMatch(/brand|accent|action/);
    rerender(<FitBadge state="fits" />);
    expect(container.firstElementChild).toHaveClass('bg-success-50', 'text-success-600');
    expect(container.innerHTML).not.toMatch(/brand|accent|action/);
    document.documentElement.removeAttribute('style');
  });

  it('unknown badge opens the dialog', async () => {
    installFakeApi(emptyState);
    const user = userEvent.setup();
    renderVehicle(<FitBadge state="unknown" />);
    await user.click(screen.getByRole('button', { name: 'Select your vehicle to check fit' }));
    expect(await screen.findByRole('dialog', { name: 'Your vehicles' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Make' })).toBeInTheDocument());
  });

  it('no axe violations', async () => {
    installFakeApi(stateOf('volkswagen.golf.2016.2-0-tdi'));
    const { container } = renderVehicle(
      <>
        <FitBadge state="fits" />
        <FitBadge state="does-not-fit" />
        <FitBadge state="unknown" />
      </>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
