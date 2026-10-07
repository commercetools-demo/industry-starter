import type { ReactElement } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Tag } from '@/components/ui/Tag';
import { formatMoney } from '@/lib/format';
import type { Locale, SearchResultItem } from '@/lib/types';

type SearchResultCardProps = {
  item: SearchResultItem;
  /** The first card of an exact part-number match announces itself as the best match. */
  best?: boolean;
};

/**
 * One result (undrawn: Junior design choice, D-068): honey header with kind and name, body with category, first highlight (plans), the
 * from price, the matched part number and a CTA to the offer's place in its category listing (never a detail page, D-052).
 */
export function SearchResultCard({ item, best = false }: SearchResultCardProps): ReactElement {
  const t = useTranslations('search');
  const locale = useLocale() as Locale;
  const price = item.fromPrice
    ? t(item.fromPriceRecurring ? 'from' : 'fromOneTime', { price: formatMoney(item.fromPrice, locale) })
    : t('priceUnavailable');
  return (
    <li className="list-none">
      <Card as="article" className="h-full">
        <div aria-label={best && item.matchedSku ? t('bestMatch', { sku: item.matchedSku }) : undefined} role={best && item.matchedSku ? 'group' : undefined} className="flex h-full flex-col">
          <CardHeader tone="brand" className="flex flex-col gap-1">
            <span className="font-display text-xs font-semibold uppercase tracking-ui">{t(`kind.${item.kind}`)}</span>
            <h2 className="m-0 font-display text-xl font-bold">{item.name}</h2>
          </CardHeader>
          <CardBody className="flex-1">
            <p className="m-0 text-sm text-text-muted">{item.categoryName}</p>
            {item.highlight ? <p className="m-0 text-md">{item.highlight}</p> : null}
            <p className="m-0 font-display text-xl font-bold">{price}</p>
            {item.matchedSku ? (
              <p className="m-0 flex flex-wrap items-center gap-3 text-sm">
                <Tag tone="pink">{t('partNumber')}</Tag>
                <span data-testid="matched-sku">{item.matchedSku}</span>
              </p>
            ) : null}
            <Button href={item.path} variant="secondary" data-testid="result-link" className="mt-auto self-start">
              {t('viewIn', { category: item.categoryName })}
            </Button>
          </CardBody>
        </div>
      </Card>
    </li>
  );
}
