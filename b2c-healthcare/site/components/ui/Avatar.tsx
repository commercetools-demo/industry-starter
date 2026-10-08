import Image from 'next/image';
import { cx } from './cx';

export type AvatarSize = 'sm' | 'md' | 'lg';
export type AvatarTone = 'peach' | 'brand';

const SIZE_PX: Record<AvatarSize, number> = { sm: 36, md: 56, lg: 104 };
const SIZES: Record<AvatarSize, string> = {
  sm: 'size-9 text-xs',
  md: 'size-14 text-md',
  lg: 'size-26 text-3xl',
};
const TONES: Record<AvatarTone, string> = {
  peach: 'bg-(image:--gradient-peach) text-navy-900',
  brand: 'bg-brand-100 text-brand-900',
};

export interface AvatarProps {
  /** Initials shown when there is no portrait. */
  initials: string;
  /** Portrait (clean URL); falls back to the initials when absent. */
  src?: string | null;
  /** Name of the person, used as the portrait alt text. */
  name?: string;
  size?: AvatarSize;
  tone?: AvatarTone;
  className?: string;
}

/** Initials on peach, or a portrait. Decorative initials: the person's name is always next to it. */
export function Avatar({ initials, src, name = '', size = 'md', tone = 'peach', className }: AvatarProps) {
  const base = cx(
    'relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full font-display font-semibold',
    SIZES[size],
    TONES[tone],
    className,
  );
  if (src) {
    return (
      <span className={base} data-size={size}>
        <Image src={src} alt={name} width={SIZE_PX[size]} height={SIZE_PX[size]} unoptimized className="size-full object-cover" />
      </span>
    );
  }
  return (
    <span className={base} data-size={size} aria-hidden="true">
      {initials}
    </span>
  );
}
