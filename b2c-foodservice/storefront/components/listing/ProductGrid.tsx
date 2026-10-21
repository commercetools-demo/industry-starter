import ProductCard from '@/components/product/ProductCard';
import type { ProductSummary } from '@/lib/types';

/**
 * Card grid. Exported for O (home) and L (saved items). Three columns beside the sidebar (above 1080px), two below;
 * a tighter gap under 520px. `wide` gives four columns when there is no sidebar.
 */
export default function ProductGrid({ products, wide = false }: { products: ProductSummary[]; wide?: boolean }) {
  return (
    <ul
      className={`m-0 grid list-none grid-cols-2 gap-x-3.5 gap-y-[18px] p-0 xs:gap-x-6 xs:gap-y-7 ${wide ? 'grid3:grid-cols-4' : 'grid3:grid-cols-3'}`}
      data-testid="product-grid"
    >
      {products.map((p) => (
        <li key={p.id} className="min-w-0">
          <ProductCard product={p} />
        </li>
      ))}
    </ul>
  );
}
