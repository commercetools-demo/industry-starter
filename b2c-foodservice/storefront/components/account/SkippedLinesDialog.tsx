'use client';

import { useTranslations } from 'next-intl';
import Button from '@/components/ui/Button';
import ButtonLink from '@/components/ui/ButtonLink';
import Modal from '@/components/ui/Modal';
import type { ReorderSkipReason } from '@/lib/types';

/** Names every line that could not be added with its reason, then offers View bag. Shared by Buy again and Add all to bag. */
export default function SkippedLinesDialog({
  open,
  title,
  lines,
  onClose,
}: {
  open: boolean;
  title: string;
  lines: { key: string; name: string; reason: ReorderSkipReason }[];
  onClose: () => void;
}) {
  const t = useTranslations('account.orders.reorder');
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <ul className="m-0 grid list-none gap-3 p-0" data-testid="skipped-lines">
        {lines.map((s) => (
          <li key={s.key} className="flex flex-wrap items-baseline justify-between gap-2 text-[14.5px]">
            <span className="font-semibold text-ink">{s.name}</span>
            <span className="text-ink-3">{t(`reason.${s.reason}`)}</span>
          </li>
        ))}
      </ul>
      <div className="mt-5 flex flex-wrap justify-end gap-3">
        <Button variant="ghost" onClick={onClose}>
          {t('close')}
        </Button>
        <ButtonLink href="/cart" onClick={onClose}>
          {t('viewBag')}
        </ButtonLink>
      </div>
    </Modal>
  );
}
