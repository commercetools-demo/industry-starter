import { useTranslations } from 'next-intl';
import { cx } from './cx';

export interface TimelineStep {
  label: string;
  done: boolean;
}

export interface StatusTimelineProps {
  /** Accessible name of the list, for example "Order progress". */
  label: string;
  steps: TimelineStep[];
  className?: string;
}

/** Order progress: a 12 px dot per step, green when done. Done-ness is also stated in text. */
export function StatusTimeline({ label, steps, className }: StatusTimelineProps) {
  const t = useTranslations('ui.timeline');
  return (
    <ol aria-label={label} className={cx('m-0 grid list-none gap-3.5 p-0', className)}>
      {steps.map((step) => (
        <li key={step.label} data-done={step.done} className="flex items-center gap-3 text-sm text-navy-900">
          <span aria-hidden="true" className={cx('size-3 shrink-0 rounded-full', step.done ? 'bg-success-500' : 'bg-neutral-100')} />
          <span>{step.label}</span>
          <span className="sr-only">({step.done ? t('done') : t('pending')})</span>
        </li>
      ))}
    </ol>
  );
}
