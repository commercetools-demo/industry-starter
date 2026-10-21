'use client';

import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import Button from '@/components/ui/Button';
import Drawer from '@/components/ui/Drawer';
import { Select } from '@/components/ui/Field';
import Icon from '@/components/ui/Icon';
import { useShellUi } from '@/context/shell-ui-context';
import { useCartCount } from '@/hooks/useCartCount';
import { useMarket } from '@/hooks/useMarket';
import { cn } from '@/lib/cn';
import { CART_CARRY_OVER_ENABLED } from '@/lib/shop-config';
import type { MarketOption } from '@/lib/types';

const REGION_KEYS = { 'North America': 'northAmerica' } as const;

/**
 * Right drawer for country and language. `markets` are the options the project supports (server read, so only offered
 * markets appear). Choosing a country calls PUT /api/session/market, then replaces the route locale and refreshes.
 * A bag in another currency asks first; in F the bag is then emptied (CART_CARRY_OVER_ENABLED is false until I-12).
 */
export default function LocaleChooser({ markets }: { markets: MarketOption[] }) {
  const t = useTranslations('locale');
  const { localeOpen, setLocaleOpen } = useShellUi();
  const { country, currency, locale, switchCountry, switchLanguage } = useMarket();
  const cartCount = useCartCount();
  const languageId = useId();

  const regions = [...new Set(markets.map((m) => m.region))];
  const currentRegion = markets.find((m) => m.country === country)?.region ?? regions[0];
  const [openRegion, setOpenRegion] = useState<string | undefined>(currentRegion);
  const [pending, setPending] = useState<MarketOption | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  const current = markets.find((m) => m.country === country);
  const close = () => {
    setLocaleOpen(false);
    setPending(null);
    setFailed(false);
  };

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setFailed(false);
    try {
      await action();
      close();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  const pick = (market: MarketOption) => {
    if (market.country === country) {
      close();
      return;
    }
    // A bag priced in another currency is resolved explicitly, never silently.
    if (cartCount > 0 && market.currency !== currency) {
      setPending(market);
      return;
    }
    void run(() => switchCountry(market.country));
  };

  const countryName = t(`country.${country}`);
  const languages = current?.languages ?? [{ locale, label: t('english') }];

  return (
    <Drawer open={localeOpen} onClose={close} title={t('title')} width="wide">
      {pending ? (
        <div role="alertdialog" aria-labelledby={`${languageId}-notice`} className="py-4">
          <p id={`${languageId}-notice`} className="m-0 mb-5 text-[15px]">
            {t(CART_CARRY_OVER_ENABLED ? 'cartNotice' : 'cartResetNotice', {
              oldCurrency: currency,
              newCurrency: pending.currency,
            })}
          </p>
          <div className="flex gap-3">
            <Button type="button" variant="accent" loading={busy} onClick={() => void run(() => switchCountry(pending.country))}>
              {t('continue')}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setPending(null)}>
              {t('cancel')}
            </Button>
          </div>
        </div>
      ) : (
        <div className="py-4">
          <div className="flex items-center gap-3">
            <Icon name="globe" size={22} />
            <h3 className="m-0 font-display text-[20px] font-bold">
              {t('heading', { country: countryName, currency })}
            </h3>
          </div>
          <p className="mb-5 mt-2 text-[14px] text-ink-2">{t('billing', { country: countryName, currency })}</p>

          <label htmlFor={`${languageId}-lang`} className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">
            {t('language')}
          </label>
          <div className="relative mb-1.5">
            <Select
              id={`${languageId}-lang`}
              value={locale}
              disabled={languages.length < 2 || busy}
              aria-describedby={languages.length < 2 ? `${languageId}-hint` : undefined}
              onChange={(e) => void run(() => switchLanguage(e.target.value))}
              className="appearance-none pr-10 text-[16px]"
            >
              {languages.map((l) => (
                <option key={l.locale} value={l.locale}>
                  {l.label}
                </option>
              ))}
            </Select>
            <Icon name="chevD" size={16} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-ink-3" />
          </div>
          {languages.length < 2 ? (
            <p id={`${languageId}-hint`} className="m-0 text-[12.5px] text-ink-3">
              {t('languageHint')}
            </p>
          ) : null}

          <h3 className="mb-3 mt-8 font-display text-[16px] font-bold">{t('chooseLocation')}</h3>
          <div className="border-t border-line">
            {regions.map((region) => {
              const isOpen = openRegion === region;
              const panelId = `${languageId}-region-${REGION_KEYS[region]}`;
              return (
                <div key={region} className="border-b border-line">
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() => setOpenRegion(isOpen ? undefined : region)}
                    className="flex w-full items-center justify-between py-4 text-left font-display text-[15px] font-semibold"
                  >
                    {t(`region.${REGION_KEYS[region]}`)}
                    <Icon name={isOpen ? 'minus' : 'plus'} size={18} />
                  </button>
                  <ul
                    id={panelId}
                    hidden={!isOpen}
                    className="m-0 grid list-none grid-cols-2 gap-x-6 gap-y-1 p-0 pb-4 max-mobile:grid-cols-1"
                  >
                    {markets
                      .filter((m) => m.region === region)
                      .map((m) => {
                        const isCurrent = m.country === country;
                        return (
                          <li key={m.country}>
                            <button
                              type="button"
                              aria-current={isCurrent ? 'true' : undefined}
                              disabled={busy}
                              onClick={() => pick(m)}
                              className={cn(
                                'transition-state flex w-full items-center justify-between rounded-field px-3 py-3 text-left text-[15px] hover:bg-canvas-2',
                                isCurrent && 'font-semibold',
                              )}
                            >
                              <span>{t(`country.${m.country}`)}</span>
                              <span className="flex items-center gap-2 font-mono text-[13px] text-ink-2">
                                {m.currency}
                                {isCurrent ? <Icon name="check" size={16} className="text-accent" /> : null}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                  </ul>
                </div>
              );
            })}
          </div>
          {failed ? (
            <p role="alert" className="mt-4 text-[13px] font-medium text-danger-text">
              {t('switchError')}
            </p>
          ) : null}
        </div>
      )}
      {pending && failed ? (
        <p role="alert" className="mt-2 text-[13px] font-medium text-danger-text">
          {t('switchError')}
        </p>
      ) : null}
    </Drawer>
  );
}
