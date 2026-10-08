import { Link } from '@/i18n/routing';
import { cx } from './cx';

export interface SegmentItem {
  value: string;
  label: string;
  /** When every item has an href the control is a set of links (navigation); otherwise buttons. */
  href?: string;
  /** Button items only: not selectable (for example a mode the doctor does not offer). */
  disabled?: boolean;
}

export interface SegmentedControlProps {
  /** Accessible name of the group. */
  label: string;
  items: SegmentItem[];
  value: string;
  onChange?: (value: string) => void;
  className?: string;
}

const ITEM = 'rounded-sm px-4.5 py-2 font-display text-sm font-medium cursor-pointer';
const ACTIVE = 'bg-action text-action-label';
const IDLE = 'text-navy-700 hover:bg-brand-50';

/**
 * Two-to-four way choice (Remote / Office, ...). Links when items carry an `href` (current one has
 * `aria-current="page"`), toggle buttons otherwise (current one has `aria-pressed`). Every item is a
 * real focusable element; Enter/Space (buttons) or Enter (links) activate it.
 */
export function SegmentedControl({ label, items, value, onChange, className }: SegmentedControlProps) {
  return (
    <div role="group" aria-label={label} className={cx('inline-flex gap-1 rounded-md border border-border bg-surface p-1', className)}>
      {items.map((item) => {
        const active = item.value === value;
        const classes = cx(ITEM, active ? ACTIVE : IDLE);
        return item.href ? (
          <Link key={item.value} href={item.href} aria-current={active ? 'page' : undefined} className={classes}>
            {item.label}
          </Link>
        ) : (
          <button
            key={item.value}
            type="button"
            aria-pressed={active}
            disabled={item.disabled}
            onClick={() => onChange?.(item.value)}
            className={cx(classes, 'disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-transparent')}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
