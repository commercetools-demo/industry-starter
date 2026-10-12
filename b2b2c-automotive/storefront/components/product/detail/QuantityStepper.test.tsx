// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { renderVehicle } from '@/test/vehicle';
import { clampQuantity, QuantityStepper } from './QuantityStepper';

function Host({ start = 1 }: { start?: number }) {
  const [value, setValue] = useState(start);
  return <QuantityStepper value={value} onChange={setValue} />;
}
const field = () => screen.getByRole('textbox', { name: 'Quantity' }) as HTMLInputElement;

describe('QuantityStepper', () => {
  it('stepper cannot go below one', async () => {
    const user = userEvent.setup();
    renderVehicle(<Host />, { locale: 'en-US' });
    expect(screen.getByRole('button', { name: 'Decrease quantity' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Increase quantity' }));
    expect(field().value).toBe('2');
    await user.click(screen.getByRole('button', { name: 'Decrease quantity' }));
    expect(field().value).toBe('1');
  });

  it('typing zero or empty snaps back to one on blur', async () => {
    const user = userEvent.setup();
    renderVehicle(<Host start={4} />, { locale: 'en-US' });
    await user.clear(field());
    await user.tab();
    expect(field().value).toBe('1');
    await user.clear(field());
    await user.type(field(), '0');
    await user.tab();
    expect(field().value).toBe('1');
  });

  it('caps at 99 and the buttons are at least 44 px tall by token', async () => {
    const user = userEvent.setup();
    renderVehicle(<Host start={98} />, { locale: 'en-US' });
    await user.click(screen.getByRole('button', { name: 'Increase quantity' }));
    expect(field().value).toBe('99');
    expect(screen.getByRole('button', { name: 'Increase quantity' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Increase quantity' }).className).toContain('min-h-7');
  });

  it('clampQuantity', () => {
    expect(clampQuantity(0)).toBe(1);
    expect(clampQuantity(150)).toBe(99);
    expect(clampQuantity(Number.NaN)).toBe(1);
    expect(clampQuantity(3.7)).toBe(3);
  });
});
