import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '@/messages/en-US.json';
import { renderWithProviders } from '@/test/render';
import { hardNavigate } from '@/hooks/navigate';

vi.mock('@/hooks/navigate', () => ({ hardNavigate: vi.fn() }));

const router = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn(), push: vi.fn() }));
vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  usePathname: () => '/sign-in',
  useRouter: () => ({ ...router, prefetch: vi.fn() }),
}));

import { RegisterForm } from './RegisterForm';
import { passwordCheck, ResetPasswordForm } from './ResetPasswordForm';
import { ResetRequestForm } from './ResetRequestForm';
import { SignInForm } from './SignInForm';
import { PendingApproval } from './PendingApproval';

const fetchMock = vi.fn();
beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  fetchMock.mockReset();
  vi.mocked(hardNavigate).mockClear();
  Object.values(router).forEach((fn) => fn.mockReset());
});
const render = (ui: React.ReactElement) => renderWithProviders(ui, { messages: en });
const reply = (body: unknown, status = 200) => fetchMock.mockResolvedValue(Response.json(body, { status }));

describe('SignInForm', () => {
  it('Missing field: shows the message and sends nothing', async () => {
    const { container } = render(<SignInForm resetEnabled demo={undefined} />);
    await userEvent.type(screen.getByLabelText('Email'), 'a@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Fill in every field to continue.');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('Wrong credentials show one message', async () => {
    reply({ error: 'Email or password is incorrect.' }, 401);
    render(<SignInForm resetEnabled />);
    await userEvent.type(screen.getByLabelText('Email'), 'a@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'x');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Email or password is incorrect.');
  });

  it('success goes to the portal and a pending account to the status page', async () => {
    reply({ status: 'ok' });
    render(<SignInForm resetEnabled next="/catalog" />);
    await userEvent.type(screen.getByLabelText('Email'), 'a@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'x');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(hardNavigate).toHaveBeenCalledWith('/de-DE/catalog'));
  });

  it('pending account reaches the status page, not the portal', async () => {
    reply({ status: 'pending' });
    render(<SignInForm resetEnabled />);
    await userEvent.type(screen.getByLabelText('Email'), 'a@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'x');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(hardNavigate).toHaveBeenCalledWith('/de-DE/pending-approval'));
  });

  it('an unsafe return path is ignored', async () => {
    reply({ status: 'ok' });
    render(<SignInForm resetEnabled next="//evil.example" />);
    await userEvent.type(screen.getByLabelText('Email'), 'a@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'x');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(hardNavigate).toHaveBeenCalledWith('/de-DE'));
  });

  it('shows the secondary links, the demo slot between form and links, and hides Forgot password when reset is off', () => {
    render(<SignInForm resetEnabled={false} demo={<p>demo slot</p>} />);
    expect(screen.getByRole('link', { name: 'Create account' })).toHaveAttribute('href', '/de-DE/register');
    expect(screen.queryByRole('link', { name: 'Forgot password?' })).not.toBeInTheDocument();
    expect(screen.getByText('demo slot')).toBeInTheDocument();
  });

  it('no demo control without the demo slot', () => {
    render(<SignInForm resetEnabled />);
    expect(screen.queryByText(/demo/i)).not.toBeInTheDocument();
  });
});

describe('RegisterForm', () => {
  const fill = async (password = 'twelve-chars-ok') => {
    await userEvent.type(screen.getByLabelText('Company name'), 'Test Garage Nord');
    await userEvent.type(screen.getByLabelText('Your name'), 'Alex Test');
    await userEvent.type(screen.getByLabelText('Work email'), 'alex@example.com');
    await userEvent.type(screen.getByLabelText('Password'), password);
  };

  it('Pending account: shows the awaiting approval text and starts no session', async () => {
    reply({ status: 'created', message: 'x' });
    render(<RegisterForm />);
    await fill();
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByText('Account created. Awaiting Malva approval of your business.')).toBeInTheDocument();
    expect(hardNavigate).not.toHaveBeenCalled();
  });

  it('a password under 12 characters is refused without a request', async () => {
    render(<RegisterForm />);
    await fill('short');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(screen.getByRole('alert')).toHaveTextContent('at least 12 characters');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('a duplicate email shows the generic text', async () => {
    reply({ error: 'x' }, 400);
    render(<RegisterForm />);
    await fill();
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't create that account. Try signing in.");
  });
});

describe('Password reset screens', () => {
  it('request: continues to the reset form with the same message for any email', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    reply({ message: 'm', resetPath: '/de-DE/reset/abc123' });
    render(<ResetRequestForm enabled />);
    await userEvent.type(screen.getByLabelText('Email'), 'whoever@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByText('If that account exists, continue below to choose a new password.')).toBeInTheDocument();
    await vi.advanceTimersByTimeAsync(1000);
    expect(router.push).toHaveBeenCalledWith('/de-DE/reset/abc123');
    expect(screen.queryByText(/inbox|e-?mail (was|has) been sent/i)).not.toBeInTheDocument();
  });

  it('request: with the flag off no form is rendered', () => {
    render(<ResetRequestForm enabled={false} />);
    expect(screen.queryByLabelText('Email')).not.toBeInTheDocument();
    expect(screen.getByText('Password reset is not available in this environment.')).toBeInTheDocument();
  });

  it('live check: enter, too short, mismatch, looks good', () => {
    expect(passwordCheck('', '')).toBe('enter');
    expect(passwordCheck('short', 'short')).toBe('short');
    expect(passwordCheck('a-long-password', 'other')).toBe('mismatch');
    expect(passwordCheck('a-long-password', 'a-long-password')).toBe('good');
  });

  it('reset form shows the live strings and the generic failure for a bad token', async () => {
    reply({ error: 'x' }, 400);
    render(<ResetPasswordForm token="decoy" enabled />);
    expect(screen.getByText('Enter a new password')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('New password'), 'short');
    expect(screen.getByText('Too short')).toBeInTheDocument();
    await userEvent.clear(screen.getByLabelText('New password'));
    await userEvent.type(screen.getByLabelText('New password'), 'a-long-password');
    expect(screen.getByText("Passwords don't match")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Confirm password'), 'a-long-password');
    expect(screen.getByText('Looks good')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Set new password' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('This reset link is invalid or has expired.');
  });
});

describe('PendingApproval', () => {
  it('names the business and offers Sign out', async () => {
    reply({ status: 'signed-out' });
    const { container } = render(<PendingApproval businessName="Test Garage West" />);
    expect(screen.getByText(/Test Garage West/)).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    await waitFor(() => expect(hardNavigate).toHaveBeenCalledWith('/de-DE/sign-in'));
  });
});
