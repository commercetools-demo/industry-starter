import { useFormatter, useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/Badge';
import type { DoctorAvailability } from '@/lib/types';

/**
 * Green "Available today" when the next free slot is today, blue "Next: Tue 14" later in the 7-day window,
 * nothing when there is no slot. The date is the clinic's calendar date, so it is formatted in UTC.
 */
export function AvailabilityBadge({ next }: { next: DoctorAvailability | null }) {
  const t = useTranslations('doctors.card');
  const format = useFormatter();
  if (!next) return null;
  if (next.isToday) return <Badge variant="ok">{t('availableToday')}</Badge>;
  const at = new Date(`${next.localDate}T12:00:00Z`);
  // Weekday then day ("Tue 14"): one Intl call would order them by locale rules ("14 Tue" in some runtimes).
  const date = `${format.dateTime(at, { weekday: 'short', timeZone: 'UTC' })} ${format.dateTime(at, { day: 'numeric', timeZone: 'UTC' })}`;
  return <Badge variant="info">{t('next', { date })}</Badge>;
}
