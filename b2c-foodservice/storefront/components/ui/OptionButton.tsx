import type { ButtonHTMLAttributes, MouseEvent } from 'react';
import { cn } from '@/lib/cn';

export type OptionButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'disabled'> & {
  selected?: boolean;
} & (
    | { disabled: true; disabledReason: string }
    | { disabled?: false; disabledReason?: never }
  );

/**
 * Variant choice (pack size, grind, colour name). A disabled option stays focusable so its reason is
 * reachable: it is aria-disabled, struck through, and its click is ignored.
 */
export default function OptionButton({
  selected = false,
  disabled,
  disabledReason,
  className,
  onClick,
  type = 'button',
  ...props
}: OptionButtonProps) {
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (disabled) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  };
  return (
    <button
      type={type}
      aria-pressed={selected}
      aria-disabled={disabled ? 'true' : undefined}
      title={disabled ? disabledReason : undefined}
      onClick={handleClick}
      className={cn(
        'transition-state h-12 min-w-[52px] rounded-field border px-3 text-[14px] font-semibold',
        disabled
          ? 'cursor-not-allowed border-line-2 bg-canvas-2 text-ink-3 line-through'
          : selected
            ? 'border-ink bg-ink text-surface'
            : 'border-line-2 bg-surface text-ink hover:border-ink',
        className,
      )}
      {...props}
    />
  );
}
