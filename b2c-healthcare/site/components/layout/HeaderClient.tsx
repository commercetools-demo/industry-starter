'use client';
import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { ButtonLink } from '@/components/ui/Button';
import type { RegionOption } from '@/lib/types';
import { usePathname } from '@/i18n/routing';
import { activeSection, isHomePath } from '@/lib/nav';
import { AccountSlot } from './AccountSlot';
import { CartButton } from './CartButton';
import { HomeAccountSlot } from './HomeAccountSlot';
import { RegionSwitcher } from './RegionSwitcher';
import { MobileMenu } from './MobileMenu';
import { SearchLink } from './SearchLink';
import { DesktopLinks, useNavItems, type HeaderVariant } from './NavLinks';

export interface HeaderClientProps {
  /** Explicit variant; by default the home page (`/`) gets the home variant. */
  variant?: HeaderVariant;
  /** The "Health journal" link appears only once articles exist. */
  hasArticles?: boolean;
  /** Regions the project can sell in; the switcher is shown only for two or more (none in v1). */
  regions?: RegionOption[];
  /** The logo, rendered by the server shell. */
  children: ReactNode;
}

/**
 * Interactive part of the header: active section, cart and account islands, mobile menu. The cart
 * count and the signed-in identity are read from session-resolved SWR state inside the islands.
 */
export function HeaderClient({ variant, hasArticles = false, regions = [], children }: HeaderClientProps) {
  const t = useTranslations('shell');
  const pathname = usePathname();
  const resolved: HeaderVariant = variant ?? (isHomePath(pathname) ? 'home' : 'app');
  const items = useNavItems(resolved, activeSection(pathname), hasArticles);
  const home = resolved === 'home';
  return (
    <>
      <div className="mx-auto flex h-18 max-w-content items-center gap-4 px-5 nav:px-8">
        {children}
        <DesktopLinks items={items} />
        <div className="ml-auto flex items-center gap-3 nav:ml-0">
          {home ? (
            <>
              <HomeAccountSlot />
              <ButtonLink href="/doctors/remote" size="sm">
                {t('bookVisit')}
              </ButtonLink>
            </>
          ) : (
            <>
              <CartButton />
              <AccountSlot />
            </>
          )}
          <SearchLink />
          <RegionSwitcher regions={regions} />
          <MobileMenu items={items} home={home} />
        </div>
      </div>
    </>
  );
}
