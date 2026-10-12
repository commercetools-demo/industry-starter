'use client';

import { useEffect, useId, useRef, useState, type ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { FOCUS_RING_ON_BRAND } from '@/components/ui/focus';
import { Link, usePathname } from '@/i18n/routing';
import { cx } from '@/lib/cx';
import { activeNavKey, type NavItem, type PlanMenuItem } from '@/lib/nav';

type BrowsePlansMenuProps = {
  /** The plan categories, in menu order. */
  plans: PlanMenuItem[];
  /** All root items (the active category is found in them). */
  items: NavItem[];
};

/**
 * "Browse all plans": a disclosure that opens a mega menu panel under the header with one column per plan category (phone, wireless,
 * cable). A button that shows or hides links, not an ARIA menu: Tab moves through the links, Escape closes and returns focus to the
 * button, a click outside or a route change closes it.
 */
export function BrowsePlansMenu({ plans, items }: BrowsePlansMenuProps): ReactElement {
  const t = useTranslations('shell.nav');
  const pathname = usePathname();
  const [openPath, setOpenPath] = useState<string | null>(null);
  const open = openPath !== null && openPath === pathname;
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const active = plans.some((plan) => plan.key === activeNavKey(pathname, items));

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return;
      setOpenPath(null);
      button.current?.focus();
    };
    const onPointer = (event: MouseEvent): void => {
      if (root.current && !root.current.contains(event.target as Node)) setOpenPath(null);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onPointer);
    };
  }, [open]);

  return (
    <div ref={root}>
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpenPath(open ? null : pathname)}
        className={cx(
          'inline-flex min-h-11 items-center gap-2 rounded-pill px-5 py-3 font-display text-sm font-semibold tracking-ui',
          active || open ? 'bg-brand-950 text-text-on-pink' : 'bg-transparent text-text-on-brand hover:bg-brand-400',
          FOCUS_RING_ON_BRAND,
        )}
      >
        {t('browsePlans')}
        <span aria-hidden="true" className={cx('inline-block text-xs transition-transform motion-reduce:transition-none', open && 'rotate-180')}>
          ▾
        </span>
      </button>
      {open ? (
        <div id={panelId} role="region" aria-label={t('mega.label')} className="absolute inset-x-0 top-full border-t border-border bg-surface text-text shadow-lg">
          <ul className="mx-auto m-0 grid w-full max-w-(--container-width) list-none grid-cols-3 gap-6 p-7 px-10">
            {plans.map((plan) => (
              <li key={plan.key}>
                <Link
                  href={plan.path}
                  onClick={() => setOpenPath(null)}
                  className="flex flex-col gap-1 rounded-lg p-4 no-underline hover:bg-brand-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action"
                >
                  <span className="font-display text-lg font-bold text-text">{plan.label}</span>
                  <span className="text-sm text-text-muted">{t(`mega.${plan.id}`)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
