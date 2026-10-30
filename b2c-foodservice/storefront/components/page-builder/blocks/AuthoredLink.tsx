import type { ReactNode } from 'react';
import { buttonClasses, type ButtonVariant } from '@/components/ui/Button';
import { Link } from '@/i18n/routing';
import { authoredLink } from '@/lib/page-builder/authored';

/**
 * A button-looking link whose target an author typed. Internal paths go through the locale-aware `Link` (navigation stays
 * native and keeps the shopper's market); external ones open as plain anchors. A value that is not a safe link renders nothing,
 * so a button never points at `javascript:` or at a half-typed address.
 */
export default function AuthoredLink({ href, children, variant = 'ink' }: { href: unknown; children: ReactNode; variant?: ButtonVariant }) {
  const target = authoredLink(href);
  if (!target) return null;
  const className = buttonClasses({ variant });
  if (target.kind === 'internal') {
    return (
      <Link href={target.href} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <a href={target.href} className={className} rel="noopener noreferrer">
      {children}
    </a>
  );
}
