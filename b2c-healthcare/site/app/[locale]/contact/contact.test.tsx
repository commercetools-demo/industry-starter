import { createTranslator } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import messages from '@/messages/en-US.json';
import { localImportGraph } from '@/test/import-graph';
import { renderWithProviders, screen } from '@/test/utils';
import { readFileSync } from 'node:fs';

vi.mock('next-intl/server', () => ({
  setRequestLocale: () => undefined,
  getTranslations: async (namespace: string) => createTranslator({ locale: 'en-US', messages, namespace: namespace as 'static.contact' }),
}));
vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
}));

import ContactPage from './page';

const render = async (locale = 'en-US') => renderWithProviders(await ContactPage({ params: Promise.resolve({ locale }) }));

describe('contact-us › Contact page that confirms only enquiries support has accepted', () => {
  it('shows email, phone, hours and office addresses as plain text, with the emergency disclaimer', async () => {
    await render();
    expect(screen.getByText(/support@malva\.example/)).toBeInTheDocument();
    expect(screen.getByText(/\+1 555 010 0100/)).toBeInTheDocument();
    expect(screen.getByText(/Monday to Friday/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Offices' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'New York office' })).toBeInTheDocument();
    expect(screen.getByText(messages.content.emergency)).toBeInTheDocument();
  });

  it('no enquiry form, no input, no button and no script: nothing can be reported as delivered', async () => {
    const { container } = await render();
    expect(container.querySelector('form, input, textarea, select, button, script, iframe')).toBeNull();
    const source = readFileSync(`${import.meta.dirname}/page.tsx`, 'utf8');
    expect(source).not.toMatch(/fetch\(|<form|<Script|next\/script|use client/);
  });

  it('Region without an office: the general contact block is shown and there is no empty office block', async () => {
    await render('fr-FR');
    expect(screen.getByText(/support@malva\.example/)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Offices' })).toBeNull();
    expect(screen.queryByText(/appointment only/)).toBeNull();
  });

  it('is built from content files only (no commerce import)', () => {
    expect(localImportGraph(`${import.meta.dirname}/page.tsx`).filter((f) => /^lib\/(ct|session)(\/|\.)/.test(f))).toEqual([]);
  });
});
