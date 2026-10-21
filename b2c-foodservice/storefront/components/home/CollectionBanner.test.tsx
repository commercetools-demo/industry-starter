import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { STORE } from '@/components/home/home-fixtures';
import { expectNoAxeViolations } from '@/test/axe';
import { renderShell } from '@/test/shell';

const open = vi.hoisted(() => vi.fn());
vi.mock('@/i18n/routing', async () => (await import('@/test/shell')).routingMock());
vi.mock('@/hooks/useCollectionStore', () => ({ useCollectionStore: () => ({ open }) }));

import CollectionBanner from '@/components/home/CollectionBanner';

beforeEach(() => open.mockReset());

describe('CollectionBanner', () => {
  it('Store named: headline names the chosen store and its minutes', () => {
    renderShell(<CollectionBanner store={STORE} />);
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Ready in 23 minutes at Malva Brooklyn.');
    expect(screen.getByRole('button', { name: 'Change store' })).toBeInTheDocument();
  });

  it('no store chosen asks to choose one', async () => {
    renderShell(<CollectionBanner store={null} />);
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Collect in store, ready in minutes.');
    await userEvent.click(screen.getByRole('button', { name: 'Choose a store' }));
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('Shop collect-eligible links to the collect filtered listing', () => {
    renderShell(<CollectionBanner store={STORE} />);
    expect(screen.getByRole('link', { name: 'Shop collect-eligible' })).toHaveAttribute('href', '/shop?avail=1');
  });

  it('without a store Shop collect-eligible opens the picker', async () => {
    renderShell(<CollectionBanner store={null} />);
    await userEvent.click(screen.getByRole('button', { name: 'Shop collect-eligible' }));
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('banner never renders a name or cart count', () => {
    const { container } = renderShell(<CollectionBanner store={STORE} />);
    expect(container.textContent).not.toMatch(/cart|sign in|welcome|@/i);
  });

  it('has no accessibility violations', async () => {
    const { container } = renderShell(<CollectionBanner store={STORE} />);
    await expectNoAxeViolations(container);
  });
});
