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
import { useTablist } from './useTablist';

const IDS = ['open', 'closed', 'all'] as const;
type Id = (typeof IDS)[number];

function Tabs({ disabled = [] as Id[] }: { disabled?: Id[] }) {
  const [value, setValue] = useState<Id>('open');
  const { listProps, tabProps, panelProps } = useTablist<Id>({ ids: IDS, value, onChange: setValue, idBase: 't', isDisabled: (id) => disabled.includes(id) });
  return (
    <div>
      <div role="tablist" aria-label="Status" {...listProps}>
        {IDS.map((id) => (
          <button key={id} type="button" disabled={disabled.includes(id)} {...tabProps(id)}>
            {id}
          </button>
        ))}
      </div>
      <div {...panelProps()}>panel {value}</div>
    </div>
  );
}

describe('tabs use arrow keys', () => {
  it('only the selected tab is a tab stop, arrows and Home/End move and select, and the panel follows', async () => {
    const user = userEvent.setup();
    render(<Tabs />);
    expect(screen.getByRole('tab', { name: 'open' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('tab', { name: 'closed' })).toHaveAttribute('tabindex', '-1');
    await user.tab();
    expect(screen.getByRole('tab', { name: 'open' })).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'closed' })).toHaveFocus();
    expect(screen.getByRole('tab', { name: 'closed' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('panel closed');
    await user.keyboard('{End}');
    expect(screen.getByRole('tab', { name: 'all' })).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'open' })).toHaveFocus();
    await user.keyboard('{ArrowLeft}');
    expect(screen.getByRole('tab', { name: 'all' })).toHaveFocus();
    await user.keyboard('{Home}');
    expect(screen.getByRole('tab', { name: 'open' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('tab', { name: 'open' })).not.toHaveFocus();
  });

  it('skips a disabled tab', async () => {
    const user = userEvent.setup();
    render(<Tabs disabled={['closed']} />);
    await user.tab();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'all' })).toHaveFocus();
  });

  it('a11y: tablist, tabs and panel are linked and have no axe violations', async () => {
    const { container } = render(<Tabs />);
    const tab = screen.getByRole('tab', { name: 'open' });
    const panel = screen.getByRole('tabpanel');
    expect(tab).toHaveAttribute('aria-controls', panel.id);
    expect(panel).toHaveAttribute('aria-labelledby', tab.id);
    expect(await axe(container)).toHaveNoViolations();
  });
});
