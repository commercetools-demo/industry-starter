import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';

const validate = vi.hoisted(() => vi.fn());
vi.mock('next-intl/server', async () => (await import('@/test/fixtures/serverIntl')).serverIntlMock);
vi.mock('@/lib/ct/customer', () => ({ validatePasswordToken: (token: string) => validate(token) }));
vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  notFound: () => {
    throw new Error('NOT_FOUND');
  },
  redirect: () => {
    throw new Error('REDIRECT');
  },
}));
vi.mock('@/i18n/routing', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/i18n/routing')>()),
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn(), push: vi.fn() }),
  redirect: () => {
    throw new Error('REDIRECT');
  },
}));

import ResetPasswordPage, { generateMetadata } from './page';

async function open(query: Record<string, string | string[]>, locale: 'en-US' | 'de-DE' = 'en-US') {
  renderWithProviders(await ResetPasswordPage({ params: Promise.resolve({ locale }), searchParams: Promise.resolve(query) }), { locale });
}

beforeEach(() => {
  validate.mockReset();
});

describe('reset password page', () => {
  it('a valid token shows the new password form and checks the token without consuming it', async () => {
    validate.mockResolvedValue({ id: 'c-1' });
    await open({ token: 'reset-token-123456' });
    expect(screen.getByRole('heading', { level: 1, name: 'Choose a new password' })).toBeInTheDocument();
    expect(screen.getByLabelText('New password')).toBeInTheDocument();
    expect(validate).toHaveBeenCalledWith('reset-token-123456');
  });

  it('Token expired or consumed: the page offers a new link on the same page without redirecting to login', async () => {
    validate.mockResolvedValue(null);
    await open({ token: 'used-token-123456' });
    expect(screen.getByRole('heading', { level: 1, name: 'This reset link is no longer usable' })).toBeInTheDocument();
    expect(screen.getByText('Request a new link below.')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send a new link' })).toBeInTheDocument();
    expect(screen.queryByLabelText('New password')).not.toBeInTheDocument();
  });

  it('a missing token shows the expired state without asking commercetools', async () => {
    await open({});
    expect(screen.getByRole('heading', { level: 1, name: 'This reset link is no longer usable' })).toBeInTheDocument();
    expect(validate).not.toHaveBeenCalled();
  });

  it('the page is noindex and sends no referrer (the token is in the URL)', async () => {
    const metadata = await generateMetadata({ params: Promise.resolve({ locale: 'en-US' }) });
    expect(metadata.robots).toMatchObject({ index: false });
    expect(metadata.referrer).toBe('no-referrer');
  });

  it('de-DE expired copy', async () => {
    validate.mockResolvedValue(null);
    await open({ token: 'used-token-123456' }, 'de-DE');
    expect(screen.getByRole('heading', { level: 1, name: 'Dieser Link zum Zurücksetzen ist nicht mehr gültig' })).toBeInTheDocument();
  });
});
