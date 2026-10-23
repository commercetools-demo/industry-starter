// Search response facets to the sidebar view model (workstream G, 3.7). Pure: labels come in through callbacks.
import { flattenTree } from '@/lib/category-tree';
import type { RawFacet } from '@/lib/search/build';
import { FACETS, facetApplies, facetMode, type CategoryRoot, type FacetDef } from '@/lib/search/facet-config';
import { toggleFacetValue, type ListingParams } from '@/lib/search/params';
import type { Category, FacetGroup, FacetOption } from '@/lib/types';

export interface FacetViewContext {
  root: CategoryRoot | null;
  /** attribute name -> enum key -> label (`getAttributeLabels`). */
  attributeLabels: Record<string, Record<string, string>>;
  tree: Category[];
  /** Category being browsed; its own entry is not offered as a facet option. */
  scopeCategoryId?: string;
  /** Label of a group, and of a value for facets whose labels are translated strings (price, rating, collection, intensity, booleans). */
  groupLabel: (facet: string) => string;
  valueLabel: (facet: string, value: string) => string;
  /** URL that toggles a value, or undefined when the caller renders buttons. */
  hrefFor?: (facet: string, value: string) => string;
}

const humanize = (key: string) => key.split('-').map((w) => (w ? w[0]!.toUpperCase() + w.slice(1) : w)).join(' ');
const attrName = (field: string) => /^variants\.attributes\.([^.]+)/.exec(field)?.[1];

function bucketsOf(raw: RawFacet[], def: FacetDef): Map<string, number> {
  const out = new Map<string, number>();
  if (def.name === 'collection') {
    for (const f of raw) {
      if (f.name.startsWith('collection:')) out.set(f.name.slice('collection:'.length), f.value ?? 0);
    }
    return out;
  }
  const facet = raw.find((f) => f.name === def.name);
  for (const b of facet?.buckets ?? []) out.set(String(b.key), b.count);
  return out;
}

function optionsFor(def: FacetDef, counts: Map<string, number>, selected: string[], ctx: FacetViewContext): FacetOption[] {
  const make = (value: string, label: string, extra: Partial<FacetOption> = {}): FacetOption => ({
    value, label, count: counts.get(value) ?? 0, selected: selected.includes(value), ...extra,
  });
  if (def.name === 'category') {
    const byId = new Map(flattenTree(ctx.tree).map((c) => [c.id, c]));
    const out: FacetOption[] = [];
    for (const [id, count] of counts) {
      const c = byId.get(id);
      if (!c?.key || !c.parentId || c.id === ctx.scopeCategoryId) continue;
      out.push({ value: c.key, label: c.name, count, selected: selected.includes(c.key) });
    }
    for (const v of selected) if (!out.some((o) => o.value === v)) out.push(make(v, flattenTree(ctx.tree).find((c) => c.key === v)?.name ?? v));
    return out.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  }
  if (def.control === 'grid' || def.kind === 'ranges' || def.name === 'collection') {
    return (def.values ?? []).map((v) => make(v, ctx.valueLabel(def.name, v)));
  }
  if (def.fieldType === 'boolean') {
    return counts.has('true') || selected.includes('true') ? [make('true', ctx.groupLabel(def.name))] : [];
  }
  const labels = ctx.attributeLabels[attrName(def.field) ?? ''] ?? {};
  const keys = new Set([...counts.keys(), ...selected]);
  const options = [...keys].map((k) =>
    make(k, labels[k] ?? (def.values ? humanize(k) : k), def.control === 'colour' ? { colour: k } : {}),
  );
  const order = def.values;
  return options.sort((a, b) =>
    order ? order.indexOf(a.value) - order.indexOf(b.value) : b.count - a.count || a.label.localeCompare(b.label),
  );
}

/**
 * Sidebar groups. A group with no non-zero bucket and no selection is dropped; zero-count unselected options stay and the
 * UI disables them ("Dead end avoided"). `href` toggles one option from the current URL state.
 */
export function buildFacetGroups(raw: RawFacet[], params: ListingParams, ctx: FacetViewContext): FacetGroup[] {
  const groups: FacetGroup[] = [];
  for (const def of FACETS) {
    if (!facetApplies(def, ctx.root)) continue;
    const selected = params.facets[def.name] ?? [];
    const options = optionsFor(def, bucketsOf(raw, def), selected, ctx);
    if (!options.some((o) => o.count > 0) && selected.length === 0) continue;
    const hrefFor = ctx.hrefFor;
    const withHref = hrefFor ? options.map((o) => ({ ...o, href: hrefFor(def.name, o.value) })) : options;
    groups.push({ name: def.name, label: ctx.groupLabel(def.name), control: def.control, options: withHref, selectedCount: selected.length });
  }
  return groups;
}

/** The params after toggling one option, for building option links (client and server). */
export const toggled = (p: ListingParams, def: FacetDef, value: string): ListingParams =>
  toggleFacetValue(p, def.name, value, facetMode(def));
