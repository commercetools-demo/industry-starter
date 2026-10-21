import { act, fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { unstable_serialize } from 'swr';
import { keyChannels } from '@/lib/cache-keys';
import type { Category } from '@/lib/types';
import { nav, renderShell, stubFetch } from '@/test/shell';

vi.mock('@/i18n/routing', async () => (await import('@/test/shell')).routingMock());

import PrimaryNav from '@/components/layout/PrimaryNav';

const cat = (key: string, slug: string, children: Category[] = [], imageUrl?: string): Category => ({
  id: key, key, name: slug, slug, children, ...(imageUrl ? { imageUrl } : {}),
});
const TREE: Category[] = [
  cat('mcf-cat-pods', 'pods', [cat('mcf-cat-pods-original', 'original'), cat('mcf-cat-pods-vertuo', 'vertuo')]),
  cat('mcf-cat-coffee', 'coffee', [], 'https://img.example.com/coffee.jpg'),
  cat('mcf-cat-machines', 'machines'),
  cat('mcf-cat-accessories', 'accessories'),
  cat('mcf-cat-gifts', 'gifts'),
];
const fallback = { [unstable_serialize(keyChannels('US'))]: { stores: [], selectedKey: null } };

function setup(tree = TREE) {
  stubFetch({});
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime, delay: null });
  renderShell(<PrimaryNav categories={tree} />, { fallback });
  return user;
}
const top = (name: string) => screen.getAllByRole('link', { name }).find((l) => l.hasAttribute('data-menu')) as HTMLElement;
const panel = (menu: string) => screen.getByTestId(`mega-${menu}`);

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  nav.pathname = '/';
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('MegaMenu', () => {
  it('panels are inert when closed', () => {
    setup();
    for (const menu of ['pods', 'coffee', 'machines', 'accessories']) {
      expect(panel(menu)).toHaveAttribute('aria-hidden', 'true');
      expect(panel(menu)).toHaveAttribute('inert');
    }
  });

  it('opens on hover and only one panel is open', async () => {
    const user = setup();
    await user.hover(top('Pods'));
    expect(panel('pods')).toHaveAttribute('aria-hidden', 'false');
    expect(panel('pods')).not.toHaveAttribute('inert');
    await user.hover(top('Coffee'));
    expect(panel('coffee')).toHaveAttribute('aria-hidden', 'false');
    expect(panel('pods')).toHaveAttribute('aria-hidden', 'true');
  });

  it('Pointer leaves closes after 130 ms', async () => {
    setup();
    const pods = top('Pods');
    fireEvent.mouseEnter(pods);
    fireEvent.mouseLeave(pods);
    act(() => vi.advanceTimersByTime(129));
    expect(panel('pods')).toHaveAttribute('aria-hidden', 'false');
    act(() => vi.advanceTimersByTime(2));
    expect(panel('pods')).toHaveAttribute('aria-hidden', 'true');
  });

  it('re-entering within 130 ms keeps it open', async () => {
    setup();
    const pods = top('Pods');
    fireEvent.mouseEnter(pods);
    fireEvent.mouseLeave(pods);
    act(() => vi.advanceTimersByTime(100));
    fireEvent.mouseEnter(panel('pods')); // pointer moved into the panel
    act(() => vi.advanceTimersByTime(500));
    expect(panel('pods')).toHaveAttribute('aria-hidden', 'false');
    fireEvent.mouseLeave(panel('pods'));
    act(() => vi.advanceTimersByTime(131));
    expect(panel('pods')).toHaveAttribute('aria-hidden', 'true');
  });

  it('Escape closes and returns focus to the link', async () => {
    const user = setup();
    const pods = top('Pods');
    pods.focus();
    await user.keyboard('{ArrowDown}');
    expect(panel('pods')).toHaveAttribute('aria-hidden', 'false');
    await user.keyboard('{Escape}');
    expect(panel('pods')).toHaveAttribute('aria-hidden', 'true');
    expect(pods).toHaveFocus();
  });

  it('ArrowDown on a link opens the panel and moves focus into it', async () => {
    const user = setup();
    top('Coffee').focus();
    await user.keyboard('{ArrowDown}');
    await act(async () => {
      vi.advanceTimersByTime(50);
    });
    expect(panel('coffee').contains(document.activeElement)).toBe(true);
  });

  it('outside pointer down closes', async () => {
    const user = setup();
    await user.hover(top('Pods'));
    fireEvent.pointerDown(document.body);
    expect(panel('pods')).toHaveAttribute('aria-hidden', 'true');
  });

  it('Link target opens listing with category and facet and closes the menu', async () => {
    const user = setup();
    await user.hover(top('Coffee'));
    const espresso = within(panel('coffee')).getByRole('link', { name: 'Espresso' });
    expect(espresso).toHaveAttribute('href', '/category/coffee?f_brew=espresso');
    // jsdom does not navigate; the click handler is what closes the menu.
    espresso.addEventListener('click', (e) => e.preventDefault());
    await user.click(espresso);
    expect(panel('coffee')).toHaveAttribute('aria-hidden', 'true');

    await user.hover(top('Pods'));
    const vertuo = within(panel('pods')).getByRole('link', { name: 'Vertuo' });
    expect(vertuo).toHaveAttribute('href', '/category/vertuo');
  });

  it('feature and intensity links carry the facet params', async () => {
    const user = setup();
    await user.hover(top('Pods'));
    const p = within(panel('pods'));
    expect(p.getByRole('link', { name: 'New in' })).toHaveAttribute('href', '/category/pods?f_collection=new');
    expect(p.getByRole('link', { name: 'Intensity 8 and up' })).toHaveAttribute('href', '/category/pods?f_intensity=8,9,10,11,12,13');
    expect(p.getByRole('link', { name: 'Decaf' })).toHaveAttribute('href', '/category/pods?f_decaf=true');
    expect(p.getByRole('link', { name: 'Sets' })).toHaveAttribute('href', '/category/gifts');
    expect(p.getByText('Compatible with Nespresso Original and Vertuo')).toBeInTheDocument();
  });

  it('missing category renders no link', () => {
    setup([cat('mcf-cat-pods', 'pods')]); // no original, vertuo, brew category
    const pods = within(panel('pods'));
    const hidden = { hidden: true };
    expect(pods.queryByRole('link', { name: 'Original', ...hidden })).toBeNull();
    expect(pods.queryByRole('link', { name: 'Vertuo', ...hidden })).toBeNull();
    expect(pods.queryByRole('link', { name: 'Espresso', ...hidden })).toBeNull();
    expect(pods.queryByRole('link', { name: 'Intensity 8 and up', ...hidden })).toBeInTheDocument();
    for (const link of pods.getAllByRole('link', { hidden: true })) {
      expect(link.getAttribute('href')).toMatch(/^\/category\//);
    }
  });

  it('the promo tile shows the category image or the category name', () => {
    setup();
    const img = panel('coffee').querySelector('img');
    expect(decodeURIComponent(img?.getAttribute('src') ?? '')).toContain('img.example.com/coffee.jpg');
    expect(within(panel('pods')).getByText('pods', { selector: 'span' })).toBeInTheDocument();
  });
});
