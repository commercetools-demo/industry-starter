import type { Selector } from '@/lib/config/variant-config';
import type { Product, Variant } from '@/lib/types';
import { Tag } from '@/components/ui/Tag';
import { cx } from '@/components/ui/cx';
import { AddToBag } from './AddToBag';
import { Availability } from './Availability';
import { ContactStrip } from './ContactStrip';
import { PriceBlock } from './PriceBlock';
import { SpecsTable } from './SpecsTable';
import { VariantSelectors } from './VariantSelectors';

/**
 * Right-hand column: identity, price, description, option selectors, add to bag, availability, contact strip and specs.
 * `AddToBag` is keyed by the variant SKU, so its quantity resets when another product or variant is shown.
 */
export function BuyBox({
  product,
  variant,
  selectors,
  categoryName,
  className,
}: {
  product: Product;
  variant: Variant;
  selectors: Selector[];
  categoryName?: string;
  className?: string;
}) {
  return (
    <div className={cx('grid gap-(--space-4)', className)}>
      <div>
        <div className="flex flex-wrap gap-(--space-2)">
          {categoryName ? <Tag tone="accent-2">{categoryName}</Tag> : null}
          <Tag>{variant.sku}</Tag>
        </div>
        <h1 className="mt-(--space-3) mb-0 text-[34px] leading-[1.02] tablet:text-[48px]">{product.name}</h1>
        {product.brand ? <p className="mt-(--space-2) mb-0 text-[15px] text-muted">{product.brand}</p> : null}
      </div>
      <PriceBlock price={variant.price} increment={variant.increment} className="font-heading text-[30px]" />
      {product.description ? <p className="m-0 text-[16px] leading-[1.7] text-text/75">{product.description}</p> : null}
      <VariantSelectors selectors={selectors} />
      <AddToBag key={variant.sku} product={product} variant={variant} />
      <Availability variant={variant} />
      <ContactStrip />
      <SpecsTable product={product} />
    </div>
  );
}
