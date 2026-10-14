/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { StateTabs } from './shared';

function Host() {
  const [tab, setTab] = useState<'open' | 'closed'>('open');
  return (
    <>
      <StateTabs ariaLabel="Status" value={tab} onChange={setTab} tabs={[{ id: 'open', label: 'Open' }, { id: 'closed', label: 'Closed' }]} />
      <p>showing {tab}</p>
    </>
  );
}

describe('a11y: StateTabs (customers, subscriptions, returns, reviews)', () => {
  it('arrow keys move between the tabs, the selected tab is the only tab stop, and there are no axe violations', async () => {
    const user = userEvent.setup();
    const { container } = render(<Host />);
    expect(screen.getByRole('tablist', { name: 'Status' })).toBeInTheDocument();
    await user.tab();
    expect(screen.getByRole('tab', { name: 'Open' })).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Closed' })).toHaveFocus();
    expect(screen.getByText('showing closed')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Open' })).toHaveAttribute('tabindex', '-1');
    expect(await axe(container)).toHaveNoViolations();
  });
});
