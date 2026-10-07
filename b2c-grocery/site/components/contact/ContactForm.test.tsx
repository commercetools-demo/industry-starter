import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/utils';
import { ContactForm } from './ContactForm';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

async function fill({ name = 'Ada', email = 'ada@example.com', topic = 'order', message = 'Where is my order, please?' } = {}) {
  if (name) await userEvent.type(screen.getByLabelText('Your name'), name);
  if (email) await userEvent.type(screen.getByLabelText('Email'), email);
  if (topic) await userEvent.selectOptions(screen.getByLabelText('Topic'), topic);
  if (message) await userEvent.type(screen.getByLabelText('Message'), message);
}
const submit = () => userEvent.click(screen.getByRole('button', { name: 'Send message' }));

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn().mockResolvedValue(json({ ok: true }));
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe('ContactForm', () => {
  it('Valid submit: posts and shows the confirmation saying the message was received', async () => {
    renderWithProviders(<ContactForm />);
    await fill();
    await submit();
    expect(await screen.findByRole('heading', { name: 'Message received' })).toBeInTheDocument();
    const confirmation = screen.getByText(/We have received your message/);
    expect(confirmation).toBeInTheDocument();
    expect(confirmation.textContent).not.toMatch(/sent to/i);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/contact');
    expect(JSON.parse(init.body)).toMatchObject({ name: 'Ada', topic: 'order', website: '' });
  });

  it('Invalid email: inline error and nothing submitted', async () => {
    renderWithProviders(<ContactForm />);
    await fill({ email: 'not-an-email' });
    await submit();
    expect(await screen.findByText('Enter a valid email address.')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('message too short: inline error and nothing submitted', async () => {
    renderWithProviders(<ContactForm />);
    await fill({ message: 'too short' });
    await submit();
    expect(await screen.findByText('Your message must be at least 10 characters.')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('empty form: required errors on every field', async () => {
    renderWithProviders(<ContactForm />);
    await submit();
    expect(await screen.findAllByText('This field is required.')).toHaveLength(4);
  });

  it('honeypot is hidden from assistive tech and skipped by keyboard', () => {
    renderWithProviders(<ContactForm />);
    const input = document.querySelector('input[name="website"]') as HTMLInputElement;
    expect(input.tabIndex).toBe(-1);
    expect(input.closest('[aria-hidden="true"]')).not.toBeNull();
  });

  it('server rate limit: shows the retry message, keeps the form', async () => {
    fetchMock.mockResolvedValue(json({ error: 'RATE_LIMITED' }, 429));
    renderWithProviders(<ContactForm />);
    await fill();
    await submit();
    expect(await screen.findByRole('alert')).toHaveTextContent(/too many/i);
    expect(screen.getByRole('button', { name: 'Send message' })).toBeEnabled();
  });

  it('German locale: German labels and confirmation', async () => {
    renderWithProviders(<ContactForm />, { locale: 'de-DE' });
    await userEvent.type(screen.getByLabelText('Ihr Name'), 'Ada');
    await userEvent.type(screen.getByLabelText('E-Mail'), 'ada@example.com');
    await userEvent.selectOptions(screen.getByLabelText('Thema'), 'order');
    await userEvent.type(screen.getByLabelText('Nachricht'), 'Wo ist meine Bestellung?');
    await userEvent.click(screen.getByRole('button', { name: 'Nachricht senden' }));
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Nachricht erhalten' })).toBeInTheDocument());
  });
});
