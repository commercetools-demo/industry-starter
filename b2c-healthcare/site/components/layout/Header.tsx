import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import type { RegionOption } from '@/lib/types';
import { HeaderClient } from './HeaderClient';
import type { HeaderVariant } from './NavLinks';

export function Logo({ inverse = false }: { inverse?: boolean }) {
  const t = useTranslations('shell');
  return (
    <Link
      href="/"
      aria-label={t('logoLabel')}
      className={`flex items-center gap-2 font-display text-[length:var(--text-xl)] font-bold ${inverse ? 'text-text-on-brand hover:text-text-on-brand' : 'text-navy-900 hover:text-navy-900'}`}
    >
      <i aria-hidden="true" className="grid size-7 place-items-center rounded-md bg-brand-500 text-md font-semibold text-action-label not-italic">
        M
      </i>
      <span aria-hidden="true">Malva</span>
    </Link>
  );
}

export interface HeaderProps {
  variant?: HeaderVariant;
  hasArticles?: boolean;
  /** Regions for the switcher (workstream W); fewer than two renders none. */
  regions?: RegionOption[];
}

/**
 * Server shell of the header: sticky 72 px bar (white 95% with blur) and the logo. Everything that
 * depends on the visitor (active link, cart count, identity, menu) is in client islands that read
 * session-resolved SWR state, so no per-visitor value is ever part of this markup.
 */
export function Header({ variant, hasArticles, regions }: HeaderProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-surface/95 backdrop-blur-sm">
      <HeaderClient variant={variant} hasArticles={hasArticles} regions={regions}>
        <Logo />
      </HeaderClient>
    </header>
  );
}
