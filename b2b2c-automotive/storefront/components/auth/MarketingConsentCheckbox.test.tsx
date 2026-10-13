// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { NextIntlClientProvider } from 'next-intl';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import deMessages from '@/messages/de-DE.json';
import enMessages from '@/messages/en-US.json';
import { MarketingConsentCheckbox } from './MarketingConsentCheckbox';

function Harness({ onValue, locale = 'en-US' }: { onValue: (v: boolean) => void; locale?: 'en-US' | 'de-DE' }) {
  const [checked, setChecked] = useState(false);
  return (
    <NextIntlClientProvider locale={locale} messages={locale === 'en-US' ? enMessages : deMessages}>
      <MarketingConsentCheckbox
        checked={checked}
        onChange={(v) => {
          setChecked(v);
          onValue(v);
        }}
      />
    </NextIntlClientProvider>
  );
}

describe('marketing consent checkbox (W-07)', () => {
  it('a form that starts it unchecked shows it unchecked and reports the change', async () => {
    const seen = vi.fn();
    render(<Harness onValue={seen} />);
    const box = screen.getByRole('checkbox', { name: 'Send me offers by e-mail' });
    expect(box).not.toBeChecked();
    await userEvent.click(box);
    expect(box).toBeChecked();
    expect(seen).toHaveBeenCalledWith(true);
    await userEvent.click(box);
    expect(seen).toHaveBeenLastCalledWith(false);
  });
  it('is available in German', () => {
    render(<Harness onValue={vi.fn()} locale="de-DE" />);
    expect(screen.getByRole('checkbox', { name: 'Senden Sie mir Angebote per E-Mail' })).not.toBeChecked();
  });
  it('announces a status and can be disabled while saving', async () => {
    const { container } = render(
      <NextIntlClientProvider locale="en-US" messages={enMessages}>
        <MarketingConsentCheckbox checked disabled status="Saved" onChange={() => undefined} />
      </NextIntlClientProvider>,
    );
    expect(screen.getByRole('checkbox')).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('Saved');
    expect(await axe(container)).toHaveNoViolations();
  });
});
