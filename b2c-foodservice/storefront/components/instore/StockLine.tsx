import { useTranslations } from 'next-intl';
import AvailabilityDot from '@/components/ui/AvailabilityDot';
import type { AvailabilityState } from '@/lib/types';

/**
 * Availability of a product in the In-store companion: a dot and a short phrase. `null` is "unknown" (the stock read failed): it
 * never claims stock. Text is always present, colour alone never carries the meaning.
 */
export default function StockLine({ state, className }: { state: AvailabilityState | null; className?: string }) {
  const t = useTranslations('instore.availability');
  const key = state ?? 'unknown';
  return (
    <span className={className ?? 'inline-flex items-center gap-2 text-[14px] font-medium text-ink-2'} data-state={key}>
      {state ? <AvailabilityDot state={state} /> : null}
      {t(key)}
    </span>
  );
}
