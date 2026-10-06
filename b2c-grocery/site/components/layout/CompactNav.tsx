'use client';

import { useState } from 'react';
import { Menu, Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Icon } from '@/components/ui/Icon';
import type { CountryConfig } from '@/lib/utils';
import { LocaleSwitcher } from './LocaleSwitcher';
import { PrimaryNav } from './PrimaryNav';

/** Below `desktop`: a menu button that opens a drawer with the same links, the search entry and the market picker. */
export function CompactNav({ markets, className }: { markets: CountryConfig[]; className?: string }) {
  const t = useTranslations('nav');
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <div className={className}>
      <Button variant="secondary" size="icon" aria-label={t('menu')} aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen(true)}>
        <Icon icon={Menu} size={17} />
      </Button>
      <Dialog open={open} onClose={close} title={t('menu')} placement="right">
        <PrimaryNav stacked onNavigate={close} />
        <Button href="/search" variant="secondary" className="justify-start gap-(--space-2)" onClick={close}>
          <Icon icon={Search} size={15} />
          {t('searchPill')}
        </Button>
        <LocaleSwitcher markets={markets} />
        <Button variant="secondary" onClick={close}>
          {t('closeMenu')}
        </Button>
      </Dialog>
    </div>
  );
}
