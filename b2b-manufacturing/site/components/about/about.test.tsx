import { render, screen, within } from '@testing-library/react';
import { axe } from 'jest-axe';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import deMessages from '@/messages/de-DE.json';
import messages from '@/messages/en-US.json';
import { AboutPage } from './AboutPage';
import { PrivacyPage } from './PrivacyPage';

vi.mock('next/navigation', async (importOriginal) => ({ ...(await importOriginal<typeof import('next/navigation')>()), usePathname: () => '/en-US/about', useRouter: () => ({ push: vi.fn() }) }));
const wrap = (ui: React.ReactNode, locale = 'en-US', m: object = messages) => render(<NextIntlClientProvider locale={locale} messages={m as never}>{ui}</NextIntlClientProvider>);

describe('About page', () => {
  it('Page content: header, story, accreditations, three principles and closing band in order, breadcrumb Home / About', () => {
    const { container } = wrap(<AboutPage />);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('About Malva');
    const crumb = screen.getByRole('navigation', { name: 'About Malva' });
    expect(crumb).toHaveTextContent('Home / About');
    expect(within(crumb).getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/en-US');
    const h2s = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(h2s).toEqual(['One team, two disciplines', 'Accreditations', 'Principles', 'Talk to our commercial team.']);
    const principles = within(screen.getByRole('region', { name: 'Principles' })).getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(principles).toEqual(['Respond fast', 'Record everything', 'Waste less']);
    expect(container.querySelector('[data-image-slot="team-fleet"]')).not.toBeNull();
    expect(container.textContent).not.toMatch(/[€£$]\s?\d/);
  });
  it('Sample accreditations are labelled', () => {
    wrap(<AboutPage />);
    const section = screen.getByRole('region', { name: 'Accreditations' });
    expect(within(section).getByText('Sample content')).toHaveAttribute('data-sample', 'true');
    expect(within(section).getByText('ISO 9001')).toBeInTheDocument();
  });
  it('Closing band: Request a quote opens the request form', () => {
    wrap(<AboutPage />);
    expect(screen.getByRole('link', { name: 'Request a quote' })).toHaveAttribute('href', '/en-US/request-a-quote');
  });
  it('renders in German with no axe violations', async () => {
    const { container } = wrap(<main><AboutPage /></main>, 'de-DE', deMessages);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Über Malva');
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('Privacy notice', () => {
  it('lists the session cookie as the only cookie, flags sample and owner-to-confirm text, one h1', async () => {
    const { container } = wrap(<main><PrivacyPage /></main>);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    const cookies = screen.getByRole('heading', { name: 'Cookies' }).nextElementSibling!;
    expect(cookies).toHaveTextContent(/one cookie, a strictly necessary session cookie/);
    expect(cookies).toHaveTextContent(/no analytics/);
    expect(screen.getAllByText('To be confirmed by Malva')).toHaveLength(2);
    expect(container.querySelector('[data-sample="true"]')).not.toBeNull();
    for (const name of ['Who we are', 'What we collect', 'Why we collect it', 'How long we keep it', 'Cookies', 'Your rights']) {
      expect(screen.getByRole('heading', { level: 2, name: new RegExp(name) })).toBeInTheDocument();
    }
    expect(await axe(container)).toHaveNoViolations();
  });
});
