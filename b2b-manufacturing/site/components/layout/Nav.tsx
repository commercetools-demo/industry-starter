import { useTranslations } from 'next-intl';
import { LinkButton } from '@/components/ui/Button';
import { ROUTES } from '@/lib/site';
import { Logo } from './Logo';
import { MobileMenu } from './MobileMenu';
import { NavLinks } from './NavLinks';
import { PortalButton } from './PortalButton';
import { QuoteListLink } from './QuoteListLink';

export function Nav() {
  const t = useTranslations('chrome');
  return (
    <nav className="main" aria-label={t('primaryNav')}>
      <div className="wrap">
        <Logo />
        <NavLinks />
        <div className="actions">
          <QuoteListLink />
          <span className="account-slot hide-sm"><PortalButton small /></span>
          <LinkButton small href={ROUTES.quote} className="hide-sm">{t('requestQuote')}</LinkButton>
          <MobileMenu />
        </div>
      </div>
    </nav>
  );
}
