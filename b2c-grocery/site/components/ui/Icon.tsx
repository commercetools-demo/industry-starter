import type { LucideIcon } from 'lucide-react';

type IconProps = { icon: LucideIcon; size?: number; className?: string; fill?: string };

/** Lucide wrapper with the Organic stroke width. Decorative: label the surrounding control instead. */
export function Icon({ icon: Glyph, size = 16, className, fill }: IconProps) {
  return <Glyph size={size} strokeWidth={2.75} aria-hidden="true" className={className} fill={fill} />;
}
