import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';

vi.mock('next-intl/server', () => ({ setRequestLocale: vi.fn() }));

import UnauthorizedPage, { metadata } from './page';

async function open(ref?: string | string[]) {
  renderWithProviders(await UnauthorizedPage({ params: Promise.resolve({ locale: 'en-US' }), searchParams: Promise.resolve({ ref }) }));
}

describe('unauthorized page', () => {
  it('shows the reference, the account and support actions', async () => {
    await open('AB12-CD34');
    expect(screen.getByRole('heading', { level: 1, name: "You don't have access to this" })).toBeInTheDocument();
    expect(screen.getByText('Reference: AB12-CD34')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to my account' })).toHaveAttribute('href', '/en-US/account');
    expect(screen.getByRole('link', { name: 'Contact support' })).toHaveAttribute('href', '/en-US/support');
  });

  it('ignores an invalid ref', async () => {
    await open('<script>');
    expect(screen.queryByText(/Reference:/)).not.toBeInTheDocument();
    expect(document.body.innerHTML).not.toContain('script');
  });

  it('takes the first of repeated ref parameters', async () => {
    await open(['AB12-CD34', 'ZZZZ-9999']);
    expect(screen.getByText('Reference: AB12-CD34')).toBeInTheDocument();
  });

  it('has robots noindex metadata', () => {
    expect(metadata).toEqual({ robots: { index: false } });
  });
});
