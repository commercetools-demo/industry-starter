'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import DeleteReviewDialog from '@/components/reviews/DeleteReviewDialog';
import MyReviewCard from '@/components/reviews/MyReviewCard';
import ReviewForm from '@/components/reviews/ReviewForm';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { useToast } from '@/context/toast';
import { useMyReviews } from '@/hooks/useMyReviews';
import { useAccount } from '@/hooks/useAccount';
import { authorName } from '@/lib/reviews/validate';
import type { MyReviewView } from '@/lib/types';

/**
 * The Reviews tab of the account: the customer's own reviews, newest first, with edit (the same form in a dialog) and
 * delete (with confirmation). A failure here shows inside this panel only; the other account panels are unaffected.
 */
export default function MyReviews() {
  const t = useTranslations('reviews.mine');
  const tf = useTranslations('reviews');
  const toast = useToast();
  const { customer } = useAccount();
  const my = useMyReviews();
  const [editing, setEditing] = useState<MyReviewView | null>(null);
  const [deleting, setDeleting] = useState<MyReviewView | null>(null);

  return (
    <section aria-labelledby="my-reviews-heading" data-testid="my-reviews">
      <h2 id="my-reviews-heading" className="m-0 mb-5 font-display text-[22px] font-bold text-ink">{t('title')}</h2>
      {my.isLoading ? (
        <p className="m-0 text-[14px] text-ink-3" role="status">{tf('loading')}</p>
      ) : my.isError ? (
        <div data-testid="my-reviews-error">
          <p className="m-0 mb-3 text-[14px] text-ink-2">{t('loadError')}</p>
          <Button variant="ghost" onClick={() => void my.mutate()}>{tf('retry')}</Button>
        </div>
      ) : my.reviews.length === 0 ? (
        <p className="m-0 text-[14.5px] text-ink-2">{t('empty')}</p>
      ) : (
        <ul className="m-0 list-none p-0">
          {my.reviews.map((r) => (
            <MyReviewCard key={r.id} review={r} onEdit={setEditing} onDelete={setDeleting} />
          ))}
        </ul>
      )}

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={tf('form.editTitle')}>
        {editing && customer ? (
          <ReviewForm
            bare
            key={editing.id}
            productId={editing.product?.id ?? ''}
            customerId={customer.id}
            authorName={authorName(customer.firstName, customer.lastName)}
            existing={editing}
            onCancel={() => setEditing(null)}
            onSaved={() => {
              setEditing(null);
              toast.show(tf('form.edited'));
            }}
          />
        ) : null}
      </Modal>

      {customer ? (
        <DeleteReviewDialog
          review={deleting}
          customerId={customer.id}
          onClose={() => setDeleting(null)}
          onDeleted={() => {
            setDeleting(null);
            toast.show(t('deleted'));
          }}
        />
      ) : null}
    </section>
  );
}
