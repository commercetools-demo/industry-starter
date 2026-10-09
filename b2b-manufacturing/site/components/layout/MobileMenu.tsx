'use client';
import { useCallback, useId, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { LinkButton, Button } from '@/components/ui/Button';
import { Link, usePathname } from '@/i18n/routing';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { usePortalDialog } from '@/context/portal-dialog';
import { inSection, ROUTES } from '@/lib/site';
import { SECTIONS } from './NavLinks';

/** Under 900 px the links go into a full-width panel behind a menu button (a design gap, SO-01). */
export function MobileMenu() {
  const t = useTranslations('chrome');
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const id = useId();
  const pathname = usePathname();
  const { open: openPortal } = usePortalDialog();
  const close = useCallback(() => setOpen(false), []);
  useFocusTrap(panel, open, close);
  return (
    <>
      <button type="button" ref={button} className="btn o sm menu-btn" aria-expanded={open} aria-controls={id} onClick={() => setOpen((v) => !v)}>
        {open ? t('menuClose') : t('menuOpen')}
      </button>
      <div id={id} ref={panel} className={`menu-panel${open ? ' on' : ''}`} hidden={!open} aria-label={t('menuLabel')} role="dialog" aria-modal="true">
        {SECTIONS.map(({ key, href }) => <Link key={key} href={href} onClick={close} aria-current={inSection(pathname, href) ? 'page' : undefined}>{t(key)}</Link>)}
        <Button variant="outline" onClick={() => { close(); openPortal(); }}>{t('clientPortal')}</Button>
        <LinkButton href={ROUTES.quote} onClick={close}>{t('requestQuote')}</LinkButton>
      </div>
    </>
  );
}
