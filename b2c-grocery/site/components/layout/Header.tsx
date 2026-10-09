import { Suspense } from 'react';
import type { ReactNode } from 'react';
import { Heart, Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Link } from '@/i18n/routing';
import type { CountryConfig } from '@/lib/utils';
import { CompactNav } from './CompactNav';
import { LocaleSwitcher } from './LocaleSwitcher';
import { NavLinks } from './NavLinks';
import { PrimaryNav } from './PrimaryNav';

type HeaderProps = {
  /** Bag button with count. */
  bag: ReactNode;
  /** Account link or menu. */
  account: ReactNode;
  markets: CountryConfig[];
};

/** Sticky site header. A Server Component: only `PrimaryNav`, `CompactNav` and `LocaleSwitcher` are client leaves. */
export function Header({ bag, account, markets }: HeaderProps) {
  const t = useTranslations('nav');
  const c = useTranslations('common');
  return (
    <header className="sticky top-0 z-50 bg-[color-mix(in_srgb,var(--color-bg)_92%,transparent)] backdrop-blur-[10px]">
      <div className="page flex items-center gap-(--space-3) py-(--space-4) px-(--space-4) tablet:px-(--space-8) desktop:gap-(--space-6)">
        <Link href="/" aria-label={t('home')} className="font-heading text-[26px] tracking-[-0.02em] text-text no-underline">
          {c('brand')}
        </Link>
        <div className="mr-auto hidden min-w-0 desktop:block">
          <Suspense fallback={<NavLinks active={null} />}>
            <PrimaryNav />
          </Suspense>
        </div>
        <div className="ml-auto flex items-center gap-(--space-2) desktop:ml-0">
          <Link
            href="/search"
            className="btn btn-secondary hidden w-[190px] flex-none justify-start gap-2 overflow-hidden font-body font-normal whitespace-nowrap text-muted desktop:inline-flex"
          >
            <Icon icon={Search} size={15} />
            {t('searchPill')}
          </Link>
          <Button href="/account/saved" variant="secondary" size="icon" aria-label={t('saved')} className="hidden tablet:inline-flex">
            <Icon icon={Heart} size={17} />
          </Button>
          {bag}
          {account}
          <div className="hidden desktop:block">
            <LocaleSwitcher markets={markets} />
          </div>
          <CompactNav markets={markets} className="desktop:hidden" />
        </div>
      </div>
    </header>
  );
}
