import { existsSync } from 'node:fs';
import path from 'node:path';
import { screen } from '@testing-library/react';
import { createTranslator } from 'next-intl';
import deMessages from '@/messages/de-DE.json';
import enMessages from '@/messages/en-US.json';
import { renderWithProviders } from '@/test/utils';

vi.mock('next-intl/server', () => ({
  setRequestLocale: vi.fn(),
  getTranslations: async ({ locale, namespace }: { locale: 'en-US' | 'de-DE'; namespace: string }) =>
    createTranslator({ locale, messages: locale === 'de-DE' ? deMessages : enMessages, namespace: namespace as 'content' }),
}));

import SupportPage from './page';

function props(locale = 'en-US') {
  return { params: Promise.resolve({ locale }) };
}

describe('support page', () => {
  it('Replacement behaviour: mailto link href and visible address (en-US and de-DE)', async () => {
    renderWithProviders(await SupportPage(props()));
    expect(screen.getByRole('heading', { level: 1, name: 'Support' })).toBeInTheDocument();
    expect(screen.getByText('support@malva.example')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Email support' })).toHaveAttribute('href', 'mailto:support@malva.example?subject=Malva%20Telecom%20support%20request');
    document.body.innerHTML = '';
    renderWithProviders(await SupportPage(props('de-DE')), { locale: 'de-DE' });
    expect(screen.getByRole('link', { name: 'E-Mail an den Support' })).toHaveAttribute('href', 'mailto:support@malva.example?subject=Anfrage%20an%20den%20Malva-Telecom-Support');
  });

  it('Replacement behaviour: no form element, no fetch call on render, no app/api/contact route', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const { container } = renderWithProviders(await SupportPage(props()));
    expect(container.querySelectorAll('form, button[type="submit"], input, textarea')).toHaveLength(0);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(existsSync(path.join(process.cwd(), 'app', 'api', 'contact'))).toBe(false);
    vi.unstubAllGlobals();
  });

  it('Replacement behaviour: no script, iframe or chat text', async () => {
    const { container } = renderWithProviders(await SupportPage(props()));
    expect(container.querySelectorAll('script, iframe')).toHaveLength(0);
    expect(container.textContent).not.toMatch(/chat/i);
  });

  it('shows one open question per topic and a link to all questions', async () => {
    const { container } = renderWithProviders(await SupportPage(props()));
    expect(screen.getByRole('heading', { level: 2, name: 'Popular questions' })).toBeInTheDocument();
    const details = container.querySelectorAll('details');
    expect(details).toHaveLength(3);
    for (const d of details) expect(d).toHaveAttribute('open');
    expect(container.textContent).toContain('Monthly service lines are billed every month');
    expect(screen.getByRole('link', { name: 'All questions' })).toHaveAttribute('href', '/en-US/faq');
  });
});
