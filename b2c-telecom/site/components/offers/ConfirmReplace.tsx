'use client';

import type { ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { ConfirmDialog } from '@/components/bundle/ConfirmDialog';
import type { PendingChoice } from './useOfferSelection';

type ConfirmReplaceProps = {
  pending: PendingChoice | null;
  /** The plan this card is about (the one being chosen or removed). */
  offerName: string;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * The two questions of a plan card, in M's native `<dialog>` (focus trap, Escape cancels): "Replace {held} with {next}?" (a plan the
 * buyer holds is in the way; D-022: the buyer decides, nothing is replaced silently) and "Remove {name} and its {n} add-ons?" (D-026).
 */
export function ConfirmReplace({ pending, offerName, onConfirm, onCancel }: ConfirmReplaceProps): ReactElement {
  const t = useTranslations('offers');
  const replacing = pending?.kind === 'replace';
  return (
    <ConfirmDialog
      open={pending !== null}
      title={replacing ? t('replace.title') : t('remove.title')}
      confirmLabel={replacing ? t('replace.confirm') : t('remove.confirm')}
      cancelLabel={replacing ? t('replace.cancel') : t('remove.cancel')}
      onConfirm={onConfirm}
      onCancel={onCancel}
    >
      {pending?.kind === 'replace' ? (
        <>
          <p className="m-0">{t('replace.body', { held: pending.heldName, next: offerName })}</p>
          {pending.dependentCount > 0 ? <p className="m-0 mt-3 text-sm text-text-muted">{t('replace.dependents', { count: pending.dependentCount })}</p> : null}
        </>
      ) : pending?.kind === 'remove' ? (
        <p className="m-0">{t('remove.body', { name: offerName, count: pending.dependentCount })}</p>
      ) : null}
    </ConfirmDialog>
  );
}
