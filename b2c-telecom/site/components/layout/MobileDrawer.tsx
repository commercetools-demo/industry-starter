'use client';

import { useEffect, useRef, useState, type KeyboardEvent, type ReactElement, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { DrawerSearchLink } from '@/components/search/HeaderSearchLink';
import { FOCUS_RING_ON_BRAND } from '@/components/ui/focus';
import { CloseIcon, MenuIcon } from '@/components/ui/Icon';
import { Pill } from '@/components/ui/Pill';
import { Link, usePathname } from '@/i18n/routing';
import { HEADER_SEARCH_ENABLED } from '@/lib/config/search';
import { cx } from '@/lib/cx';
import { activeNavKey, type NavItem } from '@/lib/nav';
import type { Market } from '@/lib/utils';
import { LocaleSwitcher } from './LocaleSwitcher';

const DRAWER_ID = 'mobile-drawer';
const FOCUSABLE = 'a[href], button:not([disabled])';

type MobileDrawerProps = { items: NavItem[]; account: ReactNode; locale: Market['locale'] };

/**
 * Below 768 px the header collapses to wordmark + bundle pill + this menu button (D-051). Undrawn: Junior design choice (D-068).
 * A slide-in panel from the right (88 vw, at most max-w-sm) over a dimmed backdrop; the language switch and the account link live here.
 * Open state is tied to the pathname it was opened on, so any route change closes it without an effect.
 */
export function MobileDrawer({ items, account, locale }: MobileDrawerProps): ReactElement {
  const t = useTranslations('shell');
  const pathname = usePathname();
  const [openPath, setOpenPath] = useState<string | null>(null);
  const open = openPath !== null && openPath === pathname;
  const menuButton = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const wasOpen = useRef(false);
  const active = activeNavKey(pathname, items);

  const close = (): void => setOpenPath(null);

  // Focus: into the panel on open (close button), back to the menu button on close.
  useEffect(() => {
    if (open) closeButton.current?.focus();
    else if (wasOpen.current) menuButton.current?.focus();
    wasOpen.current = open;
  }, [open]);

  // Scroll lock while open, always restored (also on unmount); Escape closes.
  useEffect(() => {
    if (!open) return undefined;
    document.body.classList.add('overflow-hidden');
    const onKey = (event: globalThis.KeyboardEvent): void => {
      if (event.key === 'Escape') setOpenPath(null);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.classList.remove('overflow-hidden');
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Tab and Shift+Tab cycle inside the panel.
  const trapFocus = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key !== 'Tab' || !panel.current) return;
    const focusable = Array.from(panel.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const current = document.activeElement;
    if (event.shiftKey && (current === first || !panel.current.contains(current))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (current === last || !panel.current.contains(current))) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div className="md:hidden">
      <button
        ref={menuButton}
        type="button"
        aria-label={t('menu.open')}
        aria-expanded={open}
        aria-controls={DRAWER_ID}
        onClick={() => setOpenPath(pathname)}
        className={cx('inline-flex min-h-11 min-w-11 items-center justify-center rounded-pill bg-brand-950 text-xl text-text-on-pink', FOCUS_RING_ON_BRAND)}
      >
        <MenuIcon />
      </button>
      {open ? (
        <>
          <div aria-hidden="true" data-testid="drawer-backdrop" onClick={close} className="fixed inset-0 bg-overlay" />
          <div
            ref={panel}
            id={DRAWER_ID}
            role="dialog"
            aria-modal="true"
            aria-label={t('menu.title')}
            onKeyDown={trapFocus}
            className="fixed inset-y-0 right-0 flex w-[88vw] max-w-sm translate-x-0 flex-col gap-5 overflow-y-auto rounded-l-xl bg-surface p-7 text-text shadow-lg transition-transform duration-200 starting:translate-x-full motion-reduce:transition-none"
          >
            <div className="flex items-center justify-between">
              <Link
                href="/"
                aria-label={t('home')}
                onClick={close}
                className={cx('rounded-pill font-display text-4xl font-bold leading-none tracking-widest text-brand-950 no-underline', FOCUS_RING_ON_BRAND)}
              >
                malva
              </Link>
              <button
                ref={closeButton}
                type="button"
                aria-label={t('menu.close')}
                onClick={close}
                className={cx('inline-flex min-h-11 min-w-11 items-center justify-center rounded-pill bg-brand-100 text-xl text-brand-950', FOCUS_RING_ON_BRAND)}
              >
                <CloseIcon />
              </button>
            </div>
            {HEADER_SEARCH_ENABLED ? <DrawerSearchLink onNavigate={close} /> : null}
            <nav aria-label={t('nav.primary')} className="flex flex-col gap-3">
              {items.map((item) => {
                const isActive = active === item.key;
                return (
                  <Pill
                    key={item.key}
                    href={item.path}
                    active={isActive}
                    aria-current={isActive ? 'page' : undefined}
                    onClick={close}
                    className="w-full"
                  >
                    {item.label}
                  </Pill>
                );
              })}
            </nav>
            <hr className="m-0 border-0 border-t border-border" />
            <div>{account}</div>
            <LocaleSwitcher current={locale} className="self-start" />
          </div>
        </>
      ) : null}
    </div>
  );
}
