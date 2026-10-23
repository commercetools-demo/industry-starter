import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithIntl } from '@/test/render';
import Steps from './Steps';

const STEPS = [
  { key: 'bag', label: 'Bag' },
  { key: 'details', label: 'Details' },
  { key: 'pay', label: 'Payment' },
];

describe('Steps', () => {
  it('Steps marks done, active and pending', () => {
    renderWithIntl(<Steps steps={STEPS} current="details" />);
    const items = screen.getAllByRole('listitem').filter((li) => li.hasAttribute('data-state'));
    expect(items.map((li) => li.getAttribute('data-state'))).toEqual(['done', 'active', 'pending']);
    expect(items[0].textContent).toContain('completed');
    expect(items[1].textContent).toContain('current step');
    expect(items[2].textContent).toBe('3Payment');
  });

  it('Steps sets aria-current on the active step', () => {
    renderWithIntl(<Steps steps={STEPS} current="pay" />);
    const active = document.querySelector('[aria-current="step"]') as HTMLElement;
    expect(active).toHaveTextContent('Payment');
    expect(document.querySelectorAll('[aria-current]')).toHaveLength(1);
  });

  it('Steps done circle shows a check icon', () => {
    renderWithIntl(<Steps steps={STEPS} current="pay" />);
    const done = document.querySelector('[data-state="done"]') as HTMLElement;
    expect(done.querySelector('svg')).not.toBeNull();
    expect(within(done).queryByText('1')).toBeNull();
    const circle = done.querySelector('span') as HTMLElement;
    expect(circle.className).toContain('bg-teal-strong');
    const active = document.querySelector('[data-state="active"]') as HTMLElement;
    expect((active.querySelector('span') as HTMLElement).className).toContain('bg-ink');
  });

  it('Steps are announced in the localized wording', () => {
    renderWithIntl(<Steps steps={STEPS} current="details" />, { locale: 'en-CA' });
    expect(screen.getByText('completed')).toBeInTheDocument();
  });
});
