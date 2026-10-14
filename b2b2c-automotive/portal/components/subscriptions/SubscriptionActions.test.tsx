/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import en from '@/messages/en-US.json';
import { renderWithProviders } from '@/test/render';
import { SubscriptionActions } from './SubscriptionActions';

const row = (state: string, skipsRemaining = 0) => ({ id: 'r1', state, status: (state === 'Paused' ? 'Paused' : state === 'Active' ? 'Active' : 'Canceled') as 'Active' | 'Paused' | 'Canceled', skipsRemaining });

function show(state: string, onRun = vi.fn(async () => null as string | null), skipsRemaining = 0) {
  renderWithProviders(<SubscriptionActions row={row(state, skipsRemaining)} onRun={onRun} />, { locale: 'en-US', messages: en });
  return onRun;
}

describe('subscription actions', () => {
  it('Active has Pause and no Resume; Paused has Resume and no Pause', () => {
    show('Active');
    expect(screen.getByRole('button', { name: 'Pause' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Resume' })).toBeNull();
  });

  it('Paused has Resume, no Pause, and Skip is disabled with a text reason linked by aria-describedby', () => {
    show('Paused');
    expect(screen.queryByRole('button', { name: 'Pause' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Resume' })).toBeEnabled();
    const skip = screen.getByRole('button', { name: 'Skip next' });
    expect(skip).toBeDisabled();
    expect(document.getElementById(skip.getAttribute('aria-describedby') as string)).toHaveTextContent('Only an active subscription can skip a renewal.');
  });

  it('a pending skip disables Skip with its reason', () => {
    show('Active', undefined, 1);
    expect(screen.getByRole('button', { name: 'Skip next' })).toBeDisabled();
    expect(screen.getByText('The next renewal is already skipped.')).toBeInTheDocument();
  });

  it('a canceled subscription is final: every action is disabled with the final reason', () => {
    show('Canceled');
    for (const button of screen.getAllByRole('button')) expect(button).toBeDisabled();
    expect(screen.getAllByText('A canceled subscription cannot change.').length).toBe(3);
  });

  it('announces the result in a role=status region', async () => {
    const onRun = show('Active');
    await userEvent.click(screen.getByRole('button', { name: 'Pause' }));
    expect(onRun).toHaveBeenCalledWith('pause');
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Subscription paused'));
  });

  it('shows a failure text in the status region instead', async () => {
    show('Active', vi.fn(async () => 'The subscription is processing an order. Try again in a moment.'));
    await userEvent.click(screen.getByRole('button', { name: 'Skip next' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('processing an order'));
  });

  it('cancel asks for a confirmation first and has no accessibility violations', async () => {
    const onRun = show('Active');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onRun).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Cancel this subscription?' })).toBeInTheDocument();
    expect(await axe(document.body, { rules: { region: { enabled: false } } })).toHaveNoViolations();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel subscription' }));
    expect(onRun).toHaveBeenCalledWith('cancel');
  });
});
