import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseListingParams } from '@/lib/search/params';
import type { FacetGroup } from '@/lib/types';
import { nav, renderShell, stubFetch } from '@/test/shell';

vi.mock('@/i18n/routing', async () => (await import('@/test/shell')).routingMock());

import FilterSheet from '@/components/listing/FilterSheet';

const groups: FacetGroup[] = [
  {
    name: 'roast', label: 'Roast', control: 'checkbox', selectedCount: 0,
    options: [
      { value: 'dark', label: 'Dark', count: 4, selected: false },
      { value: 'light', label: 'Light', count: 3, selected: false },
    ],
  },
];

function setup(total = 39) {
  const params = parseListingParams({}, 'shop');
  const { calls } = stubFetch({ '/api/search': () => ({ total: 7 }) });
  renderShell(<FilterSheet groups={groups} params={params} scope="shop" basePath="/shop" apiScope="shop" total={total} activeCount={0} />);
  return calls;
}

beforeEach(() => nav.push.mockReset());
afterEach(() => vi.unstubAllGlobals());

const openSheet = () => userEvent.click(screen.getByRole('button', { name: /Filters/ }));

describe('FilterSheet', () => {
  it('draft selections do not navigate', async () => {
    setup();
    await openSheet();
    await userEvent.click(screen.getByRole('checkbox', { name: /Light/ }));
    expect(screen.getByRole('checkbox', { name: /Light/ })).toHaveAttribute('aria-checked', 'true');
    expect(nav.push).not.toHaveBeenCalled();
  });

  it('Show n results updates from the count call (countOnly, scope, locale and draft filters)', async () => {
    const calls = setup();
    await openSheet();
    expect(screen.getByRole('button', { name: 'Show 39 results' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('checkbox', { name: /Light/ }));
    expect(await screen.findByRole('button', { name: 'Show 7 results' })).toBeInTheDocument();
    const url = new URL(calls.find((c) => c.url.startsWith('/api/search'))!.url, 'http://x');
    expect(url.searchParams.get('countOnly')).toBe('1');
    expect(url.searchParams.get('scope')).toBe('shop');
    expect(url.searchParams.get('locale')).toBe('en-US');
    expect(url.searchParams.get('f_roast')).toBe('light');
  });

  it('Apply closes the sheet and navigates once', async () => {
    setup();
    await openSheet();
    await userEvent.click(screen.getByRole('checkbox', { name: /Dark/ }));
    await userEvent.click(screen.getByRole('checkbox', { name: /Light/ }));
    await userEvent.click(screen.getByRole('button', { name: /^Show \d+ results$/ }));
    expect(nav.push).toHaveBeenCalledTimes(1);
    expect(nav.push).toHaveBeenCalledWith('/shop?f_roast=dark%2Clight');
    await waitFor(() => expect(screen.getByRole('dialog', { hidden: true })).toHaveAttribute('aria-hidden', 'true'));
  });

  it('close discards the draft', async () => {
    setup();
    await openSheet();
    await userEvent.click(screen.getByRole('checkbox', { name: /Light/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Close panel' }));
    expect(nav.push).not.toHaveBeenCalled();
    await openSheet();
    expect(screen.getByRole('checkbox', { name: /Light/ })).toHaveAttribute('aria-checked', 'false');
  });

  it('the Filters button shows the active count', () => {
    stubFetch({});
    renderShell(<FilterSheet groups={groups} params={parseListingParams({ f_roast: 'dark' }, 'shop')} scope="shop" basePath="/shop" apiScope="shop" total={4} activeCount={1} />);
    expect(screen.getByRole('button', { name: /Filters/ })).toHaveTextContent('1');
  });
});
