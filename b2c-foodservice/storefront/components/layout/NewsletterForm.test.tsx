import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderShell, stubFetch } from '@/test/shell';

vi.mock('@/i18n/routing', async () => (await import('@/test/shell')).routingMock());

import NewsletterForm from '@/components/layout/NewsletterForm';

afterEach(() => vi.unstubAllGlobals());

const email = () => screen.getByLabelText('Email address');
const join = () => screen.getByRole('button', { name: 'Join' });

describe('NewsletterForm', () => {
  it('Newsletter valid address shows a confirmation toast', async () => {
    const { calls } = stubFetch({ '/api/newsletter': () => Response.json({ ok: true }, { status: 202 }) });
    renderShell(<NewsletterForm />);
    await userEvent.type(email(), 'qa@example.com');
    await userEvent.click(join());
    expect(await screen.findByRole('status')).toHaveTextContent("Thanks, you're on the list");
    expect(calls).toHaveLength(1);
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({ email: 'qa@example.com' });
    await waitFor(() => expect(email()).toHaveValue(''));
  });

  it('invalid address shows an inline error and sends nothing', async () => {
    const { calls } = stubFetch({});
    renderShell(<NewsletterForm />);
    await userEvent.type(email(), 'not-an-email');
    await userEvent.click(join());
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid email address');
    expect(email()).toHaveAttribute('aria-invalid', 'true');
    expect(email()).toHaveValue('not-an-email');
    expect(calls).toHaveLength(0);
  });

  it('server failure shows an error not silence', async () => {
    stubFetch({ '/api/newsletter': () => Response.json({ error: { code: 'internal_error', message: 'x' } }, { status: 500 }) });
    renderShell(<NewsletterForm />);
    await userEvent.type(email(), 'qa@example.com');
    await userEvent.click(join());
    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong, try again');
    expect(email()).toHaveValue('qa@example.com');
    expect(join()).not.toBeDisabled();
  });

  it('a network failure shows the same error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('network'); }));
    renderShell(<NewsletterForm />);
    await userEvent.type(email(), 'qa@example.com');
    await userEvent.click(join());
    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong, try again');
  });

  it('the button is disabled while the request is pending', async () => {
    let release: (r: Response) => void = () => {};
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((resolve) => { release = resolve; })));
    renderShell(<NewsletterForm />);
    await userEvent.type(email(), 'qa@example.com');
    await userEvent.click(join());
    expect(join()).toBeDisabled();
    release(Response.json({ ok: true }, { status: 202 }));
    await waitFor(() => expect(join()).not.toBeDisabled());
  });
});
