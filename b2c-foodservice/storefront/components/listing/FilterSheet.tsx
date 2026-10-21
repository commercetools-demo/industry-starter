'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import FacetGroup from '@/components/listing/FacetGroup';
import Button from '@/components/ui/Button';
import Drawer from '@/components/ui/Drawer';
import Icon from '@/components/ui/Icon';
import { fetchJson } from '@/hooks/fetcher';
import { useRouter } from '@/i18n/routing';
import { FACET_BY_NAME, facetMode } from '@/lib/search/facet-config';
import { listingHref, serializeListingParams, toggleFacetValue, type ListingParams, type ListingScope } from '@/lib/search/params';
import type { FacetGroup as FacetGroupModel } from '@/lib/types';

/**
 * Filters button (visible under 900px) and the full-height left sheet. Selections are local draft state, so the grid does
 * not reload on each tap; a debounced `GET /api/search?...&countOnly=1` keeps "Show {n} results" current (the only client
 * search call). Apply navigates once with the final URL and closes; closing any other way discards the draft.
 */
export default function FilterSheet({
  groups, params, scope, basePath, apiScope, total, activeCount,
}: {
  groups: FacetGroupModel[];
  params: ListingParams;
  scope: ListingScope;
  basePath: string;
  apiScope: string;
  total: number;
  activeCount: number;
}) {
  const t = useTranslations('plp.filters');
  const locale = useLocale();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ListingParams>(params);
  const [count, setCount] = useState(total);

  const openSheet = () => {
    setDraft(params);
    setCount(total);
    setOpen(true);
  };

  const onToggle = (facet: string, value: string) => {
    const def = FACET_BY_NAME[facet];
    if (def) setDraft((d) => toggleFacetValue(d, facet, value, facetMode(def)));
  };

  const draftKey = serializeListingParams(draft, scope).toString();
  useEffect(() => {
    if (!open) return;
    const qs = new URLSearchParams(draftKey);
    qs.set('scope', apiScope);
    qs.set('countOnly', '1');
    qs.set('locale', locale);
    let cancelled = false;
    const timer = setTimeout(() => {
      fetchJson<{ total: number }>(`/api/search?${qs.toString()}`)
        .then((r) => {
          if (!cancelled) setCount(r.total);
        })
        .catch(() => {
          // keep the last known count; Apply still works
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [draftKey, open, apiScope, locale]);

  const shown = useMemo(
    () =>
      groups.map((g) => {
        const selected = draft.facets[g.name] ?? [];
        return { ...g, selectedCount: selected.length, options: g.options.map((o) => ({ ...o, selected: selected.includes(o.value) })) };
      }),
    [groups, draft.facets],
  );

  const apply = () => {
    setOpen(false);
    router.push(listingHref(basePath, { ...draft, page: 1 }, scope));
  };

  return (
    <>
      <button
        type="button"
        onClick={openSheet}
        className="transition-state hidden items-center gap-2 rounded-pill border border-line-2 bg-surface px-4 py-2 text-[13px] font-medium text-ink hover:border-ink max-stack:inline-flex"
      >
        <Icon name="filter" size={16} />
        {t('open')}
        {activeCount > 0 ? (
          <span aria-hidden="true" className="rounded-pill bg-accent px-1.5 font-mono text-[11px] text-surface">{activeCount}</span>
        ) : null}
        {activeCount > 0 ? <span className="sr-only">({activeCount})</span> : null}
      </button>
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        side="left"
        title={t('title')}
        footer={
          <Button block size="lg" onClick={apply}>
            {t('apply', { n: count })}
          </Button>
        }
      >
        {open ? shown.map((g) => <FacetGroup key={g.name} group={g} onToggle={onToggle} />) : null}
      </Drawer>
    </>
  );
}
