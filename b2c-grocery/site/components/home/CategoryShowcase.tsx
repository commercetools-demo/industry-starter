import { useTranslations } from 'next-intl';
import { Card, CardMeta, CardTitle } from '@/components/ui/Card';
import { Photo } from '@/components/ui/Photo';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { Link } from '@/i18n/routing';
import { twoDigits, type ShowcaseItem } from '@/lib/home-view';

/** "The aisles": a 6-column grid of cards (3 at tablet, a scroll-snap row on mobile), each opening `/shop?category=<slug>`. */
export function CategoryShowcase({ items }: { items: ShowcaseItem[] }) {
  const t = useTranslations('home.categories');
  if (items.length === 0) return null;
  return (
    <section data-section="categories">
      <SectionHeading kicker={t('kicker')} title={t('title')} linkLabel={t('all')} linkHref="/shop" />
      <ul className="m-0 mt-(--space-6) flex list-none snap-x snap-mandatory gap-(--space-4) overflow-x-auto p-0 pb-(--space-2) tablet:grid tablet:grid-cols-3 tablet:overflow-visible desktop:grid-cols-6">
        {items.map((item) => (
          <li key={item.key} data-category={item.key} className="w-[180px] flex-none snap-start tablet:w-auto">
            <Link href={`/shop?category=${item.slug}`} className="lift block h-full rounded-[calc(var(--radius-lg)*1.15)] text-text no-underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">
              <Card elev="sm" className="h-full">
                <Photo src={item.image} alt="" sizes="(min-width: 75rem) 200px, 180px" className="h-[130px]" />
                <CardTitle>{item.name}</CardTitle>
                {item.count !== undefined ? <CardMeta>{t('count', { count: twoDigits(item.count) })}</CardMeta> : null}
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
