'use client';
import { useTranslations } from 'next-intl';
import { LinkButton, Button, type ButtonVariant } from '@/components/ui/Button';
import { useAccount } from '@/hooks/useAccount';
import { Link } from '@/i18n/routing';
import { usePortalDialog } from '@/context/portal-dialog';
import { ROUTES } from '@/lib/site';

/** "Client portal": opens the dialog when signed out, goes to the portal when signed in. Per-visitor, so it resolves after hydration. */
export function PortalButton({ variant = 'outline', small, as = 'button', className }: { variant?: ButtonVariant; small?: boolean; as?: 'button' | 'link'; className?: string }) {
  const t = useTranslations('chrome');
  const { account } = useAccount();
  const { open } = usePortalDialog();
  if (account) {
    return as === 'link'
      ? <Link href={ROUTES.account} className={className}>{t('clientPortal')}</Link>
      : <LinkButton variant={variant} small={small} href={ROUTES.account} className={className}>{t('clientPortal')}</LinkButton>;
  }
  if (as === 'link') return <button type="button" className={`link ${className ?? ''}`} onClick={open}>{t('clientPortal')}</button>;
  return <Button variant={variant} small={small} className={className} onClick={open}>{t('clientPortal')}</Button>;
}
