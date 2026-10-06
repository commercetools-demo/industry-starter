import type { Product } from '@/lib/types';
import { ProductTile } from './ProductTile';

/** 3 columns at `desktop`, 2 at tablet and 2 compact on mobile; gap 26.4px x 17.6px. */
export function ProductGrid({ products }: { products: Product[] }) {
  return (
    <ul className="m-0 grid list-none grid-cols-2 gap-x-(--space-3) gap-y-(--space-4) p-0 tablet:gap-x-(--space-4) tablet:gap-y-(--space-6) desktop:grid-cols-3">
      {products.map((product, index) => (
        <li key={product.id}>
          <ProductTile product={product} priority={index < 3} />
        </li>
      ))}
    </ul>
  );
}
