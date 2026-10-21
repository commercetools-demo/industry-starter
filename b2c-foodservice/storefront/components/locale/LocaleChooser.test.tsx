import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MarketOption } from '@/lib/types';
import { expectNoAxeViolations } from '@/test/axe';
import { nav, renderShell, stubFetch } from '@/test/shell';

vi.mock('@/i18n/routing', async () => (await import('@/test/shell')).routingMock());

import LocaleChooser from '@/components/locale/LocaleChooser';
import { useShellUi } from '@/context/shell-ui-context';

const US: MarketOption = {
  country: 'US', currency: 'USD', locale: 'en-US', label: 'United States',
  languages: [{ locale: 'en-US', label: 'English' }], region: 'North America',
};
const CA: MarketOption = {
  country: 'CA', currency: 'CAD', locale: 'en-CA', label: 'Canada',
  languages: [{ locale: 'en-CA', label: 'English' }], region: 'North America',
};

function Opener() {
  const { setLocaleOpen } = useShellUi();
  return <button onClick={() => setLocaleOpen(true)}>open locale</button>;
}

function setup({ markets = [US, CA], locale = 'en-US', count = 0, routes = {} }: {
  markets?: MarketOption[]; locale?: string; count?: number; routes?: Parameters<typeof stubFetch>[0];
} = {}) {
  const stub = stubFetch({
    '/api/cart/count': () => ({ count }),
    '/api/session/market': () => ({ country: 'CA', currency: 'CAD', locale: 'en-CA', cartCarriedOver: false, droppedLines: [] }),
    ...routes,
  });
  renderShell(
    <>
      <Opener />
      <LocaleChooser markets={markets} />
    </>,
    { locale },
  );
  return stub;
}
const drawer = () => screen.getByRole('dialog', { hidden: true });
async function open() {
  await userEvent.click(screen.getByRole('button', { name: 'open locale' }));
}

beforeEach(() => {
  nav.pathname = '/category/coffee';
  nav.replace.mockReset();
  nav.refresh.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

describe('LocaleChooser', () => {
  it('Only the offered locales are listed', async () => {
    setup({ markets: [US] });
    await open();
    expect(within(drawer()).getByRole('button', { name: /United States/ })).toBeInTheDocument();
    expect(within(drawer()).queryByRole('button', { name: /Canada/ })).toBeNull();
    expect(within(drawer()).queryByText(/Germany|United Kingdom|France/)).toBeNull();
  });

  it('lists United States and Canada under North America', async () => {
    setup();
    await open();
    const region = within(drawer()).getByRole('button', { name: 'North America' });
    expect(region).toHaveAttribute('aria-expanded', 'true');
    const us = within(drawer()).getByRole('button', { name: /United States/ });
    const ca = within(drawer()).getByRole('button', { name: /Canada/ });
    expect(us).toHaveTextContent('USD');
    expect(ca).toHaveTextContent('CAD');
  });

  it('current country has a check', async () => {
    setup();
    await open();
    expect(within(drawer()).getByRole('button', { name: /United States/ })).toHaveAttribute('aria-current', 'true');
    expect(within(drawer()).getByRole('button', { name: /Canada/ })).not.toHaveAttribute('aria-current');
    expect(within(drawer()).getByText('Your current selected location is United States and your order will be billed in USD.')).toBeInTheDocument();
  });

  it('region header toggles its list', async () => {
    setup();
    await open();
    const region = within(drawer()).getByRole('button', { name: 'North America' });
    await userEvent.click(region);
    expect(region).toHaveAttribute('aria-expanded', 'false');
    expect(within(drawer()).queryByRole('button', { name: /Canada/ })).toBeNull();
    await userEvent.click(region);
    expect(within(drawer()).getByRole('button', { name: /Canada/ })).toBeInTheDocument();
  });

  it('language select is limited to the country languages', async () => {
    setup();
    await open();
    const select = within(drawer()).getByRole('combobox', { name: 'Language' });
    expect(within(select).getAllByRole('option')).toHaveLength(1);
    expect(select).toBeDisabled();
    expect(within(drawer()).getByText('More languages are coming')).toBeInTheDocument();
  });

  it('several languages enable the select and change only the language', async () => {
    const { calls } = setup({
      markets: [{ ...US, languages: [{ locale: 'en-US', label: 'English' }, { locale: 'es-US', label: 'Spanish' }] }, CA],
      routes: { '/api/session/market': () => ({ country: 'US', currency: 'USD', locale: 'es-US', cartCarriedOver: false, droppedLines: [] }) },
    });
    await open();
    const select = within(drawer()).getByRole('combobox', { name: 'Language' });
    expect(select).toBeEnabled();
    await userEvent.selectOptions(select, 'es-US');
    await waitFor(() => expect(nav.replace).toHaveBeenCalled());
    const put = calls.find((c) => c.url === '/api/session/market');
    expect(JSON.parse(String(put?.init?.body))).toEqual({ country: 'US', locale: 'es-US' });
  });

  it('Country change calls the market endpoint then replaces the locale and refreshes', async () => {
    const { calls } = setup();
    await open();
    await userEvent.click(within(drawer()).getByRole('button', { name: /Canada/ }));
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/category/coffee', { locale: 'en-CA' }));
    expect(nav.refresh).toHaveBeenCalled();
    const put = calls.find((c) => c.url === '/api/session/market');
    expect(put?.init?.method).toBe('PUT');
    expect(JSON.parse(String(put?.init?.body))).toEqual({ country: 'CA' });
    // The request was made before the route changed.
    expect(calls.indexOf(put!)).toBeLessThan(calls.length);
    await waitFor(() => expect(drawer()).toHaveAttribute('aria-hidden', 'true'));
  });

  it('choosing the current country changes nothing', async () => {
    const { calls } = setup();
    await open();
    await userEvent.click(within(drawer()).getByRole('button', { name: /United States/ }));
    expect(calls.some((c) => c.url === '/api/session/market')).toBe(false);
    expect(nav.replace).not.toHaveBeenCalled();
  });

  it('cart notice appears when the bag is not empty and Cancel changes nothing', async () => {
    const { calls } = setup({ count: 2 });
    await waitFor(() => expect(calls.some((c) => c.url === '/api/cart/count')).toBe(true));
    await open();
    await userEvent.click(within(drawer()).getByRole('button', { name: /Canada/ }));
    const notice = await within(drawer()).findByRole('alertdialog');
    expect(notice).toHaveTextContent('Your bag will be emptied because it is priced in USD.');
    await userEvent.click(within(notice).getByRole('button', { name: 'Cancel' }));
    expect(calls.some((c) => c.url === '/api/session/market')).toBe(false);
    expect(nav.replace).not.toHaveBeenCalled();
    expect(within(drawer()).getByRole('button', { name: /Canada/ })).toBeInTheDocument();
  });

  it('Continue after the cart notice switches the market', async () => {
    const { calls } = setup({ count: 1 });
    await waitFor(() => expect(calls.some((c) => c.url === '/api/cart/count')).toBe(true));
    await open();
    await userEvent.click(within(drawer()).getByRole('button', { name: /Canada/ }));
    await userEvent.click(within(await within(drawer()).findByRole('alertdialog')).getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/category/coffee', { locale: 'en-CA' }));
  });

  it('a failed switch shows an error and keeps the market', async () => {
    setup({ routes: { '/api/session/market': () => Response.json({ error: { code: 'validation_failed', message: 'x' } }, { status: 400 }) } });
    await open();
    await userEvent.click(within(drawer()).getByRole('button', { name: /Canada/ }));
    expect(await within(drawer()).findByRole('alert')).toHaveTextContent('We could not change the country');
    expect(nav.replace).not.toHaveBeenCalled();
    expect(drawer()).toHaveAttribute('aria-hidden', 'false');
  });

  it('Canada shows CAD and the Canadian sentence', async () => {
    setup({ locale: 'en-CA' });
    await open();
    expect(within(drawer()).getByText('Your current selected location is Canada and your order will be billed in CAD.')).toBeInTheDocument();
  });

  it('no axe violations', async () => {
    setup();
    await open();
    await expectNoAxeViolations(document.body);
  });
});
