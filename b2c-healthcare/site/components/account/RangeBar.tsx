import type { LabFlag } from '@/lib/labs';
import { markerPosition } from '@/lib/labs';
import { cx } from '@/components/ui/cx';

export interface RangeBarProps {
  value: number;
  low: number;
  high: number;
  flag: LabFlag;
  /** Spoken description of the whole bar (value, range, flag): the bar itself is a picture. */
  label: string;
}

/**
 * Reference-range bar: an 8 px track with a marker clamped to 4-96 %. An out-of-range result turns the track danger-50.
 * Colour is never the only signal: the flag also appears as text next to the bar (flag badge) and in `label`.
 */
export function RangeBar({ value, low, high, flag, label }: RangeBarProps) {
  return (
    <div
      role="img"
      aria-label={label}
      data-flag={flag}
      className={cx('relative h-2 w-full min-w-30 rounded-full', flag === 'normal' ? 'bg-neutral-100' : 'bg-danger-50')}
    >
      <i
        data-marker
        className={cx('absolute top-1/2 block size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface', flag === 'normal' ? 'bg-navy-700' : 'bg-danger-500')}
        style={{ left: `${markerPosition(value, low, high)}%` }}
      />
    </div>
  );
}
