'use client';
import { useLocale, useTranslations } from 'next-intl';
import { useSwitchRegion } from '@/hooks/use-region';
import type { RegionOption } from '@/lib/types';

export interface RegionSwitcherProps {
  /** Regions the project can sell in (server-resolved, see lib/regions.ts). */
  regions: RegionOption[];
  className?: string;
}

/**
 * Header region and language control. It renders only when there is a choice (two or more valid regions): a
 * single-region shop (v1) has no switcher at all. Picking a region posts to `/api/locale` and reopens the same
 * page in the new locale (hooks/use-region.ts).
 */
export function RegionSwitcher({ regions, className }: RegionSwitcherProps) {
  // The router hooks live in the inner component, so a single-region shop mounts none of them.
  return regions.length < 2 ? null : <RegionSelect regions={regions} className={className} />;
}

function RegionSelect({ regions, className }: RegionSwitcherProps) {
  const t = useTranslations('region');
  const current = useLocale();
  const { switching, switchTo } = useSwitchRegion();
  return (
    <select
      aria-label={t('label')}
      value={regions.some((r) => r.locale === current) ? current : ''}
      disabled={switching}
      onChange={(event) => {
        const next = event.target.value;
        if (next && next !== current) void switchTo(next);
      }}
      className={`h-10 max-w-48 rounded-md border border-border bg-surface px-2 font-display text-sm text-navy-900 hover:bg-brand-50 disabled:opacity-60 max-nav:hidden ${className ?? ''}`}
    >
      {regions.some((r) => r.locale === current) ? null : <option value="" disabled />}
      {regions.map((region) => (
        <option key={region.locale} value={region.locale}>
          {region.label}
        </option>
      ))}
    </select>
  );
}
