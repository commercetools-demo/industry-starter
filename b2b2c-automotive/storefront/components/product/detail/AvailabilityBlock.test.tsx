// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderVehicle } from '@/test/vehicle';
import { AvailabilityBlock, type AvailabilityBlockProps } from './AvailabilityBlock';

const branch = { name: 'Küstenwerk Hamburg-Harburg', address: { street: 'Harburger Ring 1', postalCode: '21073', city: 'Hamburg' }, pickup: 'today' as const };
const base = (over: Partial<AvailabilityBlockProps> = {}): AvailabilityBlockProps => ({ branch, canChangeStore: true, inStock: true, shipDays: { min: 2, max: 3 }, ...over });
const render = (props: AvailabilityBlockProps) => renderVehicle(<AvailabilityBlock {...props} />, { locale: 'en-US' });

describe('AvailabilityBlock', () => {
  it('in stock shows branch address and change store', () => {
    render(base());
    expect(screen.getByText('In stock at Küstenwerk Hamburg-Harburg')).toBeInTheDocument();
    expect(screen.getByText('Harburger Ring 1, 21073 Hamburg')).toBeInTheDocument();
    expect(screen.getByText('Pickup today')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Change store' })).toBeInTheDocument();
  });

  it('out of stock at branch shows ship to store and shipping days', () => {
    render(base({ inStock: false }));
    expect(screen.getByText('Not in stock at Küstenwerk Hamburg-Harburg')).toBeInTheDocument();
    expect(screen.getByText('Ship to store')).toBeInTheDocument();
    expect(screen.getByText('Or ship to your door: arrives in 2–3 business days.')).toBeInTheDocument();
  });

  it('pickup tomorrow and a ship-to-store branch', () => {
    render(base({ branch: { ...branch, pickup: 'tomorrow' } }));
    expect(screen.getByText('Pickup tomorrow')).toBeInTheDocument();
  });

  it('hidden change store for a single branch', () => {
    render(base({ canChangeStore: false }));
    expect(screen.queryByRole('button', { name: 'Change store' })).not.toBeInTheDocument();
  });

  it('shipping days from settings', () => {
    render(base({ shipDays: { min: 4, max: 6 } }));
    expect(screen.getByText('Or ship to your door: arrives in 4–6 business days.')).toBeInTheDocument();
  });

  it('a store without branches still says stock and delivery', () => {
    render(base({ branch: null, canChangeStore: false }));
    expect(screen.getByText('In stock')).toBeInTheDocument();
    expect(screen.getByText(/Or ship to your door/)).toBeInTheDocument();
  });
});
