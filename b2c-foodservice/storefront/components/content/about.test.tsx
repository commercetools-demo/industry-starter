import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ABOUT } from '@/content/about';
import { renderWithIntl } from '@/test/render';
import AboutView from './AboutView';

vi.mock('@/i18n/routing', async () => (await import('@/test/shell')).routingMock());
vi.mock('@/components/layout/FooterStoreButton', () => ({
  default: ({ label }: { label: string }) => <button type="button">{label}</button>,
}));
// Any commerce module that About might reach throws: the page must not care.
vi.mock('@/lib/ct/promise', () => ({ getPromiseFigures: () => Promise.reject(new Error('commerce down')) }));
vi.mock('@/lib/ct/client', () => {
  throw new Error('commerce client must not be loaded by About');
});

describe('About', () => {
  it('Editor publishes a correction: content change appears in the rendered page from the module only', () => {
    const { unmount } = renderWithIntl(<AboutView locale="en-US" />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(ABOUT['en-US'].title);
    unmount();
    const corrected = { 'en-US': { ...ABOUT['en-US'], title: 'Corrected headline' } };
    renderWithIntl(<AboutView locale="en-US" content={corrected} />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Corrected headline');
  });

  it('Commerce tier degraded: About renders with commerce mocked to throw', () => {
    renderWithIntl(<AboutView locale="en-US" />);
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Contact us' })).toHaveAttribute('href', '/contact');
    expect(screen.getAllByRole('article')).toHaveLength(3);
  });

  it('Locale without translation: About shows the notice in en-CA when only the en-US text exists', () => {
    const { container } = renderWithIntl(<AboutView locale="en-CA" />, { locale: 'en-CA' });
    const note = screen.getByRole('note');
    expect(note).toHaveTextContent('This page is shown in English because it is not available in');
    expect(container.querySelector('[lang="en"]')).not.toBeNull();
  });

  it('about has one h1', () => {
    renderWithIntl(<AboutView locale="en-US" />);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('the store band opens the picker in the US and is absent in Canada', () => {
    const { unmount } = renderWithIntl(<AboutView locale="en-US" />);
    expect(screen.getByRole('button', { name: 'Find your store' })).toBeInTheDocument();
    unmount();
    renderWithIntl(<AboutView locale="en-CA" />, { locale: 'en-CA' });
    expect(screen.queryByRole('button', { name: 'Find your store' })).toBeNull();
  });
});
