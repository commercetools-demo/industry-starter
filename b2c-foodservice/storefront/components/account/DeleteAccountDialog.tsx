'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import PasswordField from '@/components/auth/PasswordField';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { fetchJson, ApiError } from '@/hooks/fetcher';

/**
 * Delete account: states what is erased and what is retained BEFORE anything happens, and needs the password. The server
 * re-verifies it; a wrong password deletes nothing. `onDeleted` runs after the server answered 200.
 */
export default function DeleteAccountDialog({
  open,
  onClose,
  onDeleted,
}: {
  open: boolean;
  onClose: () => void;
  onDeleted: () => void | Promise<void>;
}) {
  const t = useTranslations('account.delete');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const close = () => {
    setPassword('');
    setError(null);
    onClose();
  };

  const submit = async () => {
    if (!password) return setError(t('wrong'));
    setError(null);
    setPending(true);
    try {
      await fetchJson('/api/account/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmPassword: password }),
      });
      setPassword('');
      await onDeleted();
    } catch (e) {
      if (e instanceof ApiError && e.code === 'current_password_invalid') setError(t('wrong'));
      else if (e instanceof ApiError && e.status === 429) setError(t('rateLimited'));
      else setError(t('failed'));
    } finally {
      setPending(false);
    }
  };

  return (
    <Modal open={open} onClose={close} title={t('title')}>
      <p className="m-0 mb-2 text-[14.5px] text-ink-2" data-testid="delete-erased">
        {t('erased')}
      </p>
      <p className="m-0 mb-5 text-[14.5px] text-ink-2" data-testid="delete-retained">
        {t('retained')}
      </p>
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <PasswordField
          id="delete-password"
          label={t('password')}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          error={error ?? undefined}
        />
        <div className="mt-2 flex flex-wrap justify-end gap-3">
          <Button variant="ghost" onClick={close}>
            {t('cancel')}
          </Button>
          <Button type="submit" loading={pending} className="bg-danger-text hover:bg-danger-text/90">
            {t('confirm')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
