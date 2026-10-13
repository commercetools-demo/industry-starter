'use client';

import { useTranslations } from 'next-intl';
import { BusinessUnitSwitcher } from '@/components/portal/BusinessUnitSwitcher';
import { NotificationBell } from '@/components/portal/NotificationBell';
import { ThemeToggle } from '@/components/portal/ThemeToggle';
import { TopSearch } from '@/components/portal/TopSearch';
import { UserMenu } from '@/components/portal/UserMenu';
import { Icon } from '@/components/ui/icons/Icon';
import { LogoMark } from '@/components/ui/Logo';
import { useOverlay } from '@/context/OverlayContext';

/**
 * 84 px top bar, dark in both themes (`--color-bg-topbar`, never overridden): logo, search, switcher, command palette,
 * notifications, theme, account. Under 700 px the logo and search give way to the menu button that opens the drawer.
 */
export function TopBar() {
  const t = useTranslations('shell');
  const overlay = useOverlay();
  return (
    <header data-testid="topbar" className="flex h-topbar flex-none items-center gap-400 bg-bg-topbar px-500 text-text-on narrow:gap-200 narrow:px-300">
      <button
        type="button"
        aria-label={t('openMenu')}
        aria-expanded={overlay.isOpen('drawer')}
        aria-controls="portal-drawer"
        onClick={(e) => overlay.toggle('drawer', e.currentTarget)}
        className="hidden size-1100 flex-none place-items-center rounded-full hover:bg-bg-brand-hover narrow:grid"
      >
        <Icon name="menu" />
      </button>
      <div className="flex flex-none items-center gap-300 narrow:hidden">
        <LogoMark tone="on-dark" />
        <p className="text-title-1 font-bold whitespace-nowrap max-lg:hidden">
          {t('brandName')} <span className="font-medium text-gray-11">{t('brandSuffix')}</span>
        </p>
      </div>
      <div className="flex min-w-0 flex-1 justify-center narrow:hidden">
        <TopSearch />
      </div>
      <div className="flex min-w-0 items-center gap-200 narrow:flex-1">
        <BusinessUnitSwitcher />
        <button
          type="button"
          title={t('paletteButton')}
          aria-keyshortcuts="Control+K Meta+K"
          onClick={(e) => overlay.toggle('cmd', e.currentTarget)}
          className="h-1100 flex-none rounded-300 border border-border-on px-300 text-body-2 font-semibold hover:bg-bg-brand-hover narrow:hidden"
        >
          <span className="sr-only">{t('paletteButton')}</span>
          <span aria-hidden="true">⌘K</span>
        </button>
        <NotificationBell />
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
}
