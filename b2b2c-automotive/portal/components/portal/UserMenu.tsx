'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Avatar, useRoleLabel } from '@/components/layout/UserCard';
import { Link } from '@/i18n/routing';
import { useHardNavigate } from '@/hooks/useHardNavigate';
import { useOverlay } from '@/context/OverlayContext';
import { useViewer } from '@/context/ViewerContext';
import { authApi } from '@/hooks/useAuthApi';

/** Avatar button with the account menu: account settings and sign out. */
export function UserMenu() {
  const t = useTranslations('shell');
  const nav = useTranslations('nav.items');
  const viewer = useViewer();
  const roleLabel = useRoleLabel();
  const overlay = useOverlay();
  const go = useHardNavigate();
  const [busy, setBusy] = useState(false);
  const open = overlay.isOpen('user');

  async function signOut() {
    setBusy(true);
    await authApi.signOut();
    overlay.close('user');
    go('/sign-in');
  }

  return (
    <div className="relative">
      <button
        type="button"
        data-testid="avatar"
        aria-label={t('accountButton')}
        title={t('accountButton')}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={(e) => overlay.toggle('user', e.currentTarget)}
        className="grid place-items-center rounded-full"
      >
        <Avatar name={viewer.name} size="sm" />
      </button>
      {open ? (
        <div role="menu" aria-label={t('accountButton')} className="absolute right-0 top-full z-60 mt-200 flex w-widget-desktop-4col max-w-[calc(100vw-var(--space-800))] flex-col gap-200 rounded-400 bg-bg-surface p-400 text-text shadow-popover">
          <div className="px-200 pb-200">
            <p className="text-body-1 font-bold">{viewer.name}</p>
            <p className="truncate text-caption-1 font-medium text-text-subdued">{viewer.email}</p>
            <p className="text-caption-1 font-medium text-text-subdued">{roleLabel(viewer.roles)}</p>
          </div>
          <Link role="menuitem" href="/account" onClick={() => overlay.close('user')} className="flex h-1100 items-center rounded-300 px-300 text-body-1 font-semibold hover:bg-bg-surface-hover">
            {nav('account')}
          </Link>
          <button type="button" role="menuitem" disabled={busy} onClick={signOut} className="flex h-1100 items-center rounded-300 px-300 text-left text-body-1 font-semibold hover:bg-bg-surface-hover disabled:text-text-disabled">
            {t('signOut')}
          </button>
        </div>
      ) : null}
    </div>
  );
}
