// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { installFakeApi, renderVehicle, stateOf } from '@/test/vehicle';
import { CompatibleVehicles } from './CompatibleVehicles';
import { GOLF_2016 } from './test-fixtures';

afterEach(() => vi.unstubAllGlobals());

const many = Array.from({ length: 25 }, (_, i) => `Make${String(i).padStart(2, '0')}|Model|2010|2015|1.${i}`);
const render = (keys: string[], universal = false, garage = stateOf(GOLF_2016)) => {
  installFakeApi(garage);
  return renderVehicle(<CompatibleVehicles fitmentKeys={keys} universalFit={universal} />, { garage, locale: 'en-US' });
};

describe('CompatibleVehicles', () => {
  it('ranges render as year-from to year-to', () => {
    render(['Volkswagen|Golf|2012|2019|2.0 TDI', 'Volkswagen|Golf|2012|2019|1.4 TSI']);
    expect(screen.getByText('Volkswagen Golf · 2012–2019 · 1.4 TSI, 2.0 TDI')).toBeInTheDocument();
  });

  it('rows are sorted by make and model, newest generation first', () => {
    render(['Volkswagen|Golf|2004|2008|1.9 TDI', 'Audi|A3|2013|2020|2.0 TDI', 'Volkswagen|Golf|2012|2019|2.0 TDI']);
    const rows = screen.getAllByRole('listitem').map((r) => r.textContent);
    expect(rows[0]).toContain('Audi A3');
    expect(rows[1]).toContain('2012–2019');
    expect(rows[2]).toContain('2004–2008');
  });

  it('short list shows all without filter', () => {
    render(many.slice(0, 20));
    expect(screen.getAllByRole('listitem')).toHaveLength(20);
    expect(screen.queryByRole('searchbox', { name: 'Filter vehicles' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Show all/ })).not.toBeInTheDocument();
  });

  it('long list shows ten with filter and show all', async () => {
    const user = userEvent.setup();
    render(many);
    expect(screen.getAllByRole('listitem')).toHaveLength(10);
    expect(screen.getByRole('searchbox', { name: 'Filter vehicles' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Show all 25 vehicles' }));
    expect(screen.getAllByRole('listitem')).toHaveLength(25);
    expect(screen.queryByRole('button', { name: /Show all/ })).not.toBeInTheDocument();
  });

  it('filter narrows the list', async () => {
    const user = userEvent.setup();
    render(many);
    await user.type(screen.getByRole('searchbox', { name: 'Filter vehicles' }), 'make07');
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    await user.clear(screen.getByRole('searchbox', { name: 'Filter vehicles' }));
    await user.type(screen.getByRole('searchbox', { name: 'Filter vehicles' }), 'zzz');
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
    expect(screen.getByText('No vehicle matches your filter.')).toBeInTheDocument();
  });

  it('universal part says fits all vehicles', () => {
    render([], true);
    expect(screen.getByText('Fits all vehicles')).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('active vehicle highlighted when its year is inside the range', () => {
    render(['Volkswagen|Golf|2012|2019|2.0 TDI', 'Audi|A3|2013|2020|2.0 TDI']);
    const mine = screen.getByText('Volkswagen Golf · 2012–2019 · 2.0 TDI').closest('li') as HTMLElement;
    expect(within(mine).getByText('Your vehicle')).toBeInTheDocument();
    expect(mine.className).toContain('bg-success-50');
    expect(screen.getAllByText('Your vehicle')).toHaveLength(1);
  });

  it('vehicle one year outside the range is not highlighted', () => {
    render(['Volkswagen|Golf|2017|2019|2.0 TDI']);
    expect(screen.queryByText('Your vehicle')).not.toBeInTheDocument();
  });

  it('no axe violations', async () => {
    const { container } = render(many);
    expect(await axe(container)).toHaveNoViolations();
  });
});
