import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link } from '@/i18n/routing';
import { cx } from './cx';

type Common = {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'icon';
  block?: boolean;
  className?: string;
  children?: ReactNode;
};
type AsButton = Common & Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof Common> & { href?: undefined };
type AsLink = Common & { href: string; 'aria-label'?: string; 'aria-current'?: 'page'; onClick?: () => void };

export type ButtonProps = AsButton | AsLink;

/** `<button>` by default, a locale-aware `<Link>` when `href` is given. */
export function Button(props: ButtonProps) {
  if (props.href !== undefined) {
    const { variant = 'primary', size, block, className, children, href, ...rest } = props;
    return (
      <Link href={href} className={buttonClasses(variant, size, block, className)} {...rest}>
        {children}
      </Link>
    );
  }
  const { variant = 'primary', size, block, className, children, type = 'button', ...rest } = props;
  return (
    <button type={type} className={buttonClasses(variant, size, block, className)} {...rest}>
      {children}
    </button>
  );
}

function buttonClasses(variant: string, size?: 'icon', block?: boolean, className?: string) {
  return cx('btn', `btn-${variant}`, size === 'icon' && 'btn-icon', block && 'btn-block', className);
}
