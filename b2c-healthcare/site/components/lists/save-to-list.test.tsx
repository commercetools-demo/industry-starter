import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RxResultCard } from '@/components/prescriptions/RxResultCard';
import type { RxLineView, RxView } from '@/lib/types';
import { renderWithProviders, screen } from '@/test/utils';

const usd = (centAmount: number) => ({ centAmount, currencyCode: 'USD', fractionDigits: 2 });
const row = (lineRef: string, name: string, over: Partial<RxLineView> = {}): RxLineView => ({ lineRef, name, sig: '1 daily', qty: 30, price: usd(1000), status: 'ok', selectable: true, minShelfLifeMonths: null, ...over });
const view = (lines: RxLineView[]): RxView => ({ number: 'RX-77102', prescriber: 'Dr. M', issuedAt: '2026-09-24', refillsLeft: 3, patientName: 'Sam Rivera', lines });

describe('saved-lists: Save to My medicines on the prescription card', () => {
  it('saves the selected rows and links to the list; the number is passed to the hook, never put in a link', async () => {
    const onSave = vi.fn().mockResolvedValue({ saved: 1, alreadySaved: 0 });
    renderWithProviders(<RxResultCard view={view([row('a', 'Atorvastatin'), row('b', 'Lisinopril')])} onAdd={vi.fn()} onSave={onSave} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('checkbox', { name: /Lisinopril/ }));
    await user.click(screen.getByRole('button', { name: 'Save to My medicines' }));
    expect(onSave).toHaveBeenCalledWith('RX-77102', ['a']);
    expect(await screen.findByText(/Saved to My medicines/)).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'View My medicines' });
    expect(link).toHaveAttribute('href', '/en-US/account/lists');
    expect(link.getAttribute('href')).not.toContain('77102');
  });

  it('with no row selected (for example every row is blocked) it saves all rows, so a medicine that cannot be ordered today can still be saved', async () => {
    const onSave = vi.fn().mockResolvedValue({ saved: 2, alreadySaved: 0 });
    renderWithProviders(<RxResultCard view={view([row('a', 'A', { selectable: false, status: 'NO_REFILLS' }), row('b', 'B', { selectable: false, status: 'EXPIRED' })])} onAdd={vi.fn()} onSave={onSave} />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Save to My medicines' }));
    expect(onSave).toHaveBeenCalledWith('RX-77102', ['a', 'b']);
  });

  it('already saved and failed outcomes are worded; no button without the hook', async () => {
    const onSave = vi.fn().mockResolvedValueOnce({ saved: 0, alreadySaved: 1 }).mockRejectedValueOnce(new Error('x'));
    const { unmount } = renderWithProviders(<RxResultCard view={view([row('a', 'A')])} onAdd={vi.fn()} onSave={onSave} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Save to My medicines' }));
    expect(await screen.findByText(/Already in My medicines/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save to My medicines' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('We could not save these medications.');
    unmount();
    renderWithProviders(<RxResultCard view={view([row('a', 'A')])} onAdd={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Save to My medicines' })).toBeNull();
  });
});
