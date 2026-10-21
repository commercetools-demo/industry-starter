import { cn } from '@/lib/cn';

export interface AvailabilityDotProps {
  state: 'in' | 'low' | 'out';
  /** Accessible name. Without it the dot is decorative and the text beside it carries the meaning. */
  label?: string;
}

const COLOUR = { in: 'bg-teal', low: 'bg-amber', out: 'bg-stone' } as const;

export default function AvailabilityDot({ state, label }: AvailabilityDotProps) {
  return (
    <span
      data-state={state}
      className={cn('inline-block h-[7px] w-[7px] shrink-0 rounded-pill', COLOUR[state])}
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
    />
  );
}
