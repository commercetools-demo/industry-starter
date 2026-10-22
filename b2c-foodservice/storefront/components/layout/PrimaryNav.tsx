'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import MegaPanel from '@/components/layout/MegaMenu';
import { Link, usePathname } from '@/i18n/routing';
import { cn } from '@/lib/cn';
import { PRIMARY_NAV, findCategoryByKey, type MenuId } from '@/lib/nav/mega-config';
import type { Category } from '@/lib/types';

/** Pointer-leave grace period, so moving from a link into its panel does not close it. */
export const CLOSE_DELAY_MS = 130;

/**
 * The five primary links and their hover panels. A missing category (or an empty tree) falls back to `/` so the bar is
 * never empty. A panel opens on pointer enter or ArrowDown, closes 130 ms after the pointer leaves the link or the
 * panel, and on Escape, outside pointer down, a link choice and a route change.
 */
export default function PrimaryNav({ categories }: { categories: Category[] }) {
  const t = useTranslations('shell.nav');
  const pathname = usePathname();
  // Open for one pathname only, so a route change closes it without an effect.
  const [openState, setOpenState] = useState<{ id: MenuId; path: string } | null>(null);
  const openId = openState && openState.path === pathname ? openState.id : null;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const root = useRef<HTMLElement>(null);

  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  const open = (id: MenuId) => {
    clearTimer();
    setOpenState({ id, path: pathname });
  };
  const close = () => {
    clearTimer();
    setOpenState(null);
  };
  const scheduleClose = () => {
    clearTimer();
    timer.current = setTimeout(() => {
      timer.current = null;
      setOpenState(null);
    }, CLOSE_DELAY_MS);
  };

  useEffect(() => clearTimer, []);

  useEffect(() => {
    if (!openId) return;
    const onPointerDown = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) {
        if (timer.current) clearTimeout(timer.current);
        timer.current = null;
        setOpenState(null);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [openId]);

  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key !== 'Escape' || !openId) return;
    e.stopPropagation();
    const link = root.current?.querySelector<HTMLElement>(`[data-menu="${openId}"]`);
    close();
    link?.focus();
  };

  return (
    <nav ref={root} aria-label={t('label')} onKeyDown={onKeyDown} className="flex items-center gap-1 max-[1100px]:gap-0 max-mobile:hidden">
      {PRIMARY_NAV.map((item) => {
        const category = findCategoryByKey(categories, item.categoryKey);
        const href = category ? `/category/${category.slug}` : '/';
        const active = category !== null && (pathname === href || pathname.startsWith(`${href}/`));
        const menu = item.hasMenu ? (item.id as MenuId) : null;
        return (
          <Link
            key={item.id}
            prefetch={false}
            href={href}
            data-menu={menu ?? undefined}
            aria-current={active ? 'page' : undefined}
            aria-haspopup={menu ? 'true' : undefined}
            aria-expanded={menu ? openId === menu : undefined}
            aria-controls={menu ? `mega-${menu}` : undefined}
            onMouseEnter={menu ? () => open(menu) : () => scheduleClose()}
            onMouseLeave={menu ? scheduleClose : undefined}
            onClick={close}
            onKeyDown={
              menu
                ? (e) => {
                    if (e.key !== 'ArrowDown') return;
                    e.preventDefault();
                    open(menu);
                    // Focus moves in once the panel is no longer inert.
                    requestAnimationFrame(() => {
                      root.current?.querySelector<HTMLElement>(`#mega-${menu} a`)?.focus();
                    });
                  }
                : undefined
            }
            className={cn(
              'group relative px-3.5 py-2.5 font-display text-[15px] font-semibold max-[1100px]:px-2',
              active ? 'text-accent' : 'text-ink hover:text-accent focus-visible:text-accent',
            )}
          >
            {t(item.labelKey)}
            <span
              aria-hidden="true"
              className={cn(
                'absolute bottom-1 left-3.5 right-3.5 max-[1100px]:left-2 max-[1100px]:right-2 h-0.5 origin-left bg-current transition-transform duration-200 motion-reduce:transition-none',
                active ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100 group-focus-visible:scale-x-100',
              )}
            />
          </Link>
        );
      })}
      {PRIMARY_NAV.filter((n) => n.hasMenu).map((n) => (
        <MegaPanel
          key={n.id}
          menu={n.id as MenuId}
          categories={categories}
          open={openId === n.id}
          onEnter={() => open(n.id as MenuId)}
          onLeave={scheduleClose}
          onNavigate={close}
        />
      ))}
    </nav>
  );
}
