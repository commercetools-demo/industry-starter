import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/utils';
import en from '@/messages/en-US.json';
import ForgotPasswordPage from './forgot-password/page';
import RegisterPage from './register/page';
import ResetPasswordPage from './reset-password/page';
import SignInPage, { generateMetadata } from './sign-in/page';

vi.mock('next-intl/server', async () => {
  const messages = (await import('@/messages/en-US.json')).default as { auth: Record<string, unknown> };
  return {
    setRequestLocale: vi.fn(),
    getTranslations: vi.fn(async () => (key: string) => messages.auth[key] as string),
  };
});
vi.mock('@/i18n/routing', async (orig) => ({
  ...(await orig<typeof import('@/i18n/routing')>()),
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }),
}));

const params = Promise.resolve({ locale: 'en-US' });

describe('auth pages', () => {
  it('sign-in: 440 px card with H2 "Sign in", fields, links and the redirect carried to register', async () => {
    renderWithProviders(await SignInPage({ params, searchParams: Promise.resolve({ redirect: '/en-US/saved' }) }));
    expect(screen.getByRole('heading', { level: 2, name: 'Sign in' })).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Forgot your password?' })).toHaveAttribute('href', '/en-US/account/forgot-password');
    expect(screen.getByRole('link', { name: 'New here? Create an account' })).toHaveAttribute('href', '/en-US/account/register?redirect=%2Fen-US%2Fsaved');
    const card = screen.getByRole('heading', { level: 2 }).parentElement!;
    expect(card.className).toContain('max-w-[440px]');
  });

  it('sign-in: title for the browser tab', async () => {
    expect(await generateMetadata({ params })).toEqual({ title: 'Sign in' });
  });

  it('register: four fields and a link back to sign-in', async () => {
    renderWithProviders(await RegisterPage({ params, searchParams: Promise.resolve({}) }));
    expect(screen.getByRole('heading', { level: 2, name: 'Create your account' })).toBeInTheDocument();
    for (const label of ['First name', 'Last name', 'Email', 'Password']) expect(screen.getByLabelText(label)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Already have an account? Sign in' })).toHaveAttribute('href', '/en-US/account/sign-in');
  });

  it('forgot-password: email field and back link', async () => {
    renderWithProviders(await ForgotPasswordPage({ params }));
    expect(screen.getByRole('heading', { level: 2, name: 'Reset your password' })).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to sign in' })).toBeInTheDocument();
  });

  it('reset-password: the token from the query enables the form', async () => {
    renderWithProviders(await ResetPasswordPage({ params, searchParams: Promise.resolve({ token: 'abc' }) }));
    expect(screen.getByRole('button', { name: 'Save and sign in' })).toBeEnabled();
  });

  it('reset-password: without a token the invalid-link message shows', async () => {
    renderWithProviders(await ResetPasswordPage({ params, searchParams: Promise.resolve({}) }));
    expect(screen.getByRole('alert')).toHaveTextContent('invalid or has expired');
  });

  it('every auth message key exists in both locales', async () => {
    const de = (await import('@/messages/de-DE.json')).default as { auth: Record<string, unknown> };
    const flat = (o: Record<string, unknown>, p = ''): string[] =>
      Object.entries(o).flatMap(([k, v]) => (typeof v === 'object' && v !== null ? flat(v as Record<string, unknown>, `${p}${k}.`) : [`${p}${k}`]));
    expect(flat(de.auth).sort()).toEqual(flat(en.auth as Record<string, unknown>).sort());
    render(<span />);
  });
});
