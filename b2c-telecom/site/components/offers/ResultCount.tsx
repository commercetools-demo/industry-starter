import type { ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import type { CountNoun } from '@/lib/listing/kinds';

/** "13 add-ons", right-aligned in the filter bar; a status region so a change is announced. */
export function ResultCount({ noun, count }: { noun: CountNoun; count: number }): ReactElement {
  const t = useTranslations('plp.count');
  return (
    <p role="status" className="m-0 ml-auto font-display text-md font-semibold text-brand-900">
      {t(noun, { count })}
    </p>
  );
}
