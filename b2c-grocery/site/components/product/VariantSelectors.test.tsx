import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Selector } from '@/lib/config/variant-config';
import { VARIANT_CONFIG } from '@/lib/config/variant-config';
import { renderWithProviders } from '@/test/utils';
import { VariantSelectors } from './VariantSelectors';

const replace = vi.fn();
vi.mock('@/i18n/routing', async (orig) => ({
  ...(await orig<typeof import('@/i18n/routing')>()),
  useRouter: () => ({ replace, push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/p/bananas',
}));

beforeEach(() => vi.clearAllMocks());

const packs: Selector = {
  name: 'packLabel',
  label: 'Pack label',
  kind: 'segmented',
  selected: '500 g',
  options: [
    { value: '500 g', label: '500 g', sku: 'B-500G', disabled: false },
    { value: '1 kg', label: '1 kg', sku: 'B-1KG', disabled: false },
    { value: '2 kg', label: '2 kg', sku: 'B-2KG', disabled: true },
  ],
};

describe('VariantSelectors', () => {
  it('choosing "1 kg" replaces the URL with ?sku= and does not scroll', async () => {
    renderWithProviders(<VariantSelectors selectors={[packs]} />);
    await userEvent.click(screen.getByLabelText('1 kg'));
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith('/p/bananas?sku=B-1KG', { scroll: false });
  });

  it('the selected option is marked and uses the translated group label', () => {
    renderWithProviders(<VariantSelectors selectors={[packs]} />);
    expect(screen.getByRole('radiogroup', { name: 'Pack size' })).toBeInTheDocument();
    expect(screen.getByLabelText('500 g')).toBeChecked();
    expect(screen.getByLabelText('1 kg')).not.toBeChecked();
  });

  it('arrow keys move the selection on the segmented control', async () => {
    renderWithProviders(<VariantSelectors selectors={[packs]} />);
    screen.getByLabelText('500 g').focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(replace).toHaveBeenCalledWith('/p/bananas?sku=B-1KG', { scroll: false });
  });

  it('a disabled option is not clickable', async () => {
    renderWithProviders(<VariantSelectors selectors={[packs]} />);
    const disabled = screen.getByLabelText('2 kg');
    expect(disabled).toBeDisabled();
    await userEvent.click(disabled);
    expect(replace).not.toHaveBeenCalled();
  });

  it('clicking the selected option does nothing', async () => {
    renderWithProviders(<VariantSelectors selectors={[packs]} />);
    await userEvent.click(screen.getByLabelText('500 g'));
    expect(replace).not.toHaveBeenCalled();
  });

  it('swatch kind renders colored circles from the config and shows the selected name', async () => {
    VARIANT_CONFIG.swatch.finish = { ripe: 'rgb(245, 208, 0)', green: 'rgb(139, 195, 74)' };
    try {
      const swatches: Selector = {
        name: 'finish',
        label: 'Finish',
        kind: 'swatch',
        selected: 'ripe',
        options: [
          { value: 'ripe', label: 'ripe', sku: 'A', disabled: false },
          { value: 'green', label: 'green', sku: 'B', disabled: false },
        ],
      };
      const { container } = renderWithProviders(<VariantSelectors selectors={[swatches]} />);
      expect(screen.getByText('ripe', { selector: 'span' })).toBeInTheDocument();
      expect(container.querySelectorAll('span[style*="background-color"]')).toHaveLength(2);
      await userEvent.click(screen.getByLabelText('green'));
      expect(replace).toHaveBeenCalledWith('/p/bananas?sku=B', { scroll: false });
    } finally {
      delete VARIANT_CONFIG.swatch.finish;
    }
  });

  it('radio kind renders radios', async () => {
    const fitting: Selector = {
      name: 'fitting',
      label: 'Fitting',
      kind: 'radio',
      selected: 'plug-in',
      options: [
        { value: 'plug-in', label: 'Plug-in', sku: 'A', disabled: false },
        { value: 'hardwired', label: 'Hardwired', sku: 'B', disabled: false },
      ],
    };
    renderWithProviders(<VariantSelectors selectors={[fitting]} />);
    expect(screen.getByRole('radiogroup', { name: 'Fitting' })).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText('Hardwired'));
    expect(replace).toHaveBeenCalledWith('/p/bananas?sku=B', { scroll: false });
  });

  it('no selectors: renders nothing', () => {
    const { container } = renderWithProviders(<VariantSelectors selectors={[]} />);
    expect(container.querySelector('[data-selector]')).toBeNull();
  });
});
