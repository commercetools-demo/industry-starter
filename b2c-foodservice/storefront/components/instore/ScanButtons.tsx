'use client';

import { useTranslations } from 'next-intl';
import Icon from '@/components/ui/Icon';
import { useScanner } from '@/components/instore/scan/scanner-context';
import { cn } from '@/lib/cn';

/** The round camera button that floats above every page, reachable with a thumb (workstream R). 64 px. */
export function ScanFab() {
  const t = useTranslations('instore.scan');
  const { open, isOpen } = useScanner();
  return (
    <button
      type="button"
      onClick={open}
      aria-label={t('open')}
      aria-haspopup="dialog"
      aria-expanded={isOpen}
      data-testid="scan-fab"
      className="instore-fab transition-press flex h-16 w-16 items-center justify-center rounded-pill border-0 bg-accent text-surface shadow-lg hover:bg-accent-press active:scale-95"
    >
      <Icon name="camera" size={30} />
    </button>
  );
}

/** The camera button in the header: always visible, 48 px. */
export function ScanHeaderButton() {
  const t = useTranslations('instore.scan');
  const { open } = useScanner();
  return (
    <button
      type="button"
      onClick={open}
      aria-label={t('open')}
      aria-haspopup="dialog"
      data-testid="scan-header-button"
      className="transition-press flex h-12 w-12 shrink-0 items-center justify-center rounded-pill border-0 bg-ink text-surface hover:bg-ink/90"
    >
      <Icon name="camera" size={24} />
    </button>
  );
}

/** The wide button of the home page: icon, words and a hint. 72 px. */
export function ScanHeroButton({ className }: { className?: string }) {
  const t = useTranslations('instore.home');
  const { open } = useScanner();
  return (
    <button
      type="button"
      onClick={open}
      aria-haspopup="dialog"
      data-testid="scan-hero-button"
      className={cn(
        'transition-press flex min-h-[76px] w-full items-center gap-4 rounded-card border-0 bg-accent px-5 py-3 text-left text-surface hover:bg-accent-press active:scale-[0.99]',
        className,
      )}
    >
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-pill bg-surface/20">
        <Icon name="barcode" size={28} />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="font-display text-[19px] font-bold leading-tight">{t('scan')}</span>
        <span className="text-[14px] leading-snug text-surface">{t('scanHint')}</span>
      </span>
    </button>
  );
}
