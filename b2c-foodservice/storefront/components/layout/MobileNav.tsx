'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import Icon from '@/components/ui/Icon';
import IconButton from '@/components/ui/IconButton';
import { useDialog } from '@/components/ui/use-dialog';
import { useShellUi } from '@/context/shell-ui-context';
import { useCollectionStore } from '@/hooks/useCollectionStore';
import { Link } from '@/i18n/routing';
import { cn } from '@/lib/cn';
import { buildListingHref } from '@/lib/nav/listing-href';
import { MEGA_CONFIG, PRIMARY_NAV, findCategoryByKey, resolveNavHref, type MenuId } from '@/lib/nav/mega-config';
import type { Category } from '@/lib/types';
import { marketForLocale } from '@/lib/utils';

const ROW = 'block w-full border-b border-line py-4 text-left font-display text-[24px] font-semibold text-ink';

/** Menu toggle (under 820px) and the full-screen slide-in panel with an accordion for sub-categories. */
export default function MobileNav({ categories }: { categories: Category[] }) {
  const t = useTranslations('shell');
  const tCommon = useTranslations('common');
  const tLocale = useTranslations('locale');
  const market = marketForLocale(useLocale());
  const { mobileNavOpen, setMobileNavOpen, setLocaleOpen } = useShellUi();
  const { stores, open: openStorePicker } = useCollectionStore();
  const [expanded, setExpanded] = useState<MenuId | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  useDialog({ open: mobileNavOpen, onClose: () => setMobileNavOpen(false), ref: panel });

  const close = () => setMobileNavOpen(false);
  const showStore = market.collection && stores.length > 0;

  return (
    <>
      <IconButton
        label={t('menu.open')}
        icon="menu"
        onClick={() => setMobileNavOpen(true)}
        aria-expanded={mobileNavOpen}
        className="-ml-2 mobile:hidden"
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={t('menu.title')}
        aria-hidden={!mobileNavOpen}
        inert={!mobileNavOpen}
        data-open={mobileNavOpen}
        tabIndex={-1}
        className={cn(
          'transition-drawer fixed inset-0 z-100 flex flex-col overflow-y-auto bg-canvas mobile:hidden',
          mobileNavOpen ? 'visible translate-x-0' : 'invisible -translate-x-full',
        )}
      >
        <div className="wrap flex h-[72px] shrink-0 items-center justify-between">
          {/* The close button comes first in the DOM so it receives focus on open; the wordmark is shown first. */}
          <IconButton label={t('menu.close')} icon="x" onClick={close} className="order-2" />
          <Link href="/" onClick={close} className="wordmark order-1 text-ink no-underline">
            {tCommon('brand')}
          </Link>
        </div>

        <nav aria-label={t('nav.label')} className="wrap flex-1 pb-10">
          <ul className="m-0 list-none p-0">
            {PRIMARY_NAV.map((item) => {
              const category = findCategoryByKey(categories, item.categoryKey);
              const href = category ? buildListingHref(category.slug) : '/';
              const label = t(`nav.${item.labelKey}`);
              if (!item.hasMenu) {
                return (
                  <li key={item.id}>
                    <Link href={href} onClick={close} className={ROW}>
                      {label}
                    </Link>
                  </li>
                );
              }
              const menu = item.id as MenuId;
              const entry = MEGA_CONFIG[menu];
              const isOpen = expanded === menu;
              const sub = [...entry.shop, ...entry.feature].flatMap((link) => {
                const target = resolveNavHref(categories, link, entry.categoryKey);
                return target ? [{ link, target }] : [];
              });
              return (
                <li key={item.id} className="border-b border-line">
                  <div className="flex items-center">
                    <Link href={href} onClick={close} className="flex-1 py-4 font-display text-[24px] font-semibold text-ink">
                      {label}
                    </Link>
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      aria-controls={`mobile-sub-${menu}`}
                      aria-label={t(isOpen ? 'mega.collapse' : 'mega.expand', { category: label })}
                      onClick={() => setExpanded(isOpen ? null : menu)}
                      className="flex h-11 w-11 items-center justify-center rounded-pill text-ink"
                    >
                      <Icon name={isOpen ? 'minus' : 'plus'} size={20} />
                    </button>
                  </div>
                  <ul id={`mobile-sub-${menu}`} hidden={!isOpen} className="m-0 list-none pb-3 pl-1">
                    {sub.map(({ link, target }) => (
                      <li key={link.labelKey}>
                        <Link href={target} onClick={close} className="block py-2 text-[16px] text-ink-2">
                          {t(`mega.${link.labelKey}`)}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
            {showStore ? (
              <li>
                <button
                  type="button"
                  className={ROW}
                  onClick={() => {
                    close();
                    openStorePicker();
                  }}
                >
                  {t('storePill.choose')}
                </button>
              </li>
            ) : null}
            <li>
              <button
                type="button"
                className={ROW}
                onClick={() => {
                  close();
                  setLocaleOpen(true);
                }}
              >
                {tLocale('title')}
              </button>
            </li>
            <li>
              <Link href="/account" onClick={close} className={ROW}>
                {t('account.myAccount')}
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </>
  );
}
