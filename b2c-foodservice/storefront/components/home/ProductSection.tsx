import { useTranslations } from 'next-intl';
import ProductCard from '@/components/product/ProductCard';
import { Link } from '@/i18n/routing';
import { cn } from '@/lib/cn';
import type { ProductSummary } from '@/lib/types';

/**
 * Eyebrow, title, "View all" and up to four cards. Renders nothing when there is nothing to show (a section with no
 * products is omitted, never an empty heading). Cards own their availability line, heart and quick add (G).
 */
export default function ProductSection({
  id,
  eyebrow,
  title,
  viewAllHref,
  products,
  accentEyebrow = false,
}: {
  id: string;
  eyebrow: string;
  title: string;
  viewAllHref: string;
  products: ProductSummary[];
  accentEyebrow?: boolean;
}) {
  const t = useTranslations('home');
  if (products.length === 0) return null;
  return (
    <section aria-labelledby={`${id}-title`} data-testid={id} className="home-section">
      <div className="wrap">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <p className={cn('eyebrow m-0 mb-2', accentEyebrow && '!text-accent')}>{eyebrow}</p>
            <h2 id={`${id}-title`} className="section-title m-0 text-ink">
              {title}
            </h2>
          </div>
          <Link
            href={viewAllHref}
            className="shrink-0 text-[14px] font-semibold text-ink underline decoration-transparent underline-offset-4 transition-state hover:decoration-current"
          >
            {t('viewAll')}
          </Link>
        </div>
        <ul className="grid-products m-0 list-none p-0">
          {products.map((product) => (
            <li key={product.id} className="min-w-0">
              <ProductCard product={product} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
