'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAccount } from '@/hooks/use-account';
import { useCart } from '@/hooks/use-cart';
import { Link, usePathname } from '@/i18n/routing';
import { NAV_BREAKPOINT_PX } from '@/lib/nav';
import { SIGN_IN_HREF } from './AccountSlot';
import type { NavItem } from './NavLinks';

const ROW =
  'block rounded-md px-4 py-3 font-display text-sm font-medium text-navy-900 hover:bg-brand-50 aria-[current=page]:bg-brand-50 aria-[current=page]:text-brand-600';

export interface MobileMenuProps {
  items: NavItem[];
  /** The home header shows "Book a visit" instead of the cart/account pair. */
  home?: boolean;
}

/**
 * Menu button + slide-down panel for viewports under the nav breakpoint (design D10, SO-02).
 * Opens a disclosure (not a modal): focus moves to the first link, Escape or the button close it and
 * return focus to the button, following a link closes it, and widening the viewport past the
 * breakpoint closes it. The button is hidden at and above the breakpoint by CSS.
 */
export function MobileMenu({ items, home = false }: MobileMenuProps) {
  const t = useTranslations('shell');
  const pathname = usePathname();
  const panelId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  // The menu is open only for the route it was opened on: navigating closes it without an effect.
  const [openedAt, setOpenedAt] = useState<string | null>(null);
  const open = openedAt === pathname;
  const { data: cart } = useCart();
  const { data: user } = useAccount();
  const count = cart?.lineCount ?? 0;

  useEffect(() => {
    if (!open) return;
    panelRef.current?.querySelector<HTMLElement>('a')?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      setOpenedAt(null);
      buttonRef.current?.focus();
    }
    const query = window.matchMedia(`(min-width: ${NAV_BREAKPOINT_PX}px)`);
    function onChange(event: MediaQueryListEvent) {
      if (event.matches) setOpenedAt(null);
    }
    document.addEventListener('keydown', onKeyDown);
    query.addEventListener('change', onChange);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      query.removeEventListener('change', onChange);
    };
  }, [open]);

  const close = () => setOpenedAt(null);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? t('menu.close') : t('menu.open')}
        onClick={() => setOpenedAt(open ? null : pathname)}
        className="nav:hidden grid size-10 place-items-center rounded-md border border-border bg-surface text-navy-900 hover:bg-brand-50"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
      </button>
      <div
        ref={panelRef}
        id={panelId}
        hidden={!open}
        data-mobile-menu
        className="nav:hidden absolute inset-x-0 top-full border-b border-border bg-surface shadow-md"
      >
        <nav aria-label={t('menu.label')} className="mx-auto grid max-w-content gap-1 px-5 py-3">
          {items.map((item) => (
            <Link key={item.key} href={item.href} aria-current={item.active ? 'page' : undefined} onClick={close} className={ROW}>
              {item.label}
            </Link>
          ))}
          {home ? (
            <Link href="/doctors/remote" onClick={close} className={ROW}>
              {t('bookVisit')}
            </Link>
          ) : (
            <Link
              href="/cart"
              onClick={close}
              aria-label={count > 0 ? `${t('cart')}, ${t('cartCount', { count })}` : undefined}
              className={ROW}
            >
              {t('cart')}
              {count > 0 ? (
                <span aria-hidden="true" className="ml-2 rounded-pill bg-navy-700 px-1.5 text-xs font-semibold text-text-on-brand">
                  {count}
                </span>
              ) : null}
            </Link>
          )}
          {user && !home ? (
            <Link href="/account" onClick={close} className={ROW}>
              {t('account')}
            </Link>
          ) : (
            <Link href={SIGN_IN_HREF} onClick={close} className={ROW}>
              {t('signIn')}
            </Link>
          )}
        </nav>
      </div>
    </>
  );
}
