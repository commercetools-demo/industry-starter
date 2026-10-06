import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';

/**
 * Home / Shop / <Category>; the last item is the current page and not a link. On the product page pass `current`
 * (the product name): the category then becomes a link (`categoryHref`) and the product is the last item.
 */
export function Breadcrumbs({ category, categoryHref, current }: { category?: string; categoryHref?: string; current?: string }) {
  const t = useTranslations('plp.breadcrumbs');
  const nav = useTranslations('nav');
  const items: { label: string; href?: string }[] = [
    { label: t('home'), href: '/' },
    { label: nav('shop'), href: '/shop' },
    ...(category ? [{ label: category, href: current ? (categoryHref ?? '/shop') : undefined }] : []),
    ...(current ? [{ label: current }] : []),
  ];
  const last = items.length - 1;
  return (
    <nav aria-label={t('label')} className="text-[13px] text-muted">
      <ol className="m-0 flex list-none flex-wrap items-center gap-(--space-2) p-0">
        {items.map((item, index) => (
          <li key={`${index}-${item.label}`} className="flex items-center gap-(--space-2)">
            {index > 0 ? <span aria-hidden="true">/</span> : null}
            {index === last ? (
              <span aria-current="page" className="text-text">
                {item.label}
              </span>
            ) : (
              <Link href={item.href ?? '/shop'} className="text-inherit no-underline hover:text-accent">
                {item.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
