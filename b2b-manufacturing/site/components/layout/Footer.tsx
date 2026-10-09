import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { ROUTES } from '@/lib/site';
import { LocaleSwitch } from './LocaleSwitch';
import { Logo } from './Logo';
import { PortalButton } from './PortalButton';

export function Footer() {
  const t = useTranslations('footer');
  const plumbing = ['plumbing1', 'plumbing2', 'plumbing3', 'plumbing4'] as const;
  const waste = ['waste1', 'waste2', 'waste3', 'waste4'] as const;
  return (
    <footer>
      <div className="wrap">
        <div className="cols">
          <div><Logo subline={false} /><p style={{ color: 'var(--sl-on-dark-muted)', marginTop: 16, maxWidth: 320, fontSize: 14 }}>{t('blurb')}</p></div>
          <div><h2 className="foot-h">{t('plumbingHeading')}</h2>{plumbing.map((k) => <Link key={k} href={ROUTES.plumbing}>{t(k)}</Link>)}</div>
          <div><h2 className="foot-h">{t('wasteHeading')}</h2>{waste.map((k) => <Link key={k} href={ROUTES.waste}>{t(k)}</Link>)}</div>
          <div>
            <h2 className="foot-h">{t('companyHeading')}</h2>
            <Link href={ROUTES.about}>{t('about')}</Link>
            <Link href={ROUTES.quote}>{t('requestQuote')}</Link>
            <PortalButton as="link" />
            <Link href={ROUTES.privacy}>{t('privacy')}</Link>
          </div>
        </div>
        <div className="c"><div style={{ marginBottom: 12 }}><LocaleSwitch /></div>{t('copyright', { year: new Date().getFullYear() })}</div>
      </div>
    </footer>
  );
}
