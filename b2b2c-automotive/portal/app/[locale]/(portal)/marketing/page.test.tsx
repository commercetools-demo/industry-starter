/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import en from '@/messages/en-US.json';

const gate = vi.hoisted(() => ({ allowed: true }));
vi.mock('@/lib/portal/viewer', () => ({ viewerCan: vi.fn(async () => gate.allowed) }));
vi.mock('next-intl/server', () => ({
  setRequestLocale: vi.fn(),
  getTranslations: async (ns: string) => (key: string) => (en as unknown as Record<string, Record<string, string>>)[ns][key],
}));
vi.mock('@/components/marketing/MarketingPage', () => ({ MarketingPage: () => <p>campaign cards</p> }));

import MarketingRoute from './page';

beforeEach(() => {
  gate.allowed = true;
});

describe('Marketing page gate', () => {
  it('a role that may not manage marketing gets the forbidden view and no campaign cards', async () => {
    gate.allowed = false;
    render(<NextIntlClientProvider locale="en-US" messages={en}>{await MarketingRoute({ params: Promise.resolve({ locale: 'en-US' }) })}</NextIntlClientProvider>);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText('campaign cards')).toBeNull();
  });
  it('an Admin gets the header and the cards', async () => {
    render(<NextIntlClientProvider locale="en-US" messages={en}>{await MarketingRoute({ params: Promise.resolve({ locale: 'en-US' }) })}</NextIntlClientProvider>);
    expect(screen.getByRole('heading', { name: 'Marketing' })).toBeInTheDocument();
    expect(screen.getByText('campaign cards')).toBeInTheDocument();
  });
});
