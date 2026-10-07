'use client';

import { useState, type FormEvent, type ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { LIST_NAME_MAX } from '@/lib/config/lists';

type ListNameFormProps = {
  initial?: string;
  submitLabel: string;
  /** Resolves when saved; a rejection shows `errorText` (a thrown message of the caller) under the field. */
  onSubmit: (name: string) => Promise<void>;
  onCancel: () => void;
};

/** The name field of a new or renamed list. A name of 1 to 60 characters; an empty one is refused here and nothing is sent. */
export function ListNameForm({ initial = '', submitLabel, onSubmit, onCancel }: ListNameFormProps): ReactElement {
  const t = useTranslations('account.lists');
  const [name, setName] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 1 || trimmed.length > LIST_NAME_MAX) {
      setError(t('errors.invalidName', { max: LIST_NAME_MAX }));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSubmit(trimmed);
    } catch (failure) {
      setError(failure instanceof Error && failure.message ? failure.message : t('errors.generic'));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} noValidate className="flex flex-wrap items-start gap-3">
      <Field label={t('name.label')} error={error ?? undefined} className="min-w-60 flex-1">
        <Input value={name} onChange={(event) => setName(event.target.value)} maxLength={LIST_NAME_MAX * 2} autoFocus autoComplete="off" />
      </Field>
      <div className="flex gap-3 pt-8">
        <Button type="submit" loading={busy} disabled={busy}>
          {submitLabel}
        </Button>
        <Button variant="ghost" onClick={onCancel} disabled={busy}>
          {t('name.cancel')}
        </Button>
      </div>
    </form>
  );
}
