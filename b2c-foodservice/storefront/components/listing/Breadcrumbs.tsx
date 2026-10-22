import { useTranslations } from 'next-intl';
import Icon from '@/components/ui/Icon';
import { Link } from '@/i18n/routing';

export interface Crumb { label: string; href?: string }

/** Home › category path. The last item is the current page (no link, `aria-current="page"`). */
export default function Breadcrumbs({ items }: { items: Crumb[] }) {
  const t = useTranslations('plp.breadcrumb');
  return (
    <nav aria-label={t('aria')} className="text-[13px] text-ink-3">
      <ol className="m-0 flex list-none flex-wrap items-center gap-1.5 p-0">
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <li key={`${i}-${item.label}`} className="flex items-center gap-1.5">
              {last || !item.href ? (
                <span aria-current={last ? 'page' : undefined} className={last ? 'text-ink' : undefined}>
                  {item.label}
                </span>
              ) : (
                <Link prefetch={false} href={item.href} className="text-ink-3 no-underline hover:text-ink">
                  {item.label}
                </Link>
              )}
              {last ? null : <Icon name="chevR" size={12} />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
