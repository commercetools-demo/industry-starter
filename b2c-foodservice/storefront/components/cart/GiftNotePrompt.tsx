'use client';

import { useTranslations } from 'next-intl';
import Icon from '@/components/ui/Icon';
import { Link } from '@/i18n/routing';

/** A prompt only (Q-I-11): the gift note is stored and priced at checkout (workstream K). */
export default function GiftNotePrompt() {
  const t = useTranslations('cart.summary');
  return (
    <Link href="/checkout" className="mt-4 flex items-center gap-2.5 rounded-field bg-canvas-2 px-3.5 py-3 text-[13px] text-ink-2 no-underline hover:text-ink">
      <Icon name="gift" size={16} />
      {t('gift')}
    </Link>
  );
}
