import { useTranslations } from 'next-intl';
import Breadcrumbs, { type Crumb } from '@/components/listing/Breadcrumbs';

/**
 * Breadcrumbs, H1 and the count line. The count line is a polite live region: when a filter link re-renders the page the
 * new "{n} products" is announced.
 */
export default function ResultHeader({
  scope, categoryName, query, total, crumbs,
}: {
  scope: 'category' | 'shop' | 'search';
  categoryName?: string;
  query?: string;
  total: number;
  crumbs: Crumb[];
}) {
  const t = useTranslations('plp');
  const title =
    scope === 'search' ? (query ? t('title.search', { query }) : t('breadcrumb.search')) : scope === 'category' ? (categoryName ?? '') : t('title.all');
  return (
    <header className="mb-6">
      <Breadcrumbs items={crumbs} />
      <h1 className="m-0 mt-3 font-display text-[34px] font-extrabold leading-[1.1] tracking-[-0.025em] text-ink mobile:text-[40px]">
        {title}
      </h1>
      <p role="status" aria-live="polite" className="m-0 mt-2 text-[14px] text-ink-3">
        {t('count', { count: total })}
      </p>
    </header>
  );
}
