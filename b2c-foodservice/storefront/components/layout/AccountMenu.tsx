'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import Icon from '@/components/ui/Icon';
import { fetchJson } from '@/hooks/fetcher';
import { useAccount } from '@/hooks/useAccount';
import { Link, usePathname, useRouter } from '@/i18n/routing';

const ICON_LINK =
  'transition-state relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-pill text-ink hover:bg-ink/6';

/** Guest: user icon link to sign in. Signed in: initials avatar and a dropdown (name, email, Dashboard, Sign out). */
export default function AccountMenu() {
  const t = useTranslations('shell.account');
  const { customer, mutate } = useAccount();
  const router = useRouter();
  const pathname = usePathname();
  // The menu is open for one pathname only, so any route change closes it without an effect.
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt === pathname;
  const setOpen = (value: boolean | ((o: boolean) => boolean)) => {
    const next = typeof value === 'function' ? value(open) : value;
    setOpenAt(next ? pathname : null);
  };
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpenAt(null);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  useEffect(() => {
    if (open) root.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
  }, [open]);

  if (!customer) {
    return (
      <Link href="/account/sign-in" aria-label={t('signIn')} className={ICON_LINK}>
        <Icon name="user" size={20} />
      </Link>
    );
  }

  const initials = `${customer.firstName.charAt(0)}${customer.lastName.charAt(0)}`.toUpperCase();

  const onMenuKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      setOpen(false);
      trigger.current?.focus();
      return;
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const items = Array.from(root.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    const at = items.indexOf(document.activeElement as HTMLElement);
    const next = e.key === 'ArrowDown' ? (at + 1) % items.length : (at - 1 + items.length) % items.length;
    items[next]?.focus();
  };

  const signOut = async () => {
    setOpen(false);
    try {
      await fetchJson('/api/auth/logout', { method: 'POST' });
    } finally {
      await mutate({ customer: null }, { revalidate: false });
      router.refresh();
    }
  };

  return (
    <div ref={root} className="relative" onKeyDown={onMenuKeyDown}>
      <button
        ref={trigger}
        type="button"
        aria-label={t('menu')}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="account-menu"
        onClick={() => setOpen((o) => !o)}
        className="transition-state inline-flex h-10 items-center gap-1 rounded-pill pl-1 pr-2 text-ink hover:bg-ink/6"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-pill bg-ink font-display text-[12px] font-bold text-surface">
          {initials}
        </span>
        <Icon name="chevD" size={14} />
      </button>
      {open ? (
        <div
          id="account-menu"
          role="menu"
          aria-label={t('menu')}
          className="absolute right-0 top-[calc(100%+8px)] z-20 w-[260px] rounded-card border border-line bg-surface p-2 shadow-lg"
        >
          <div className="px-3 pb-2 pt-2">
            <p className="m-0 font-display text-[15px] font-semibold">
              {customer.firstName} {customer.lastName}
            </p>
            <p className="m-0 truncate text-[13px] text-ink-3" title={customer.email}>
              {customer.email}
            </p>
          </div>
          <Link
            role="menuitem"
            href="/account"
            className="block rounded-field px-3 py-2.5 text-[14px] hover:bg-canvas-2"
          >
            {t('dashboard')}
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={signOut}
            className="block w-full rounded-field px-3 py-2.5 text-left text-[14px] hover:bg-canvas-2"
          >
            {t('signOut')}
          </button>
        </div>
      ) : null}
    </div>
  );
}
