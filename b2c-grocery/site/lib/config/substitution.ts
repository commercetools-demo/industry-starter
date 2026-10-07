import type { Category, Product, SubstitutionPreference } from '../types';

/** Perishable categories where a similar item is welcome by default. Everything else defaults to `none`. */
export const SUBSTITUTABLE_CATEGORY_KEYS: readonly string[] = ['fresh-produce', 'dairy-eggs', 'bakery'];

/** Keys of the categories a product belongs to, resolved from the (cached) category tree, children included. */
export function categoryKeysOf(product: Pick<Product, 'categoryIds'>, tree: Category[]): string[] {
  const keyById = new Map<string, string>();
  const walk = (nodes: Category[]): void => {
    for (const node of nodes) {
      keyById.set(node.id, node.key);
      if (node.children) walk(node.children);
    }
  };
  walk(tree);
  return product.categoryIds.flatMap((id) => {
    const key = keyById.get(id);
    return key ? [key] : [];
  });
}

/** Chilled products or products in a perishable category: `allow-similar`; otherwise `none` (D-032). */
export function defaultSubstitutionPreference(product: Pick<Product, 'storage'>, categoryKeys: readonly string[] = []): SubstitutionPreference {
  if (product.storage === 'chilled') return 'allow-similar';
  return categoryKeys.some((k) => SUBSTITUTABLE_CATEGORY_KEYS.includes(k)) ? 'allow-similar' : 'none';
}
