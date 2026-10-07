import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/utils';
import { DetailsCard } from './DetailsCard';

afterEach(() => vi.unstubAllEnvs());

describe('DetailsCard and the subscriptions flag', () => {
  it('on (default): the Subscriptions row links to the subscriptions page', () => {
    renderWithProviders(<DetailsCard />);
    expect(screen.getByRole('link', { name: /Subscriptions/ })).toHaveAttribute('href', '/en-US/account/subscriptions');
  });

  it('FEATURE_SUBSCRIPTIONS=false: the row is gone, the others stay', () => {
    vi.stubEnv('FEATURE_SUBSCRIPTIONS', 'false');
    renderWithProviders(<DetailsCard />);
    expect(screen.queryByRole('link', { name: /Subscriptions/ })).not.toBeInTheDocument();
    expect(screen.getAllByRole('link').map((l) => l.textContent?.replace('→', ''))).toEqual(['Orders', 'Addresses', 'Saved lists', 'Contact us']);
  });
});
