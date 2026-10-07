import { screen, within } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { BlogFilters } from './BlogFilters';

const ALL = ['internet', 'labels', 'phone', 'pricing'];

describe('BlogFilters', () => {
  it('lists every topic as a link that adds itself to the applied ones', () => {
    renderWithProviders(<BlogFilters allTags={ALL} applied={['internet']} />);
    const nav = screen.getByRole('navigation', { name: 'Filter by topic' });
    expect(within(nav).getByRole('link', { name: 'Pricing' })).toHaveAttribute('href', '/en-US/blog?tag=internet&tag=pricing');
  });

  it('shows applied topics as removable chips that drop only their own tag', () => {
    renderWithProviders(<BlogFilters allTags={ALL} applied={['phone', 'labels']} />);
    expect(screen.getByRole('link', { name: 'Remove filter: Phone' })).toHaveAttribute('href', '/en-US/blog?tag=labels');
    expect(screen.getByRole('link', { name: 'Remove filter: Labels' })).toHaveAttribute('href', '/en-US/blog?tag=phone');
    expect(screen.getByRole('link', { name: 'Clear filters' })).toHaveAttribute('href', '/en-US/blog');
  });

  it('removing the last applied topic returns to the plain listing', () => {
    renderWithProviders(<BlogFilters allTags={ALL} applied={['pricing']} />);
    expect(screen.getByRole('link', { name: 'Remove filter: Pricing' })).toHaveAttribute('href', '/en-US/blog');
  });

  it('keeps an applied tag that no article carries and stops adding topics after three', () => {
    renderWithProviders(<BlogFilters allTags={ALL} applied={['internet', 'labels', 'ghost']} />);
    expect(screen.getByRole('link', { name: 'Remove filter: ghost' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Pricing' })).not.toBeInTheDocument();
    expect(screen.getByText('Pricing')).toBeInTheDocument();
  });

  it('has no Clear filters link when nothing is applied and uses German labels', () => {
    renderWithProviders(<BlogFilters allTags={ALL} applied={[]} />, { locale: 'de-DE' });
    expect(screen.queryByRole('link', { name: 'Filter zurücksetzen' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Mobilfunk' })).toHaveAttribute('href', '/de-DE/blog?tag=phone');
  });
});
