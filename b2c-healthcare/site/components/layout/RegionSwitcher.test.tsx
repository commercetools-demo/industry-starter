import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test/utils';

vi.mock('@/i18n/routing', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/doctors/remote',
}));

import { RegionSwitcher } from './RegionSwitcher';

const US = { locale: 'en-US', label: 'United States, English (USD)' };
const DE = { locale: 'de-DE', label: 'Germany, German (EUR)' };

describe('switching-region-or-language: the switcher is shown only when there is a choice', () => {
  it('hidden with one valid region (v1) and with none', () => {
    const { rerender } = renderWithProviders(<RegionSwitcher regions={[US]} />);
    expect(screen.queryByRole('combobox')).toBeNull();
    rerender(<RegionSwitcher regions={[]} />);
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  it('shown with two valid regions: a labelled select with the current region selected', () => {
    renderWithProviders(<RegionSwitcher regions={[US, DE]} />);
    const select = screen.getByRole('combobox', { name: 'Region and language' });
    expect(select).toHaveValue('en-US');
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([US.label, DE.label]);
  });
});
