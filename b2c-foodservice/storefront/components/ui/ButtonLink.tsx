import type { ComponentProps } from 'react';
import { Link } from '@/i18n/routing';
import { buttonClasses, type ButtonSize, type ButtonVariant } from './Button';

export interface ButtonLinkProps extends Omit<ComponentProps<typeof Link>, 'className'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
}

// External URLs: write an <a rel="noopener noreferrer"> with buttonClasses() at the call site.
export default function ButtonLink({ variant, size, block, ...props }: ButtonLinkProps) {
  return <Link className={buttonClasses({ variant, size, block })} {...props} />;
}
