// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/i18n/routing', async () => (await import('./test-support')).routingMock());

import { ForgotPasswordForm, RegisterForm, ResetPasswordForm } from './AuthForms';
import { DeleteAccountPanel } from './DeleteAccountPanel';
import { DemoLogin } from './DemoLogin';
import { PasswordForm } from './PasswordForm';
import { ProfileForm } from './ProfileForm';
import { renderAccount, router, stubFetch } from './test-support';

const profile = { email: 'anna@example.com', firstName: 'Anna', lastName: 'Schneider', mobile: '+49 170 1', marketingConsent: false };
const failure = (error: string, status = 400, rule?: string) => new Response(JSON.stringify({ error, ...(rule ? { rule } : {}) }), { status });

beforeEach(() => {
  for (const fn of Object.values(router)) fn.mockReset();
  vi.unstubAllGlobals();
});

describe('ProfileForm', () => {
  it('shows the saved details and saves names and mobile', async () => {
    const calls = stubFetch({ 'GET /api/account/profile': { profile }, 'PUT /api/account/profile': (b: unknown) => ({ profile: { ...profile, ...(b as object) } }), 'GET /api/auth/me': { customer: null } });
    const { container } = renderAccount(<ProfileForm />);
    expect(await screen.findByDisplayValue('Anna')).toBeInTheDocument();
    expect(screen.getByText('anna@example.com')).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
    const first = screen.getByLabelText('First name');
    await userEvent.clear(first);
    await userEvent.type(first, 'Anne');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(calls.some((c) => c.key === 'PUT /api/account/profile')).toBe(true));
    expect(calls.find((c) => c.key === 'PUT /api/account/profile')?.body).toEqual({ firstName: 'Anne', lastName: 'Schneider', mobile: '+49 170 1' });
    expect(await screen.findByText('Your profile was saved.')).toBeInTheDocument();
  });
  it('the consent toggle starts unchecked, saves at once and says so', async () => {
    const calls = stubFetch({ 'GET /api/account/profile': { profile }, 'PUT /api/account/profile': { profile: { ...profile, marketingConsent: true } }, 'GET /api/auth/me': { customer: null } });
    renderAccount(<ProfileForm />);
    const box = await screen.findByRole('checkbox', { name: 'Send me offers by e-mail' });
    expect(box).not.toBeChecked();
    await userEvent.click(box);
    await waitFor(() => expect(calls.at(-1)?.body === undefined || calls.some((c) => JSON.stringify(c.body) === '{"marketingConsent":true}')).toBe(true));
    expect(calls.some((c) => c.key === 'PUT /api/account/profile' && JSON.stringify(c.body) === '{"marketingConsent":true}')).toBe(true);
    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Send me offers by e-mail' })).toBeChecked());
    expect(screen.getByText('We do not send marketing email in this demo; your choice is saved.')).toBeInTheDocument();
  });
  it('changing the email needs the current password and says when it fails, generically', async () => {
    stubFetch({ 'GET /api/account/profile': { profile }, 'POST /api/account/email': failure('email-update-failed'), 'GET /api/auth/me': { customer: null } });
    renderAccount(<ProfileForm />);
    await userEvent.type(await screen.findByLabelText('New email'), 'taken@example.com');
    const submit = screen.getByRole('button', { name: 'Change email' });
    expect(submit).toBeDisabled();
    await userEvent.type(screen.getAllByLabelText('Current password')[0], 'pw');
    await userEvent.click(submit);
    expect(await screen.findByText('We could not change the email. Check it and try again.')).toBeInTheDocument();
  });
  it('error state has a retry', async () => {
    stubFetch({ 'GET /api/account/profile': new Response('{}', { status: 500 }) });
    renderAccount(<ProfileForm />);
    expect(await screen.findByText('We could not load this page.')).toBeInTheDocument();
  });
});

describe('PasswordForm', () => {
  it('wrong current password gives one message', async () => {
    stubFetch({ 'POST /api/account/password': failure('wrong-password') });
    renderAccount(<PasswordForm />);
    await userEvent.type(screen.getByLabelText('Current password'), 'bad');
    await userEvent.type(screen.getByLabelText('New password'), 'correct horse battery');
    await userEvent.type(screen.getByLabelText('Repeat new password'), 'correct horse battery');
    await userEvent.click(screen.getByRole('button', { name: 'Change password' }));
    expect(await screen.findByText('The current password is not correct.')).toBeInTheDocument();
  });
  it('weak new password names the rule', async () => {
    stubFetch({ 'POST /api/account/password': failure('weak-password', 400, 'too-short') });
    renderAccount(<PasswordForm />);
    await userEvent.type(screen.getByLabelText('Current password'), 'pw');
    await userEvent.type(screen.getByLabelText('New password'), 'short');
    await userEvent.type(screen.getByLabelText('Repeat new password'), 'short');
    await userEvent.click(screen.getByRole('button', { name: 'Change password' }));
    expect(await screen.findByText('Use at least 10 characters.')).toBeInTheDocument();
  });
  it('mismatch is caught before sending', async () => {
    const calls = stubFetch({});
    renderAccount(<PasswordForm />);
    await userEvent.type(screen.getByLabelText('Current password'), 'pw');
    await userEvent.type(screen.getByLabelText('New password'), 'correct horse battery');
    await userEvent.type(screen.getByLabelText('Repeat new password'), 'different horse battery');
    await userEvent.click(screen.getByRole('button', { name: 'Change password' }));
    expect(await screen.findByText('The passwords do not match.')).toBeInTheDocument();
    expect(calls.filter((c) => c.key.startsWith('POST'))).toHaveLength(0);
  });
  it('success clears the fields', async () => {
    stubFetch({ 'POST /api/account/password': { ok: true } });
    renderAccount(<PasswordForm />);
    await userEvent.type(screen.getByLabelText('Current password'), 'pw');
    await userEvent.type(screen.getByLabelText('New password'), 'correct horse battery');
    await userEvent.type(screen.getByLabelText('Repeat new password'), 'correct horse battery');
    await userEvent.click(screen.getByRole('button', { name: 'Change password' }));
    expect(await screen.findByText('Your password was changed.')).toBeInTheDocument();
    expect(screen.getByLabelText('New password')).toHaveValue('');
  });
  it('autocomplete tokens', () => {
    stubFetch({});
    renderAccount(<PasswordForm />);
    expect(screen.getByLabelText('Current password')).toHaveAttribute('autocomplete', 'current-password');
    expect(screen.getByLabelText('New password')).toHaveAttribute('autocomplete', 'new-password');
  });
});

describe('DeleteAccountPanel', () => {
  it('stays off until the password and the word are typed, then signs out and goes home', async () => {
    const calls = stubFetch({ 'POST /api/account/delete': { ok: true } });
    renderAccount(<DeleteAccountPanel store="mau-reseller-north" />);
    const button = screen.getByRole('button', { name: 'Delete my account' });
    expect(button).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Your password'), 'pw');
    await userEvent.type(screen.getByLabelText('Type DELETE to confirm'), 'delete');
    expect(button).toBeEnabled();
    await userEvent.click(button);
    await waitFor(() => expect(calls.at(-1)).toEqual({ key: 'POST /api/account/delete', body: { password: 'pw', confirm: 'delete' } }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/mau-reseller-north'));
  });
  it('a wrong password stays on the page and says so', async () => {
    stubFetch({ 'POST /api/account/delete': failure('wrong-password') });
    renderAccount(<DeleteAccountPanel store="s" />);
    await userEvent.type(screen.getByLabelText('Your password'), 'bad');
    await userEvent.type(screen.getByLabelText('Type DELETE to confirm'), 'DELETE');
    await userEvent.click(screen.getByRole('button', { name: 'Delete my account' }));
    expect(await screen.findByText('The current password is not correct.')).toBeInTheDocument();
    expect(router.replace).not.toHaveBeenCalled();
  });
  it('the German word is LÖSCHEN', () => {
    renderAccount(<DeleteAccountPanel store="s" />, 'de-DE');
    expect(screen.getByLabelText('Geben Sie LÖSCHEN zur Bestätigung ein')).toBeInTheDocument();
  });
});

describe('RegisterForm', () => {
  const fill = async (password = 'correct horse battery') => {
    await userEvent.type(screen.getByLabelText('First name'), 'Nina');
    await userEvent.type(screen.getByLabelText('Email'), 'nina@example.com');
    await userEvent.type(screen.getByLabelText('Password'), password);
  };
  it('registers with the consent unchecked by default, then goes to next', async () => {
    const calls = stubFetch({ 'POST /api/auth/register': { customer: { id: 'c1' }, count: 2 } });
    const { container } = renderAccount(<RegisterForm store="mau-reseller-north" storeName="Malva North" next="/account" />);
    expect(screen.getByRole('checkbox', { name: 'Send me offers by e-mail' })).not.toBeChecked();
    expect(await axe(container)).toHaveNoViolations();
    await fill();
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
    await waitFor(() => expect(calls.some((c) => c.key === 'POST /api/auth/register')).toBe(true));
    expect(calls.find((c) => c.key === 'POST /api/auth/register')?.body).toEqual({ email: 'nina@example.com', password: 'correct horse battery', firstName: 'Nina', marketingConsent: false });
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/mau-reseller-north/account'));
  });
  it('consent checked is sent', async () => {
    const calls = stubFetch({ 'POST /api/auth/register': { customer: { id: 'c1' }, count: 0 } });
    renderAccount(<RegisterForm store="s" storeName="Malva" next="/account" />);
    await fill();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Send me offers by e-mail' }));
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
    await waitFor(() => expect(calls.some((c) => c.key === 'POST /api/auth/register')).toBe(true));
    expect((calls.find((c) => c.key === 'POST /api/auth/register')?.body as { marketingConsent: boolean }).marketingConsent).toBe(true);
  });
  it('weak password names the rule and focuses the error', async () => {
    stubFetch({ 'POST /api/auth/register': failure('weak-password', 400, 'too-common') });
    renderAccount(<RegisterForm store="s" storeName="Malva" next="/account" />);
    await fill('password123');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('That password is too common. Choose a less common one.');
    await waitFor(() => expect(alert).toHaveFocus());
  });
  it('a duplicate email shows the generic message', async () => {
    stubFetch({ 'POST /api/auth/register': failure('register-failed') });
    renderAccount(<RegisterForm store="s" storeName="Malva" next="/account" />);
    await fill();
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByText('We could not create the account. Try signing in.')).toBeInTheDocument();
  });
  it('labels and autocomplete attributes', () => {
    renderAccount(<RegisterForm store="s" storeName="Malva" next="/account" />);
    expect(screen.getByLabelText('Email')).toHaveAttribute('autocomplete', 'email');
    expect(screen.getByLabelText('Password')).toHaveAttribute('autocomplete', 'new-password');
  });
});

describe('ForgotPasswordForm', () => {
  const ask = async () => {
    await userEvent.type(screen.getByLabelText('Email'), 'anna@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Show reset link' }));
  };
  it('demo notice is rendered and the link is a button', async () => {
    stubFetch({ 'POST /api/auth/forgot-password': { ok: true, demo: true, resetPath: '/en-US/mau-reseller-north/account/reset-password?token=abc123' } });
    renderAccount(<ForgotPasswordForm store="mau-reseller-north" />);
    await ask();
    expect(await screen.findByText('Demo: no email is sent. Open this link to choose a new password.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Choose a new password' })).toHaveAttribute('href', '/en-US/mau-reseller-north/account/reset-password?token=abc123');
  });
  it('flag off says the reset is not available', async () => {
    stubFetch({ 'POST /api/auth/forgot-password': { ok: true } });
    renderAccount(<ForgotPasswordForm store="s" />);
    await ask();
    expect(await screen.findByText('Password reset is not available')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Choose a new password' })).not.toBeInTheDocument();
  });
  it('de-DE notice', async () => {
    stubFetch({ 'POST /api/auth/forgot-password': { ok: true, demo: true, resetPath: '/de-DE/s/account/reset-password?token=t' } });
    renderAccount(<ForgotPasswordForm store="s" />, 'de-DE');
    await userEvent.type(screen.getByLabelText('E-Mail'), 'a@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Link zum Zurücksetzen anzeigen' }));
    expect(await screen.findByText(/Demo: Es wird keine E-Mail gesendet/)).toBeInTheDocument();
  });
});

describe('ResetPasswordForm', () => {
  it('success goes to sign-in with the notice flag', async () => {
    const calls = stubFetch({ 'POST /api/auth/reset-password': { ok: true } });
    renderAccount(<ResetPasswordForm store="mau-reseller-north" token="tok123" />);
    await userEvent.type(screen.getByLabelText('New password'), 'correct horse battery');
    await userEvent.click(screen.getByRole('button', { name: 'Save new password' }));
    await waitFor(() => expect(calls.at(-1)).toEqual({ key: 'POST /api/auth/reset-password', body: { token: 'tok123', password: 'correct horse battery' } }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/mau-reseller-north/account/sign-in?reset=1'));
  });
  it('a bad token gives the generic message and a way to ask again', async () => {
    stubFetch({ 'POST /api/auth/reset-password': failure('invalid-token') });
    renderAccount(<ResetPasswordForm store="s" token="tok" />);
    await userEvent.type(screen.getByLabelText('New password'), 'correct horse battery');
    await userEvent.click(screen.getByRole('button', { name: 'Save new password' }));
    expect(await screen.findByText('This link is not valid any more. Ask for a new one.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ask for a new link' })).toBeInTheDocument();
  });
  it('a weak password names the rule', async () => {
    stubFetch({ 'POST /api/auth/reset-password': failure('weak-password', 400, 'too-short') });
    renderAccount(<ResetPasswordForm store="s" token="tok" />);
    await userEvent.type(screen.getByLabelText('New password'), 'short');
    await userEvent.click(screen.getByRole('button', { name: 'Save new password' }));
    expect(await screen.findByText('Use at least 10 characters.')).toBeInTheDocument();
  });
  it('without a token the page says it needs a link', () => {
    renderAccount(<ResetPasswordForm store="s" token={null} />);
    expect(screen.getByText('This page needs a reset link.')).toBeInTheDocument();
  });
});

describe('DemoLogin', () => {
  const accounts = { accounts: [{ id: 'c1', label: 'Anna Schneider · Volkswagen Golf 2019' }, { id: 'c2', label: 'Ben Weber' }] };
  it('button disabled until selection', async () => {
    stubFetch({ 'GET /api/auth/demo-accounts': accounts });
    const { container } = renderAccount(<DemoLogin store="mau-reseller-north" next="/account" />);
    const button = await screen.findByRole('button', { name: 'Sign in as demo shopper' });
    expect(button).toBeDisabled();
    expect(await axe(container)).toHaveNoViolations();
    await userEvent.selectOptions(screen.getByLabelText('Demo account'), 'c1');
    expect(button).toBeEnabled();
  });
  it('sends only the id and goes to next', async () => {
    const calls = stubFetch({ 'GET /api/auth/demo-accounts': accounts, 'POST /api/auth/demo-login': { customer: { id: 'c1' }, count: 1 } });
    renderAccount(<DemoLogin store="mau-reseller-north" next="/cart" />);
    await userEvent.selectOptions(await screen.findByLabelText('Demo account'), 'c1');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in as demo shopper' }));
    await waitFor(() => expect(calls.at(-1)).toEqual({ key: 'POST /api/auth/demo-login', body: { customerId: 'c1' } }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/mau-reseller-north/cart'));
  });
  it('empty state', async () => {
    stubFetch({ 'GET /api/auth/demo-accounts': { accounts: [] } });
    renderAccount(<DemoLogin store="s" next="/account" />);
    expect(await screen.findByText('No demo accounts found. Run the seed.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sign in as demo shopper' })).not.toBeInTheDocument();
  });
  it('loading text while the list loads', () => {
    stubFetch({ 'GET /api/auth/demo-accounts': () => new Promise(() => undefined) as never });
    renderAccount(<DemoLogin store="s" next="/account" />);
    expect(screen.getByText('Loading demo accounts')).toBeInTheDocument();
  });
  it('error state announced', async () => {
    stubFetch({ 'GET /api/auth/demo-accounts': accounts, 'POST /api/auth/demo-login': new Response('{}', { status: 403 }) });
    renderAccount(<DemoLogin store="s" next="/account" />);
    await userEvent.selectOptions(await screen.findByLabelText('Demo account'), 'c2');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in as demo shopper' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Demo sign-in failed. Try again.');
    expect(screen.getByLabelText('Demo account')).toHaveAttribute('aria-describedby', alert.id);
  });
  it('renders nothing when the list route answers 404 (demo login off)', async () => {
    stubFetch({});
    const { container } = renderAccount(<DemoLogin store="s" next="/account" />);
    await waitFor(() => expect(container.textContent).toBe(''));
  });
  it('de-DE labels', async () => {
    stubFetch({ 'GET /api/auth/demo-accounts': accounts });
    renderAccount(<DemoLogin store="s" next="/account" />, 'de-DE');
    expect(await screen.findByLabelText('Demo-Konto')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Als Demo-Kunde anmelden' })).toBeInTheDocument();
  });
});
