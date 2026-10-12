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
vi.mock('@/components/partnership/PartnershipPage', () => ({ PartnershipPage: () => <p>partnership body</p> }));

import PartnershipRoute from './page';

beforeEach(() => {
  gate.allowed = true;
});

describe('partnership has no floor text (page gate)', () => {
  it('a Buyer gets the forbidden view and none of the page', async () => {
    gate.allowed = false;
    render(<NextIntlClientProvider locale="en-US" messages={en}>{await PartnershipRoute({ params: Promise.resolve({ locale: 'en-US' }) })}</NextIntlClientProvider>);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText('partnership body')).toBeNull();
  });
  it('an Admin gets the page', async () => {
    render(<NextIntlClientProvider locale="en-US" messages={en}>{await PartnershipRoute({ params: Promise.resolve({ locale: 'en-US' }) })}</NextIntlClientProvider>);
    expect(screen.getByRole('heading', { name: 'Brand partnership' })).toBeInTheDocument();
    expect(screen.getByText('partnership body')).toBeInTheDocument();
  });
});
