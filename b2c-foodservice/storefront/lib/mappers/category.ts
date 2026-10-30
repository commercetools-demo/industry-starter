import type { Category as SDKCategory } from '@commercetools/platform-sdk';
import type { Category } from '@/lib/types';
import { cleanImageUrl } from '@/lib/ct/image-config';
import { getLocalizedString } from '@/lib/utils';

export function mapCategory(c: SDKCategory, locale: string): Category {
  const out: Category = {
    id: c.id,
    name: getLocalizedString(c.name, locale),
    slug: getLocalizedString(c.slug, locale),
    children: [],
  };
  if (c.key) out.key = c.key;
  if (c.description) out.description = getLocalizedString(c.description, locale);
  if (c.parent) out.parentId = c.parent.id;
  if (c.orderHint) out.orderHint = c.orderHint;
  const visibility = c.custom?.fields?.instoreVisibility;
  if (visibility === 'onlyInStore' || visibility === 'onlyOnline' || visibility === 'both' || visibility === 'none') out.instoreVisibility = visibility;
  const src = c.assets?.[0]?.sources[0]?.uri;
  if (src) out.imageUrl = cleanImageUrl(src);
  return out;
}

function sortNodes(nodes: Category[]): void {
  nodes.sort((a, b) => {
    const ha = a.orderHint ?? '';
    const hb = b.orderHint ?? '';
    if (ha !== hb) return ha < hb ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  for (const n of nodes) sortNodes(n.children);
}

/** Orphans (parent not in the list) become roots. Input objects are not mutated. */
export function buildCategoryTree(flat: Category[]): Category[] {
  const byId = new Map(flat.map((c) => [c.id, { ...c, children: [] as Category[] }]));
  const roots: Category[] = [];
  for (const node of byId.values()) {
    const parent = node.parentId ? byId.get(node.parentId) : undefined;
    (parent ? parent.children : roots).push(node);
  }
  sortNodes(roots);
  return roots;
}
