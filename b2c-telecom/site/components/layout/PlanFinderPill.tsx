'use client';

import type { ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { Pill } from '@/components/ui/Pill';
import { usePathname } from '@/i18n/routing';
import { PLAN_FINDER_PATH } from '@/lib/config/nav';
import { isPlanFinderPath } from '@/lib/nav';

/** The plan finder's header and drawer item: a static entry (it does not come from the category tree, so it survives a catalog outage). */
export function PlanFinderPill({ onNavigate, className }: { onNavigate?: () => void; className?: string }): ReactElement {
  const t = useTranslations('shell');
  const active = isPlanFinderPath(usePathname());
  return (
    <Pill href={PLAN_FINDER_PATH} active={active} aria-current={active ? 'page' : undefined} {...(onNavigate ? { onClick: onNavigate } : {})} {...(className ? { className } : {})}>
      {t('nav.planFinder')}
    </Pill>
  );
}
