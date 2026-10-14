// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import deDE from '@/messages/de-DE.json';
import enUS from '@/messages/en-US.json';
import { renderWithProviders } from '@/test/render';
import LocaleError from './error';

describe('Locale routing for two locales: error boundary', () => {
  it('Error boundary offers retry', async () => {
    const reset = vi.fn();
    renderWithProviders(<LocaleError error={new Error('x')} reset={reset} />, { messages: enUS, locale: 'en-US' });
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(reset).toHaveBeenCalledTimes(1);
  });
  it('Error boundary is translated and accessible', async () => {
    const { container } = renderWithProviders(<LocaleError error={new Error('x')} reset={() => {}} />, { messages: deDE });
    expect(screen.getByRole('heading', { name: 'Etwas ist schiefgelaufen' })).toBeInTheDocument();
    expect(await axe(container, { rules: { 'color-contrast': { enabled: false } } })).toHaveNoViolations();
  });
});
