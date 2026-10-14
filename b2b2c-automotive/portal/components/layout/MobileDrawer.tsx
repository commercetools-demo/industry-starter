'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef } from 'react';
import { Icon } from '@/components/ui/icons/Icon';
import { LogoMark } from '@/components/ui/Logo';
import { useOverlay } from '@/context/OverlayContext';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import type { LogicalRole } from '@/lib/authz/permissions';
import type { Viewer } from '@/lib/portal/types';
import { NavList } from './NavList';
import { UserCard } from './UserCard';

/**
 * Under 700 px the rail becomes a drawer opened from the top bar: a modal dialog with a focus trap, Escape (the overlay
 * stack) closes it and focus returns to the menu button. It closes when the viewport grows past 700 px.
 */
export function MobileDrawer({ roles, viewer }: { roles: LogicalRole[]; viewer: Viewer }) {
  const t = useTranslations('shell');
  const overlay = useOverlay();
  const open = overlay.isOpen('drawer');
  const panel = useRef<HTMLDivElement>(null);
  useFocusTrap(panel, open);

  useEffect(() => {
    if (!open) return;
    const query = window.matchMedia('(min-width: 43.75rem)');
    const onChange = () => query.matches && overlay.close('drawer');
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, [open, overlay]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex">
      <div aria-hidden="true" onClick={() => overlay.close('drawer')} className="absolute inset-0 bg-overlay" />
      <div
        ref={panel}
        id="portal-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={t('openMenu')}
        className="relative flex h-full w-sidebar max-w-full flex-col justify-between gap-600 overflow-y-auto rounded-r-sidebar bg-bg-surface-subdued p-400"
      >
        <div className="flex flex-col gap-400">
          <div className="flex items-center justify-between gap-300">
            <div className="flex items-center gap-300">
              <LogoMark tone="on-light" />
              <p className="text-title-2 font-bold text-text">
                {t('brandName')} <span className="font-medium text-text-subdued">{t('brandSuffix')}</span>
              </p>
            </div>
            <button
              type="button"
              aria-label={t('closeMenu')}
              onClick={() => overlay.close('drawer')}
              className="grid size-1100 place-items-center rounded-full text-text hover:bg-bg-surface-hover"
            >
              <Icon name="close" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              overlay.close('drawer');
              overlay.open('cmd');
            }}
            className="flex h-1100 items-center gap-300 rounded-300 bg-bg-surface px-300 text-body-2 font-semibold text-text-subdued"
          >
            <Icon name="search" size="sm" />
            {t('searchPlaceholder')}
          </button>
          <NavList roles={roles} collapsible={false} onNavigate={() => overlay.close('drawer')} />
        </div>
        <UserCard viewer={viewer} collapsible={false} />
      </div>
    </div>
  );
}
