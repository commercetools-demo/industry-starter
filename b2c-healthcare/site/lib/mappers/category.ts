import type { Category as CtCategory } from '@commercetools/platform-sdk';
import type { Category } from '@/lib/types';
import { mapLocalizedString } from '@/lib/mappers';

/** Flat commercetools categories -> nested tree, roots and siblings sorted by orderHint then key. */
export function mapCategoryTree(categories: CtCategory[]): Category[] {
  const nodes = new Map<string, Category>();
  for (const c of categories) {
    nodes.set(c.id, {
      id: c.id,
      key: c.key ?? c.id,
      name: mapLocalizedString(c.name),
      slug: mapLocalizedString(c.slug),
      parentId: c.parent?.id ?? null,
      orderHint: c.orderHint,
      children: [],
    });
  }
  const roots: Category[] = [];
  for (const node of nodes.values()) {
    const parent = node.parentId ? nodes.get(node.parentId) : undefined;
    (parent ? parent.children : roots).push(node);
  }
  const sort = (list: Category[]): void => {
    list.sort((a, b) => a.orderHint.localeCompare(b.orderHint) || a.key.localeCompare(b.key));
    list.forEach((n) => sort(n.children));
  };
  sort(roots);
  return roots;
}
