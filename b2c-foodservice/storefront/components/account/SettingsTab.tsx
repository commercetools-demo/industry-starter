'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import DeleteAccountDialog from '@/components/account/DeleteAccountDialog';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { useToast } from '@/context/toast';
import { useAuthActions } from '@/hooks/useAuthActions';

/**
 * Settings holds one thing: Delete account (a muted red button that opens a confirmation). There are no email or
 * notification toggles because nothing is sent (D-032), and no SMS (Q-L-07).
 */
export default function SettingsTab() {
  const t = useTranslations('account');
  const toast = useToast();
  const { signOut } = useAuthActions();
  const [open, setOpen] = useState(false);

  return (
    <section aria-labelledby="settings-heading">
      <h2 id="settings-heading" className="m-0 mb-[18px] font-display text-[22px] font-bold text-ink">
        {t('settings.title')}
      </h2>
      <Card>
        <p className="m-0 mb-4 text-[14px] text-ink-3">{t('settings.noPrefs')}</p>
        <h3 className="m-0 mb-2 font-display text-[16px] font-semibold text-ink">{t('delete.section')}</h3>
        <p className="m-0 mb-4 text-[14px] text-ink-2">{t('delete.retained')}</p>
        <Button variant="ghost" className="text-danger-text" onClick={() => setOpen(true)}>
          {t('delete.button')}
        </Button>
      </Card>
      <DeleteAccountDialog
        open={open}
        onClose={() => setOpen(false)}
        onDeleted={async () => {
          setOpen(false);
          toast.show(t('delete.done'));
          await signOut();
        }}
      />
    </section>
  );
}
