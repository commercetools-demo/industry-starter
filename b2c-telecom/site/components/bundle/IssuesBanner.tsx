'use client';

import type { ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import type { BundleIssue, CartLine } from '@/lib/types';
import { useReasonText } from './useReasonText';

type IssuesBannerProps = {
  issues: BundleIssue[];
  lines: CartLine[];
  busy?: boolean;
  onRemove: (lineId: string) => void;
};

/**
 * Rules that changed after the line was added (J/K revalidation) and data gaps. Each issue names the line and says why; the buyer's way out
 * is always to remove the line (or to choose equipment). There is no override (D-022).
 */
export function IssuesBanner({ issues, lines, busy = false, onRemove }: IssuesBannerProps): ReactElement | null {
  const t = useTranslations('bundle');
  const reasonText = useReasonText();
  if (issues.length === 0) return null;
  return (
    <div role="alert" className="flex flex-col gap-4 rounded-xl border border-danger bg-surface p-6">
      <h2 className="m-0 font-display text-lg font-bold text-danger">{t('issue.title')}</h2>
      <ul className="m-0 flex list-none flex-col gap-4 p-0">
        {issues.map((issue) => {
          const line = lines.find((candidate) => candidate.id === issue.lineId);
          const name = line?.name ?? issue.offerKey ?? '';
          return (
            <li key={`${issue.lineId ?? issue.code}-${issue.code}`} className="flex flex-wrap items-center justify-between gap-4">
              <div className="min-w-48 flex-1">
                <div className="font-display text-md font-semibold">{name}</div>
                {issue.reasons.length > 0 ? (
                  issue.reasons.map((reason) => (
                    <p key={`${reason.code}-${reason.offerKeys.join(',')}`} className="m-0 text-sm">
                      {reasonText(reason)}
                    </p>
                  ))
                ) : (
                  <p className="m-0 text-sm">{t('issue.generic')}</p>
                )}
              </div>
              {issue.resolution === 'choose-equipment' && issue.lineId ? (
                <Button href={`/shop/add-ons?for=${encodeURIComponent(issue.lineId)}`} variant="secondary" size="sm">
                  {t('line.change')}
                </Button>
              ) : issue.lineId ? (
                <Button variant="secondary" size="sm" disabled={busy} onClick={() => onRemove(issue.lineId as string)}>
                  {t('issue.removeLine', { name })}
                </Button>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
