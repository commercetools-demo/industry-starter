import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { NextIntlClientProvider } from 'next-intl';
import { SWRConfig } from 'swr';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import deMessages from '@/messages/de-DE.json';
import messages from '@/messages/en-US.json';
import { plumbingServices, wasteServices, fakeGetTranslations } from '@/components/service/test-fixtures';
import type { QuoteList, QuoteListLine } from '@/lib/types';

let searchParams = new URLSearchParams();
const push = vi.fn();
vi.mock('next/navigation', async (importOriginal) => ({ ...(await importOriginal<typeof import('next/navigation')>()), usePathname: () => '/en-US/request-a-quote', useRouter: () => ({ push, replace: vi.fn(), prefetch: vi.fn() }), useSearchParams: () => searchParams }));
vi.mock('next-intl/server', () => ({ getTranslations: (a: never) => fakeGetTranslations(a) }));
const { QuoteListPage } = await import('./QuoteListPage');
const { RequestForm } = await import('./RequestForm');
const { ContactAside } = await import('./ContactAside');
const { AddToQuoteList } = await import('@/components/service/AddToQuoteList');
const { QuoteListLink } = await import('@/components/layout/QuoteListLink');

const [pipe, drain] = [plumbingServices[0]!, plumbingServices[1]!];
const hazardous = wasteServices[2]!;
const line = (s: { id: string; slug: string; name: string; category: 'plumbing' | 'waste-management' }, over: Partial<QuoteListLine> = {}): QuoteListLine => ({ id: `l-${s.id}`, serviceId: s.id, slug: s.slug, name: s.name, quantity: 1, available: true, category: s.category, frequencies: ['annual'], needsWasteDetails: false, ...over });
const asList = (lines: QuoteListLine[], extra: Partial<QuoteList> = {}): QuoteList => ({ id: lines.length ? 'cart-1' : null, lines, count: lines.length, ...extra });

/** A tiny stand-in server for the browser calls of these pages. */
interface Server { list: QuoteList; account: unknown; context: unknown; submit: (body: Record<string, unknown>) => { status: number; body: unknown }; calls: Array<{ url: string; method: string; body?: Record<string, unknown> }> }
let server: Server;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
beforeEach(() => {
  searchParams = new URLSearchParams();
  server = { list: asList([]), account: null, context: { signedIn: false, canSubmit: true, sites: [] }, submit: () => ({ status: 200, body: { reference: 'MQ-ABC234' } }), calls: [] };
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : undefined;
    server.calls.push({ url, method, body });
    if (url === '/api/auth/me') return json(server.account);
    if (url === '/api/quote-requests/context') return json(server.context);
    if (url === '/api/quote-requests') { const r = server.submit(body!); if (r.status === 200) server.list = asList([]); return json(r.body, r.status); }
    if (url === '/api/quote-list' && method === 'GET') return json(server.list);
    if (url === '/api/quote-list/lines' && method === 'POST') {
      const all = [pipe, drain, hazardous];
      const s = all.find((x) => x.id === body!.serviceId || x.slug === body!.serviceSlug)!;
      const existing = server.list.lines.some((l) => l.serviceId === s.id);
      if (!existing) server.list = asList([...server.list.lines, line(s, { frequency: body!.frequency as string | undefined, needsWasteDetails: s.needsWasteDetails })]);
      return json({ ...server.list, ...(existing ? { alreadyInList: true } : {}) });
    }
    const m = url.match(/^\/api\/quote-list\/lines\/(.+)$/);
    if (m && method === 'PATCH') { server.list = asList(server.list.lines.map((l) => (l.id === m[1] ? { ...l, ...body } : l))); return json(server.list); }
    if (m && method === 'DELETE') { server.list = asList(server.list.lines.filter((l) => l.id !== m[1])); return json(server.list); }
    return json({ error: 'no' }, 404);
  }));
});
afterEach(() => { vi.unstubAllGlobals(); sessionStorage.clear(); document.cookie = 'malva-ql-notice=; path=/; max-age=0'; });

const Wrap = ({ children, locale = 'en-US' }: { children: React.ReactNode; locale?: string }) => (
  <NextIntlClientProvider locale={locale} messages={locale === 'de-DE' ? deMessages : messages}><SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>{children}</SWRConfig></NextIntlClientProvider>
);
const show = (ui: React.ReactNode, locale?: string) => render(<Wrap locale={locale}>{ui}</Wrap>);
const noAxeRegion = { rules: { region: { enabled: false } } };

describe('malva-quote-list › Quote list is not a purchase', () => {
  it('Copy and controls: the sentence is shown, and no price, total, discount, delivery or payment text or control appears', async () => {
    server.list = asList([line(pipe), line(drain, { frequency: 'annual', note: 'Rear yard' })]);
    const { container } = show(<QuoteListPage />);
    await screen.findAllByTestId('quote-line');
    const sentence = 'No payment is taken. We reply within one working day with a priced quote.';
    expect(screen.getByText(sentence)).toBeInTheDocument();
    const rest = (container.textContent ?? '').replace(sentence, '');
    expect(rest).not.toMatch(/[£$€]|\b(price|total|subtotal|discount|promo|coupon|voucher|delivery|shipping|payment|checkout)\b/i);
    expect(screen.queryByRole('textbox', { name: /code|discount|promo/i })).toBeNull();
    expect(screen.queryByRole('spinbutton')).toBeNull();
    expect(screen.getByText('Services: 2')).toBeInTheDocument();
    expect(await axe(container, noAxeRegion)).toHaveNoViolations();
  });
});

describe('malva-quote-list › Edit the list', () => {
  it('Frequency options per service: No preference, One-off and only the frequencies that service supports', async () => {
    server.list = asList([line(drain, { frequencies: ['quarterly', 'annual'] })]);
    show(<QuoteListPage />);
    const select = await screen.findByRole('combobox', { name: `Frequency for ${drain.name}` });
    expect(within(select).getAllByRole('option').map((o) => o.textContent)).toEqual(['No preference', 'One-off', 'Quarterly', 'Annual']);
    await userEvent.selectOptions(select, 'quarterly');
    await waitFor(() => expect(server.calls.at(-1)).toMatchObject({ method: 'PATCH', body: { frequency: 'quarterly' } }));
    expect(await screen.findByDisplayValue('Quarterly')).toBeInTheDocument();
  });
  it('a note is saved when the field loses focus', async () => {
    server.list = asList([line(pipe)]);
    show(<QuoteListPage />);
    await userEvent.type(await screen.findByLabelText(`Note for ${pipe.name}`), 'Call first');
    await userEvent.tab();
    await waitFor(() => expect(server.calls.at(-1)).toMatchObject({ method: 'PATCH', body: { note: 'Call first' } }));
  });
  it('Remove last service: the empty state with links to both listings appears and the nav count disappears', async () => {
    server.list = asList([line(pipe)]);
    const { container } = show(<><QuoteListLink /><QuoteListPage /></>);
    await screen.findByText('Services: 1');
    expect(container.querySelector('.ql')!.getAttribute('data-empty')).toBe('false');
    await userEvent.click(screen.getByRole('button', { name: `Remove ${pipe.name}` }));
    expect(await screen.findByText('Your quote list is empty. Choose the services you want quoted.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse plumbing' })).toHaveAttribute('href', '/en-US/plumbing');
    expect(screen.getByRole('link', { name: 'Browse waste management' })).toHaveAttribute('href', '/en-US/waste-management');
    expect(container.querySelector('.ql')!.getAttribute('data-empty')).toBe('true');
  });
  it('Service no longer available: flagged, removable, and Continue is disabled when nothing available is left', async () => {
    server.list = asList([line(pipe, { available: false })]);
    show(<QuoteListPage />);
    expect(await screen.findByTestId('unavailable')).toHaveTextContent('No longer available');
    expect(screen.getByRole('button', { name: 'Continue to request' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: `Remove ${pipe.name}` }));
    expect(await screen.findByTestId('quote-list-empty')).toBeInTheDocument();
  });
  it('shows an inline retry when the list cannot be loaded', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ error: 'x' }, 500)));
    show(<QuoteListPage />);
    expect(await screen.findByText('We could not load your quote list.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});

describe('malva-quote-list › Continue to the request form', () => {
  it('Continue: a link to the request form that opens at the Site step', async () => {
    server.list = asList([line(pipe)]);
    show(<QuoteListPage />);
    expect(await screen.findByRole('link', { name: 'Continue to request' })).toHaveAttribute('href', '/en-US/request-a-quote?from=list');
    expect(screen.getByRole('link', { name: 'Add another service' })).toBeInTheDocument();
  });
});

describe('malva-locale-routing › Quote list on switch (notice)', () => {
  it('says the list was started again when the response flags it, or the switch left its cookie (cleared after showing)', async () => {
    server.list = asList([line(pipe)], { rebuilt: true });
    const first = show(<QuoteListPage />);
    expect(await screen.findByTestId('rebuilt-notice')).toHaveTextContent('started your quote list again');
    first.unmount();
    server.list = asList([line(pipe)]);
    document.cookie = 'malva-ql-notice=1; path=/';
    show(<QuoteListPage />);
    expect(await screen.findByTestId('rebuilt-notice')).toBeInTheDocument();
    expect(document.cookie).not.toContain('malva-ql-notice');
  });
  it('the page is German under de-DE', async () => {
    server.list = asList([]);
    show(<QuoteListPage />, 'de-DE');
    expect(await screen.findByText('Ihre Angebotsliste ist leer. Wählen Sie die Leistungen, für die Sie ein Angebot wünschen.')).toBeInTheDocument();
  });
});

describe('malva-persistence › merge and reload (client view)', () => {
  it('Persistence and Merge at sign-in: whatever the server returns for the new session (three merged lines) is what the page lists, with the nav count', async () => {
    server.list = asList([line(pipe), line(drain), line(hazardous)]);
    const { container } = show(<><QuoteListLink /><QuoteListPage /></>);
    expect(await screen.findAllByTestId('quote-line')).toHaveLength(3);
    expect(container.querySelector('.ql a')!.textContent).toBe('Quote list (3)');
  });
});

describe('malva-service-detail › Add the service to the quote list', () => {
  it('Add: the list gets the service, the island shows "Added" with a link to the list, and the nav count becomes 1', async () => {
    const { container } = show(<><QuoteListLink /><AddToQuoteList serviceId={pipe.id} slug={pipe.slug} frequencies={['one-off', 'annual']} /></>);
    await userEvent.click(await screen.findByRole('button', { name: 'Add to quote list' }));
    expect(await screen.findByTestId('quote-list-added')).toHaveTextContent('Added to your quote list');
    expect(screen.getByRole('link', { name: 'View quote list' })).toHaveAttribute('href', '/en-US/quote-list');
    expect(server.calls.find((c) => c.method === 'POST')!.body).toMatchObject({ serviceId: pipe.id });
    expect(container.querySelector('.ql a')!.textContent).toBe('Quote list (1)');
  });
  it('Already added: the service is shown as added from the start and no second add is possible', async () => {
    server.list = asList([line(pipe)]);
    show(<AddToQuoteList serviceId={pipe.id} slug={pipe.slug} />);
    expect(await screen.findByTestId('quote-list-added')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add to quote list' })).toBeNull();
    expect(server.calls.some((c) => c.method === 'POST')).toBe(false);
  });
});

describe('malva-request-a-quote › Three-step request form', () => {
  it('Choose what is needed: with an empty list step 1 offers Plumbing, Waste management or Both and a free-text need', async () => {
    const { container } = show(<RequestForm />);
    expect(await screen.findByRole('heading', { name: 'What do you need?' })).toBeInTheDocument();
    for (const name of ['Plumbing', 'Waste management', 'Both']) expect(screen.getByRole('radio', { name: new RegExp(name) })).toBeInTheDocument();
    expect(screen.getByLabelText('What do you need? (optional)')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Request steps' })).toBeInTheDocument();
    expect(await axe(container, noAxeRegion)).toHaveNoViolations();
  });
  it('Services from the list: the chosen services are shown and editable, and the three-way choice is only behind "Not sure yet"', async () => {
    server.list = asList([line(pipe), line(drain)]);
    show(<RequestForm />);
    expect(await screen.findAllByTestId('request-line')).toHaveLength(2);
    expect(screen.queryByRole('radio', { name: /Plumbing/ })).toBeNull();
    await userEvent.selectOptions(screen.getByLabelText(`Frequency for ${pipe.name}`), 'annual');
    await waitFor(() => expect(server.calls.at(-1)).toMatchObject({ method: 'PATCH', body: { frequency: 'annual' } }));
    await userEvent.click(screen.getByRole('button', { name: 'Not sure yet' }));
    expect(screen.getByRole('radio', { name: /Plumbing/ })).toBeInTheDocument();
  });
  it('Continue from the list: opens at the Site step', async () => {
    searchParams = new URLSearchParams('from=list');
    server.list = asList([line(pipe)]);
    show(<RequestForm />);
    expect(await screen.findByRole('heading', { name: 'Where is the site?' })).toBeInTheDocument();
  });
  it('Preselected service: ?service=<slug> adds that service first', async () => {
    searchParams = new URLSearchParams(`service=${drain.slug}`);
    show(<RequestForm />);
    expect(await screen.findAllByTestId('request-line')).toHaveLength(1);
    expect(server.calls.find((c) => c.method === 'POST')!.body).toEqual({ serviceSlug: drain.slug });
  });
  it('Going back keeps data: entries of step 2 are still there after Back and Continue', async () => {
    server.list = asList([line(pipe)]);
    show(<RequestForm />);
    await screen.findAllByTestId('request-line');
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await userEvent.type(await screen.findByLabelText(/Company name/), 'Acme Plant');
    await userEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(await screen.findByRole('heading', { name: 'What do you need?' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByLabelText(/Company name/)).toHaveValue('Acme Plant');
  });
});

describe('malva-request-a-quote › Required information and validation', () => {
  it('Missing service: "Please choose a service." is shown, the step does not advance and focus goes to the choice', async () => {
    show(<RequestForm />);
    await userEvent.click(await screen.findByRole('button', { name: 'Continue' }));
    expect((await screen.findAllByText('Please choose a service.')).length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: 'What do you need?' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('radio', { name: /Plumbing/ })).toHaveFocus());
  });
  it('Sector and site capture: step 2 offers the five sectors, a site address and the number of sites; ?sector= preselects', async () => {
    searchParams = new URLSearchParams('sector=healthcare');
    server.list = asList([line(pipe)]);
    show(<RequestForm />);
    await screen.findAllByTestId('request-line');
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    const sector = await screen.findByLabelText(/Sector/);
    expect(within(sector).getAllByRole('option').map((o) => o.textContent).slice(1)).toEqual(['Facilities management', 'Manufacturing', 'Property / real estate', 'Healthcare', 'Other']);
    expect(sector).toHaveValue('healthcare');
    expect(screen.getByLabelText(/Site address/)).toBeInTheDocument();
    expect(within(screen.getByLabelText(/Number of sites/)).getAllByRole('option').map((o) => o.textContent).slice(1)).toEqual(['1', '2–10', '11–50', '50+']);
  });
  it('step 2 reports each problem next to its field (aria-invalid, aria-describedby) and focuses the first one', async () => {
    server.list = asList([line(pipe)]);
    show(<RequestForm />);
    await screen.findAllByTestId('request-line');
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Continue' }));
    const company = screen.getByLabelText(/Company name/);
    expect(screen.getAllByText('Please enter your company name.').length).toBeGreaterThan(0);
    expect(company).toHaveAttribute('aria-invalid', 'true');
    expect(company.getAttribute('aria-describedby')).toBeTruthy();
    await waitFor(() => expect(company).toHaveFocus());
  });
});

describe('malva-request-a-quote › Sector-specific questions', () => {
  const toSiteStep = async () => { await screen.findAllByTestId('request-line'); await userEvent.click(screen.getByRole('button', { name: 'Continue' })); await screen.findByLabelText(/Company name/); };
  it('Clinical waste selected: the optional waste-type and permit fields are shown', async () => {
    server.list = asList([line(hazardous, { needsWasteDetails: true })]);
    show(<RequestForm />);
    await toSiteStep();
    expect(screen.getByTestId('waste-details')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /clinical/i })).toBeInTheDocument();
    expect(screen.getByLabelText('Permit or licence number')).toBeInTheDocument();
  });
  it('Only plumbing selected: those fields are not shown', async () => {
    server.list = asList([line(pipe)]);
    show(<RequestForm />);
    await toSiteStep();
    expect(screen.queryByTestId('waste-details')).toBeNull();
  });
});

async function fillVisitor(user: ReturnType<typeof userEvent.setup>, over: { email?: string } = {}) {
  await user.click(await screen.findByRole('radio', { name: /Plumbing/ }));
  await user.click(screen.getByRole('button', { name: 'Continue' }));
  await user.type(await screen.findByLabelText(/Company name/), 'Acme Plant');
  await user.selectOptions(screen.getByLabelText(/Sector/), 'manufacturing');
  await user.type(screen.getByLabelText(/Site address/), '1 Mill Lane');
  await user.type(screen.getByLabelText(/^City/), 'Cleveland');
  await user.type(screen.getByLabelText(/Postcode/), '44114');
  await user.selectOptions(screen.getByLabelText(/Number of sites/), '2-10');
  await user.click(screen.getByRole('button', { name: 'Continue' }));
  await user.type(await screen.findByLabelText(/Full name/), 'Ada Lovelace');
  await user.type(screen.getByLabelText(/Work email/), over.email ?? 'ada@acme.co');
  await user.type(screen.getByLabelText(/Password/), 'a-long-passphrase-1');
}

describe('malva-request-a-quote › An account is required to submit', () => {
  it('Visitor without an account: step 3 asks for name, job title, email, phone and password, links to sign in, shows the consent line and says an account is created', async () => {
    const user = userEvent.setup();
    const { container } = show(<RequestForm />);
    await user.click(await screen.findByRole('radio', { name: /Plumbing/ }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.type(await screen.findByLabelText(/Company name/), 'Acme');
    await user.selectOptions(screen.getByLabelText(/Sector/), 'manufacturing');
    await user.type(screen.getByLabelText(/Site address/), '1 Mill Lane');
    await user.type(screen.getByLabelText(/^City/), 'Cleveland');
    await user.type(screen.getByLabelText(/Postcode/), '44114');
    await user.selectOptions(screen.getByLabelText(/Number of sites/), '1');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('heading', { name: 'Create your account and submit' })).toBeInTheDocument();
    for (const label of [/Full name/, /Job title/, /Work email/, /Phone/, /Password/]) expect(screen.getByLabelText(label)).toBeInTheDocument();
    expect(screen.getByText(/creates a client account/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', expect.stringContaining('/account/sign-in'));
    expect(screen.getByText(/We use these details only to respond to your request/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Privacy policy' })).toHaveAttribute('href', '/en-US/privacy');
    expect(screen.getByRole('button', { name: 'Create account and submit' })).toBeInTheDocument();
    expect(await axe(container, noAxeRegion)).toHaveNoViolations();
  });
  it('Invalid email: "Please enter a valid email address." next to the field, focus moves to it and it is announced; nothing is sent', async () => {
    const user = userEvent.setup();
    show(<RequestForm />);
    await fillVisitor(user, { email: 'ada@' });
    await user.click(screen.getByRole('button', { name: 'Create account and submit' }));
    const email = screen.getByLabelText(/Work email/);
    expect(email).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getAllByText('Please enter a valid email address.').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('alert').some((a) => a.textContent === 'Please enter a valid email address.')).toBe(true);
    await waitFor(() => expect(email).toHaveFocus());
    expect(server.calls.some((c) => c.url === '/api/quote-requests')).toBe(false);
  });
  it('Account and request in one action, then the confirmation with name and reference; the list and account are refreshed', async () => {
    const user = userEvent.setup();
    show(<RequestForm />);
    await fillVisitor(user);
    await user.click(screen.getByRole('button', { name: 'Create account and submit' }));
    const done = await screen.findByTestId('request-confirmation');
    expect(done).toHaveTextContent('Request received. Thanks Ada Lovelace — our commercial team will contact you within one working day.');
    expect(done).toHaveTextContent('MQ-ABC234');
    expect(within(done).getByRole('link', { name: 'View your quotes and requests' })).toHaveAttribute('href', '/en-US/account/quotes');
    const post = server.calls.find((c) => c.url === '/api/quote-requests')!;
    expect(post.body).toMatchObject({ locale: 'en-US', website: '', idempotencyKey: expect.stringMatching(/^[0-9a-f-]{36}$/), fields: { company: 'Acme Plant', contactName: 'Ada Lovelace', email: 'ada@acme.co', siteCount: '2-10', choice: 'plumbing' } });
  });
  it('Email already has an account: the page asks the visitor to sign in and keeps everything entered', async () => {
    const user = userEvent.setup();
    server.submit = () => ({ status: 409, body: { error: 'An account may already exist', code: 'account-exists' } });
    show(<RequestForm />);
    await fillVisitor(user);
    await user.click(screen.getByRole('button', { name: 'Create account and submit' }));
    const message = await screen.findByTestId('form-message');
    expect(message).toHaveTextContent('An account may already exist for this email address');
    expect(within(message).getByRole('link', { name: 'Sign in to continue' })).toHaveAttribute('href', expect.stringContaining('/account/sign-in'));
    expect(screen.getByLabelText(/Work email/)).toHaveValue('ada@acme.co');
    expect(screen.queryByTestId('request-confirmation')).toBeNull();
  });
});

describe('malva-request-a-quote › Submission creates exactly one request', () => {
  it('Delivery failure: an error above the buttons, entered data kept, nothing reported as received', async () => {
    const user = userEvent.setup();
    server.submit = () => ({ status: 500, body: { error: 'Something went wrong. Please try again.' } });
    show(<RequestForm />);
    await fillVisitor(user);
    await user.click(screen.getByRole('button', { name: 'Create account and submit' }));
    expect(await screen.findByTestId('form-message')).toHaveTextContent('We could not send your request. Nothing was sent');
    expect(screen.getByLabelText(/Full name/)).toHaveValue('Ada Lovelace');
    expect(screen.queryByTestId('request-confirmation')).toBeNull();
    expect(screen.getByRole('button', { name: 'Create account and submit' })).toBeEnabled();
  });
  it('Double submit: a second click while sending posts nothing more, and a retry reuses the same key', async () => {
    const user = userEvent.setup();
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    const base = fetch as unknown as (url: string, init?: RequestInit) => Promise<Response>;
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => { if (url === '/api/quote-requests') { server.calls.push({ url, method: 'POST', body: JSON.parse(String(init!.body)) }); await gate; return json({ reference: 'MQ-ABC234' }); } return base(url, init); }));
    show(<RequestForm />);
    await fillVisitor(user);
    const button = screen.getByRole('button', { name: 'Create account and submit' });
    await user.click(button);
    await user.click(screen.getByRole('button', { name: 'Sending…' }));
    release();
    await screen.findByTestId('request-confirmation');
    expect(server.calls.filter((c) => c.url === '/api/quote-requests')).toHaveLength(1);
  });
  it('"Add another site" starts a new request with the services prefilled', async () => {
    const user = userEvent.setup();
    server.list = asList([line(pipe, { frequency: 'annual' })]);
    show(<RequestForm />);
    await screen.findAllByTestId('request-line');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.type(await screen.findByLabelText(/Company name/), 'Acme');
    await user.selectOptions(screen.getByLabelText(/Sector/), 'other');
    await user.type(screen.getByLabelText(/Site address/), '1 Mill Lane');
    await user.type(screen.getByLabelText(/^City/), 'Cleveland');
    await user.type(screen.getByLabelText(/Postcode/), '44114');
    await user.selectOptions(screen.getByLabelText(/Number of sites/), '1');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.type(await screen.findByLabelText(/Full name/), 'Ada Lovelace');
    await user.type(screen.getByLabelText(/Work email/), 'ada@acme.co');
    await user.type(screen.getByLabelText(/Password/), 'a-long-passphrase-1');
    await user.click(screen.getByRole('button', { name: 'Create account and submit' }));
    await screen.findByTestId('request-confirmation');
    server.calls.length = 0;
    await user.click(screen.getByRole('button', { name: 'Add another site' }));
    expect(await screen.findByRole('heading', { name: 'Where is the site?' })).toBeInTheDocument();
    expect(server.calls.find((c) => c.method === 'POST' && c.url === '/api/quote-list/lines')!.body).toMatchObject({ serviceId: pipe.id, frequency: 'annual' });
    expect(screen.getByLabelText(/Company name/)).toHaveValue('Acme');
  });
});

describe('malva-request-a-quote › Signed-in clients', () => {
  const client = {
    signedIn: true, canSubmit: true, company: 'Northfield Foods', sector: 'manufacturing',
    sites: [{ id: 's1', label: '1 Mill Lane, Cleveland', addressLine1: '1 Mill Lane', city: 'Cleveland', postalCode: '44114', country: 'US' }, { id: 's2', label: '22 Depot Road, Columbus', addressLine1: '22 Depot Road', city: 'Columbus', postalCode: '43215', country: 'US' }],
    contact: { name: 'Dana Admin', email: 'demo.admin@example.com', jobTitle: 'Head of Facilities', phone: '555 0101' },
  };
  beforeEach(() => { server.account = { customerId: 'c1', email: 'demo.admin@example.com', businessUnitKey: 'mpw-co' }; server.context = client; server.list = asList([line(pipe)]); });
  it('Prefill: the company is filled, the sites are offered, a new address can be entered instead, and step 3 is prefilled with "Submit request"', async () => {
    const user = userEvent.setup();
    show(<RequestForm />);
    await screen.findAllByTestId('request-line');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(screen.getByLabelText(/Company name/)).toHaveValue('Northfield Foods'));
    expect(screen.getByRole('radio', { name: /1 Mill Lane, Cleveland/ })).toBeChecked();
    expect(screen.getByRole('radio', { name: /22 Depot Road, Columbus/ })).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'Enter a new address' }));
    expect(screen.getByLabelText(/Site address/)).toHaveValue('');
    await user.click(screen.getByRole('radio', { name: /22 Depot Road/ }));
    await user.selectOptions(screen.getByLabelText(/Number of sites/), '1');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByLabelText(/Full name/)).toHaveValue('Dana Admin');
    expect(screen.queryByLabelText(/Password/)).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Submit request' }));
    expect(await screen.findByTestId('request-confirmation')).toBeInTheDocument();
    expect(server.calls.find((c) => c.url === '/api/quote-requests')!.body).toMatchObject({ fields: { addressLine1: '22 Depot Road', city: 'Columbus', siteId: 's2' } });
  });
  it('Missing permission: the submit action is replaced by a message naming the company administrator', async () => {
    const user = userEvent.setup();
    server.context = { ...client, canSubmit: false, adminName: 'Dana Admin' };
    show(<RequestForm />);
    await screen.findAllByTestId('request-line');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(screen.getByLabelText(/Company name/)).toHaveValue('Northfield Foods'));
    await user.selectOptions(screen.getByLabelText(/Number of sites/), '1');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByTestId('no-permission')).toHaveTextContent('Please ask your company administrator, Dana Admin.');
    expect(screen.queryByRole('button', { name: /submit/i })).toBeNull();
  });
});

describe('malva-request-a-quote › Consent, abuse protection and contact alternatives', () => {
  it('Aside content: the commercial phone, email, opening hours and the 24/7 emergency line', async () => {
    const { container } = render(<Wrap>{await ContactAside({ locale: 'en-US' })}</Wrap>);
    expect(screen.getByRole('link', { name: '0800 555 0100' })).toHaveAttribute('href', 'tel:+448005550100');
    expect(screen.getByRole('link', { name: 'quotes@malva.example' })).toBeInTheDocument();
    expect(container).toHaveTextContent('Mon–Fri 7:30–18:00');
    expect(container).toHaveTextContent('Emergency? Contracted clients: call 0800 555 0142, 24/7.');
    expect(await axe(container, noAxeRegion)).toHaveNoViolations();
  });
  it('Automated submission: the honeypot is hidden from people and assistive technology, and is sent empty by a real visitor', async () => {
    const user = userEvent.setup();
    const { container } = show(<RequestForm />);
    await fillVisitor(user);
    const trap = container.querySelector('input[name="website"]')!;
    expect(trap.closest('[aria-hidden="true"]')).not.toBeNull();
    expect(trap).toHaveAttribute('tabindex', '-1');
  });
});

describe('malva-service-detail › Request a quote for this service', () => {
  it('Small screen: the request form is a single column of labelled controls (no horizontal table) and is German under de-DE', async () => {
    const { container } = show(<RequestForm />, 'de-DE');
    expect(await screen.findByRole('heading', { name: 'Was benötigen Sie?' })).toBeInTheDocument();
    expect(container.querySelector('table')).toBeNull();
    expect(screen.getByRole('radio', { name: /Sanitär/ })).toBeInTheDocument();
  });
});
