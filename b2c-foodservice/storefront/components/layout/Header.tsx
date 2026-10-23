import { useTranslations } from 'next-intl';
import HeaderActions from '@/components/layout/HeaderActions';
import MobileNav from '@/components/layout/MobileNav';
import PrimaryNav from '@/components/layout/PrimaryNav';
import { Link } from '@/i18n/routing';
import type { Category } from '@/lib/types';

/** 72px sticky header. Server component; the interactive parts are client islands that receive the category tree. */
export default function Header({ categories }: { categories: Category[] }) {
  const t = useTranslations('common');
  return (
    <header className="sticky top-0 z-60 border-b border-line">
      {/* The blur sits on its own layer: backdrop-filter on the header would trap the fixed dialogs inside it. */}
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-canvas/86 backdrop-blur-[12px]" />
      <div className="wrap flex h-[72px] items-center gap-6 max-mobile:gap-2">
        <MobileNav categories={categories} />
        <Link prefetch={false} href="/" className="wordmark whitespace-nowrap text-ink no-underline">
          {t('brand')}
        </Link>
        <PrimaryNav categories={categories} />
        <HeaderActions />
      </div>
    </header>
  );
}
