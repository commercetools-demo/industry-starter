import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { FacetGroup as Group, FacetOption } from '@/lib/types';
import { expectNoAxeViolations } from '@/test/axe';
import { renderShell } from '@/test/shell';

vi.mock('@/i18n/routing', async () => (await import('@/test/shell')).routingMock());

import FacetGroup from '@/components/listing/FacetGroup';
import FilterSidebar from '@/components/listing/FilterSidebar';

const opt = (value: string, count: number, selected = false, extra: Partial<FacetOption> = {}): FacetOption => ({
  value, label: value[0]!.toUpperCase() + value.slice(1), count, selected, href: `/shop?f_roast=${value}`, ...extra,
});
const roast: Group = { name: 'roast', label: 'Roast', control: 'checkbox', selectedCount: 1, options: [opt('dark', 5, true), opt('light', 2), opt('medium', 0)] };

describe('FilterSidebar and FacetGroup', () => {
  it('Faceted counts: rows show counts and links carry the new URL', () => {
    renderShell(<FilterSidebar groups={[roast]} />);
    const dark = screen.getByRole('checkbox', { name: /Dark/ });
    expect(dark).toHaveAttribute('aria-checked', 'true');
    expect(dark).toHaveTextContent('5');
    expect(screen.getByRole('checkbox', { name: /Light/ })).toHaveAttribute('href', '/shop?f_roast=light');
  });
  it('Dead end avoided disables a zero count option', () => {
    renderShell(<FacetGroup group={roast} />);
    const medium = screen.getByRole('checkbox', { name: /Medium/ });
    expect(medium).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: /Dark/ })).not.toBeDisabled();
  });
  it('selected count badge', () => {
    renderShell(<FacetGroup group={roast} />);
    expect(screen.getByRole('button', { name: /Roast/ })).toHaveTextContent('1');
  });
  it('group collapses and expands', async () => {
    renderShell(<FacetGroup group={roast} />);
    const toggle = screen.getByRole('button', { name: /Roast/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('checkbox', { name: /Dark/ })).toBeNull();
  });
  it('radio rows use role radio and the selected one links to the cleared URL', () => {
    const rating: Group = {
      name: 'rating', label: 'Rating', control: 'radio', selectedCount: 1,
      options: [opt('4.5', 3, true, { label: '4.5 and up', href: '/shop' }), opt('4.0', 5, false, { label: '4.0 and up', href: '/shop?f_rating=4.0' })],
    };
    renderShell(<FacetGroup group={rating} />);
    expect(screen.getAllByRole('radio')).toHaveLength(2);
    expect(screen.getByRole('radio', { name: /4\.5 and up/ })).toHaveAttribute('href', '/shop');
  });
  it('colour dots and button grid render', () => {
    const colour: Group = { name: 'colour', label: 'Colour', control: 'colour', selectedCount: 0, options: [opt('red', 2, false, { colour: 'red' })] };
    const intensity: Group = {
      name: 'intensity', label: 'Intensity', control: 'grid', selectedCount: 0,
      options: [opt('8', 4), opt('9', 0)],
    };
    const { container } = renderShell(<><FacetGroup group={colour} /><FacetGroup group={intensity} /></>);
    const dot = container.querySelector('[data-value="red"] span[aria-hidden]') as HTMLElement;
    expect(dot.getAttribute('style')).toContain('--swatch-red');
    const grid = container.querySelector('#' + CSS.escape(container.querySelectorAll('fieldset')[1]!.querySelector('[id]')!.id))!;
    expect(grid.className).toContain('grid-cols-4');
    expect(within(grid as HTMLElement).getByRole('checkbox', { name: '9' })).toBeDisabled();
  });
  it('Show all n above six options', async () => {
    const many: Group = {
      name: 'category', label: 'Category', control: 'checkbox', selectedCount: 0,
      options: Array.from({ length: 8 }, (_, i) => opt(`cat${i}`, i + 1)),
    };
    renderShell(<FacetGroup group={many} />);
    expect(screen.getAllByRole('checkbox')).toHaveLength(6);
    await userEvent.click(screen.getByRole('button', { name: 'Show all 8' }));
    expect(screen.getAllByRole('checkbox')).toHaveLength(8);
    expect(screen.getByRole('button', { name: 'Show less' })).toBeInTheDocument();
  });
  it('draft mode calls onToggle instead of linking', async () => {
    const onToggle = vi.fn();
    renderShell(<FacetGroup group={roast} onToggle={onToggle} />);
    await userEvent.click(screen.getByRole('checkbox', { name: /Light/ }));
    expect(onToggle).toHaveBeenCalledWith('roast', 'light');
    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });
  it('no axe violations', async () => {
    const { container } = renderShell(<FilterSidebar groups={[roast]} />);
    await expectNoAxeViolations(container);
  });
});
