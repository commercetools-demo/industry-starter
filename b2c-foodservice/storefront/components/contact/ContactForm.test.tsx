import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithIntl } from '@/test/render';
import ContactForm from './ContactForm';

vi.mock('@/i18n/routing', async () => (await import('@/test/shell')).routingMock());
const account = vi.hoisted(() => ({ customer: null as null | { firstName: string; lastName: string; email: string } }));
vi.mock('@/hooks/useAccount', () => ({ useAccount: () => ({ customer: account.customer, isLoading: false, mutate: vi.fn() }) }));

const CHANNEL = { email: 'care@malva-coffee.example', phone: '+1 212 555 0100', replyWithin: 'one business day' };

async function fillValid(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Name'), 'Maya Test');
  await user.type(screen.getByLabelText('Email'), 'maya@example.com');
  await user.selectOptions(screen.getByLabelText('Topic'), 'order');
  await user.type(screen.getByLabelText('Message'), 'My capsules arrived damaged.');
  await user.click(screen.getByRole('checkbox'));
}

const submit = () => screen.getByRole('button', { name: /send message|sending/i });

beforeEach(() => {
  account.customer = null;
});
afterEach(() => vi.unstubAllGlobals());

describe('ContactForm', () => {
  it('the consent checkbox is a 24 px target (WCAG 2.5.8)', () => {
    renderWithIntl(<ContactForm locale="en-US" channel={CHANNEL} />);
    expect(screen.getByRole('checkbox').className).toMatch(/\bsize-6\b/);
  });

  it('Enquiry accepted downstream: confirmation names the channel and shows the reference', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ reference: 'MC-20261021-K7P2QX', channel: 'Customer care' }, { status: 202 }));
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    renderWithIntl(<ContactForm locale="en-US" channel={CHANNEL} />);
    await fillValid(user);
    await user.click(submit());
    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent('Thank you. We have your message.');
    expect(status).toHaveTextContent('Reference MC-20261021-K7P2QX');
    expect(status).toHaveTextContent('Received by Customer care');
    expect(status).toHaveTextContent('We usually reply within one business day.');
    const sent = JSON.parse(String(fetchMock.mock.calls[0][1].body)) as Record<string, unknown>;
    expect(sent).toMatchObject({ name: 'Maya Test', topic: 'order', consent: true, locale: 'en-US', website: '' });
  });

  it('Routing unavailable: text is preserved and phone and email are offered', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ error: { code: 'contact_unavailable' } }, { status: 503 })));
    const user = userEvent.setup();
    renderWithIntl(<ContactForm locale="en-US" channel={CHANNEL} />);
    await fillValid(user);
    await user.click(submit());
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('We could not send your message. What you wrote is still here.');
    expect(alert).toHaveTextContent('care@malva-coffee.example');
    expect(alert).toHaveTextContent('+1 212 555 0100');
    expect(screen.getByLabelText('Message')).toHaveValue('My capsules arrived damaged.');
    expect(screen.getByLabelText('Name')).toHaveValue('Maya Test');
    expect(submit()).toBeEnabled();
    expect(screen.queryByText(/Reference MC-/)).toBeNull();
  });

  it('a 429 adds the wait message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ error: { code: 'rate_limited' } }, { status: 429 })));
    const user = userEvent.setup();
    renderWithIntl(<ContactForm locale="en-US" channel={CHANNEL} />);
    await fillValid(user);
    await user.click(submit());
    expect(await screen.findByRole('alert')).toHaveTextContent('Please wait a few minutes before trying again.');
  });

  it('first invalid field gets focus', async () => {
    const user = userEvent.setup();
    renderWithIntl(<ContactForm locale="en-US" channel={CHANNEL} />);
    await user.click(submit());
    expect(screen.getByLabelText('Name')).toHaveFocus();
    await user.type(screen.getByLabelText('Name'), 'Maya Test');
    await user.click(submit());
    expect(screen.getByLabelText('Email')).toHaveFocus();
  });

  it('labels errors and aria-invalid are wired', async () => {
    const user = userEvent.setup();
    renderWithIntl(<ContactForm locale="en-US" channel={CHANNEL} />);
    await user.click(submit());
    const name = screen.getByLabelText('Name');
    expect(name).toHaveAttribute('aria-invalid', 'true');
    expect(name).toHaveAttribute('aria-describedby', 'contact-name-error');
    expect(document.getElementById('contact-name-error')).toHaveTextContent('This field is required.');
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('checkbox')).toHaveAttribute('aria-describedby', 'contact-consent-error');
    expect(screen.getByText('Please confirm to continue.')).toBeInTheDocument();
  });

  it('button is disabled while sending', async () => {
    let resolve: (r: Response) => void = () => {};
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((r) => (resolve = r))));
    const user = userEvent.setup();
    renderWithIntl(<ContactForm locale="en-US" channel={CHANNEL} />);
    await fillValid(user);
    await user.click(submit());
    expect(screen.getByRole('button', { name: 'Sending...' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Sending...' })).toHaveAttribute('aria-busy', 'true');
    await act(async () => resolve(Response.json({ reference: 'MC-20261021-AAAAAA', channel: 'Customer care' }, { status: 202 })));
    await waitFor(() => expect(screen.getByRole('status')).toBeInTheDocument());
  });

  it('signed-in prefill does not overwrite typed text', async () => {
    account.customer = { firstName: 'Maya', lastName: 'Test', email: 'maya@example.com' };
    const { rerender } = renderWithIntl(<ContactForm locale="en-US" channel={CHANNEL} />);
    expect(screen.getByLabelText('Name')).toHaveValue('Maya Test');
    expect(screen.getByLabelText('Email')).toHaveValue('maya@example.com');
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Someone Else' } });
    account.customer = { firstName: 'Maya', lastName: 'Changed', email: 'other@example.com' };
    rerender(<ContactForm locale="en-US" channel={CHANNEL} />);
    expect(screen.getByLabelText('Name')).toHaveValue('Someone Else');
  });

  it('the honeypot field is hidden from people and assistive technology', () => {
    renderWithIntl(<ContactForm locale="en-US" channel={CHANNEL} />);
    const honeypot = document.getElementById('contact-website')!;
    expect(honeypot).toHaveAttribute('tabindex', '-1');
    expect(honeypot).toHaveAttribute('autocomplete', 'off');
    expect(honeypot.closest('[aria-hidden="true"]')).not.toBeNull();
  });

  it('warns about card numbers and opens the privacy policy in a new tab', () => {
    renderWithIntl(<ContactForm locale="en-US" channel={CHANNEL} />);
    expect(screen.getByText('Please do not include card numbers or passwords.')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'privacy policy' });
    expect(link).toHaveAttribute('href', '/policies/privacy');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });
});
