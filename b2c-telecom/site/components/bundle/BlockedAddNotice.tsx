'use client';

import type { ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import type { BlockedAdd } from '@/lib/types';
import { useReasonText } from './useReasonText';

type BlockedAddNoticeProps = {
  blocked: BlockedAdd;
  /** Name of the offer that could not be added. */
  name: string;
  /** Only for a conflict with a replace target: re-sends the add with `replaceLineId`. */
  onReplace?: () => void;
  onDismiss: () => void;
};

/**
 * Why an add was refused, exactly: every reason of the failing group, no override (D-022). A conflict offers "Replace X with Y" (the buyer
 * decides, nothing is swapped automatically) and "Keep X". Exported for the cards of workstream N.
 */
export function BlockedAddNotice({ blocked, name, onReplace, onDismiss }: BlockedAddNoticeProps): ReactElement {
  const t = useTranslations('bundle');
  const reasonText = useReasonText();
  const existing = blocked.replace?.removeOfferName;
  return (
    <div role="alert" className="flex flex-col gap-3 rounded-lg border border-danger bg-surface p-5">
      <p className="m-0 font-display text-md font-semibold">{t('blocked.title', { name })}</p>
      <ul className="m-0 flex list-none flex-col gap-1 p-0">
        {blocked.reasons.length > 0 ? (
          blocked.reasons.map((reason) => (
            <li key={`${reason.code}-${reason.offerKeys.join(',')}`} className="text-sm">
              {reasonText(reason)}
            </li>
          ))
        ) : (
          <li className="text-sm">{t('blocked.generic')}</li>
        )}
      </ul>
      <div className="flex flex-wrap gap-3">
        {blocked.kind === 'conflict' && blocked.replace && onReplace ? (
          <>
            <Button size="sm" onClick={onReplace}>
              {t('blocked.replace', { existing: existing ?? '', new: name })}
            </Button>
            <Button size="sm" variant="secondary" onClick={onDismiss}>
              {t('blocked.keep', { existing: existing ?? '' })}
            </Button>
          </>
        ) : (
          <Button size="sm" variant="secondary" onClick={onDismiss}>
            {t('blocked.dismiss')}
          </Button>
        )}
      </div>
    </div>
  );
}
