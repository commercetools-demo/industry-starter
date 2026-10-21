import { ICONS } from './icons';

export type IconName = keyof typeof ICONS;

interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
  fill?: 'none' | 'currentColor';
  /** When set, the icon is exposed as an image with this name; otherwise it is decorative. */
  title?: string;
}

export default function Icon({ name, size = 20, className, fill = 'none', title }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...(title ? { role: 'img' } : { 'aria-hidden': true })}
    >
      {title ? <title>{title}</title> : null}
      {ICONS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
