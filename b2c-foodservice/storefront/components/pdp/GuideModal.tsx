'use client';

import { useTranslations } from 'next-intl';
import Modal from '@/components/ui/Modal';
import { Link } from '@/i18n/routing';

export type GuideKind = 'compat' | 'grind';

const GRIND_ROWS = ['whole-bean', 'espresso', 'filter', 'french-press', 'moka'] as const;

interface Props {
  kind: GuideKind;
  open: boolean;
  onClose: () => void;
  /** Category slugs of the two pod systems for the browse links. */
  links?: { original?: string; vertuo?: string };
}

/**
 * Compatibility guide (which capsules fit which machine) and grind guide (grind to brew method), both static tables from
 * the catalogue strings (copy approved in SO-x1). The Modal atom traps focus, closes on Escape and returns focus to the opener.
 */
export default function GuideModal({ kind, open, onClose, links }: Props) {
  const t = useTranslations('pdp.guide');
  if (kind === 'grind') {
    return (
      <Modal open={open} onClose={onClose} title={t('grind.title')}>
        <p className="m-0 mb-4 text-[14px] text-ink-2">{t('grind.intro')}</p>
        <table className="w-full border-collapse text-left text-[14px]">
          <thead>
            <tr className="border-b border-line-2 text-[12px] uppercase tracking-[0.08em] text-ink-3">
              <th scope="col" className="py-2 pr-4 font-medium">{t('grind.grind')}</th>
              <th scope="col" className="py-2 font-medium">{t('grind.methods')}</th>
            </tr>
          </thead>
          <tbody>
            {GRIND_ROWS.map((g) => (
              <tr key={g} className="border-b border-line align-top">
                <th scope="row" className="py-2.5 pr-4 font-semibold capitalize">{g.replace(/-/g, ' ')}</th>
                <td className="py-2.5 text-ink-2">{t(`grind.rows.${g}`)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Modal>
    );
  }
  return (
    <Modal open={open} onClose={onClose} title={t('compat.title')}>
      <p className="m-0 mb-4 text-[14px] text-ink-2">{t('compat.intro')}</p>
      <table className="w-full border-collapse text-left text-[14px]">
        <thead>
          <tr className="border-b border-line-2 text-[12px] uppercase tracking-[0.08em] text-ink-3">
            <th scope="col" className="py-2 pr-4 font-medium">{t('compat.machine')}</th>
            <th scope="col" className="py-2 font-medium">{t('compat.takes')}</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-line align-top">
            <th scope="row" className="py-2.5 pr-4 font-semibold">{t('compat.rowOriginal')}</th>
            <td className="py-2.5 text-ink-2">{t('compat.takesOriginal')}</td>
          </tr>
          <tr className="border-b border-line align-top">
            <th scope="row" className="py-2.5 pr-4 font-semibold">{t('compat.rowVertuo')}</th>
            <td className="py-2.5 text-ink-2">{t('compat.takesVertuo')}</td>
          </tr>
          <tr className="border-b border-line align-top">
            <th scope="row" className="py-2.5 pr-4 font-semibold">{t('compat.rowNone')}</th>
            <td className="py-2.5 text-ink-2">{t('compat.takesNone')}</td>
          </tr>
        </tbody>
      </table>
      <p className="mb-0 mt-4 text-[13.5px] font-medium text-ink">{t('compat.note')}</p>
      {links?.original || links?.vertuo ? (
        <p className="mb-0 mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[14px]">
          {links.original ? (
            <Link href={`/category/${encodeURIComponent(links.original)}`} className="text-accent underline underline-offset-2">
              {t('compat.browseOriginal')}
            </Link>
          ) : null}
          {links.vertuo ? (
            <Link href={`/category/${encodeURIComponent(links.vertuo)}`} className="text-accent underline underline-offset-2">
              {t('compat.browseVertuo')}
            </Link>
          ) : null}
        </p>
      ) : null}
    </Modal>
  );
}
