'use client';

import { useTranslations } from 'next-intl';
import { Tag } from '@/components/ui/Tag';
import { isRecurrencePolicyKey } from '@/lib/config/features';
import type { CartLine } from '@/lib/types';

/**
 * Subscription badge of a bag line: "Repeats every 2 weeks" plus the plain-words price notice. Renders
 * nothing for a one-time line. A line only has recurrence info when the add route accepted it, so a disabled flag
 * needs no check here.
 */
export function RecurrenceBadge({ line }: { line: CartLine }) {
  const t = useTranslations('subscription');
  if (!line.recurrence) return null;
  const key = line.recurrence.policyKey;
  return (
    <>
      <Tag tone="accent-2">
        {t(isRecurrencePolicyKey(key) ? `badge.${key}` : 'badge.other')}
      </Tag>
      <p role="note" className="m-0 basis-full text-[13px] text-text/75">
        {t('priceNotice')}
      </p>
    </>
  );
}
