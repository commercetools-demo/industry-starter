'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { useReviewActions } from '@/hooks/useReviewActions';
import type { MyReviewView } from '@/lib/types';

/** Confirmation before a review is deleted (it cannot be undone). The card goes when the delete has succeeded. */
export default function DeleteReviewDialog({
  review,
  customerId,
  onClose,
  onDeleted,
}: {
  review: MyReviewView | null;
  customerId: string;
  onClose: () => void;
  onDeleted: (review: MyReviewView) => void;
}) {
  const t = useTranslations('reviews');
  const actions = useReviewActions(customerId);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const confirm = async () => {
    if (!review) return;
    setBusy(true);
    setFailed(false);
    try {
      await actions.remove(review.id, review.product?.id ?? null);
      onDeleted(review);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={review !== null} onClose={onClose} title={t('mine.deleteTitle')}>
      <p className="mb-5 mt-0 text-[14.5px] text-ink-2">{t('mine.deleteText')}</p>
      {failed ? <p role="alert" className="mb-4 mt-0 text-[13.5px] font-medium text-danger-text">{t('form.error')}</p> : null}
      <div className="flex flex-wrap gap-3">
        <Button loading={busy} onClick={() => void confirm()}>{t('mine.deleteConfirm')}</Button>
        <Button variant="ghost" onClick={onClose} disabled={busy}>{t('form.cancel')}</Button>
      </div>
    </Modal>
  );
}
