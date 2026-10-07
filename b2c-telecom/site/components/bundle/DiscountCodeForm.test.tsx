import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CartError } from '@/hooks/useCart';
import { renderWithProviders } from '@/test/utils';
import { DiscountCodeForm } from './DiscountCodeForm';

const rejected = (reason: string) => new CartError('DISCOUNT_CODE_REJECTED', 'VALIDATION', 'x', { reason, code: 'X' }, 422);

describe('DiscountCodeForm', () => {
  it('applies the typed code and clears the field', async () => {
    const onApply = vi.fn().mockResolvedValue(null);
    renderWithProviders(<DiscountCodeForm codes={[]} onApply={onApply} onRemove={vi.fn()} />);
    await userEvent.type(screen.getByLabelText('Discount code'), 'MALVA-CABLE5');
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(onApply).toHaveBeenCalledWith('MALVA-CABLE5');
    await waitFor(() => expect(screen.getByLabelText('Discount code')).toHaveValue(''));
  });

  it('a refused code shows the reason under the field and the field keeps the text', async () => {
    renderWithProviders(<DiscountCodeForm codes={[]} onApply={vi.fn().mockRejectedValue(rejected('unknown-code'))} onRemove={vi.fn()} />);
    await userEvent.type(screen.getByLabelText('Discount code'), 'NOPE-CODE');
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(await screen.findByText('We could not find that code.')).toBeInTheDocument();
    expect(screen.getByLabelText('Discount code')).toHaveValue('NOPE-CODE');
  });

  it('every reason has copy in both locales', async () => {
    for (const locale of ['en-US', 'de-DE'] as const) {
      for (const reason of ['not-active', 'not-valid', 'not-applicable', 'max-reached', 'stopped']) {
        const { unmount } = renderWithProviders(<DiscountCodeForm codes={[]} onApply={vi.fn().mockRejectedValue(rejected(reason))} onRemove={vi.fn()} />, { locale });
        await userEvent.type(screen.getByRole('textbox'), 'A');
        await userEvent.click(screen.getByRole('button'));
        const alert = await screen.findByRole('alert');
        expect(alert.textContent).not.toMatch(/bundle\.code/);
        unmount();
      }
    }
  });

  it('an applied code is a removable tag; one that no longer applies says why', async () => {
    const onRemove = vi.fn().mockResolvedValue(null);
    renderWithProviders(
      <DiscountCodeForm
        codes={[
          { code: 'MALVA-CABLE5', state: 'not-applicable', reason: 'not-applicable' },
          { code: 'WELCOME10', state: 'applied', reason: null },
        ]}
        onApply={vi.fn()}
        onRemove={onRemove}
      />,
    );
    expect(screen.getByText('Code MALVA-CABLE5 no longer applies: This code does not apply to what is in your bundle.')).toBeInTheDocument();
    expect(screen.getByText('Code WELCOME10 applied')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Remove code: MALVA-CABLE5' }));
    expect(onRemove).toHaveBeenCalledWith('MALVA-CABLE5');
  });

  it('an empty field sends nothing', async () => {
    const onApply = vi.fn();
    renderWithProviders(<DiscountCodeForm codes={[]} onApply={onApply} onRemove={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(onApply).not.toHaveBeenCalled();
  });
});
