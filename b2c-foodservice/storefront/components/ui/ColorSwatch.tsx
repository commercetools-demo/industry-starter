import { cn } from '@/lib/cn';

export interface ColorSwatchProps {
  /** Colour enum key from the product data (black, white, red, silver, cream, ...). */
  colour: string;
  label: string;
  size?: 'sm' | 'lg';
  selected?: boolean;
  onSelect?: () => void;
}

/** CSS value for the key: its `--swatch-<key>` token, or `--swatch-fallback` when none is defined. */
export function swatchBackground(colour: string): string {
  const key = /^[a-z0-9-]+$/.test(colour) ? colour : 'fallback';
  return `var(--swatch-${key}, var(--swatch-fallback))`;
}

export default function ColorSwatch({ colour, label, size = 'sm', selected = false, onSelect }: ColorSwatchProps) {
  const classes = cn(
    'inline-block shrink-0 rounded-pill border border-ink/12 p-0',
    size === 'lg' ? 'h-[42px] w-[42px]' : 'h-[14px] w-[14px]',
    selected && 'shadow-[0_0_0_2px_var(--canvas),0_0_0_4px_var(--ink)]',
    onSelect && 'transition-press hover:scale-105',
  );
  const style = { background: swatchBackground(colour) };
  if (onSelect) {
    return (
      <button type="button" aria-pressed={selected} aria-label={label} onClick={onSelect} className={classes} style={style} />
    );
  }
  return <span role="img" aria-label={label} className={classes} style={style} />;
}
