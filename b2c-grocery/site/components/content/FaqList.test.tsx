import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/utils';
import type { FaqGroup } from '@/lib/faq';
import { FaqList } from './FaqList';

const groups: FaqGroup[] = [
  { topic: 'Ordering', items: [{ q: 'How?', a: 'Add to bag.\n\nThen pay.' }, { q: 'Why?', a: 'Because.' }] },
  { topic: 'Delivery', items: [{ q: 'Where?', a: 'Here.' }] },
];

describe('FaqList', () => {
  it('grouped by topic: a heading per topic, a button per question', () => {
    renderWithProviders(<FaqList groups={groups} />);
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(['Ordering', 'Delivery']);
    expect(screen.getAllByRole('button')).toHaveLength(3);
  });

  it('Toggle answer: aria-expanded becomes true and the answer shows', async () => {
    renderWithProviders(<FaqList groups={groups} />);
    const button = screen.getByRole('button', { name: 'How?' });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Add to bag.')).not.toBeVisible();
    await userEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Add to bag.')).toBeVisible();
    expect(screen.getByText('Then pay.')).toBeVisible();
    await userEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });

  it('one open at a time', async () => {
    renderWithProviders(<FaqList groups={groups} />);
    const first = screen.getByRole('button', { name: 'How?' });
    const second = screen.getByRole('button', { name: 'Where?' });
    await userEvent.click(first);
    await userEvent.click(second);
    expect(first).toHaveAttribute('aria-expanded', 'false');
    expect(second).toHaveAttribute('aria-expanded', 'true');
  });

  it('ids wired: aria-controls points at the answer region labelled by the button', async () => {
    renderWithProviders(<FaqList groups={groups} />);
    const button = screen.getByRole('button', { name: 'Why?' });
    await userEvent.click(button);
    const region = screen.getByRole('region', { name: 'Why?' });
    expect(button.getAttribute('aria-controls')).toBe(region.id);
    expect(region).toHaveTextContent('Because.');
  });
});
