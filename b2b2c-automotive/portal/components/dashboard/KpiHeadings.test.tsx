/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import { KpiTile } from '@/components/customers/shared';
import en from '@/messages/en-US.json';
import { renderWithProviders } from '@/test/render';
import { KpiCard } from './KpiCard';

describe('a11y: KPI tiles', () => {
  it('a tile label is a level 2 heading directly under the page heading (no skipped level) and has no axe violations', async () => {
    const { container } = renderWithProviders(
      <main>
        <h1>Dashboard</h1>
        <KpiCard id="open-orders" label="Open orders" note="Placed in your store" value={4} state="ok" />
        <KpiCard id="loading" label="Returns" note="Open" value={null} state="loading" />
        <KpiTile id="registered" label="Registered" value="12" note="Shoppers with an account" />
      </main>,
      { messages: en },
    );
    expect(screen.getByRole('heading', { name: 'Open orders' }).tagName).toBe('H2');
    expect(screen.getByRole('heading', { name: 'Registered' }).tagName).toBe('H2');
    expect(await axe(container)).toHaveNoViolations();
  });
});
