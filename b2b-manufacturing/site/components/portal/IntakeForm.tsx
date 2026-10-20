/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

'use client';
import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { submitIntake, useIntakes } from '@/hooks/useIntakes';
import { SendError } from '@/lib/fetcher';
import { ACCEPT_ATTRIBUTE, describeProblem, MAX_FILE_BYTES, MAX_FILES, OUTPUT_TYPES, validateIntake, type OutputType } from '@/lib/intake/validation';

const LABEL: Record<OutputType, 'outputCart' | 'outputShoppingList' | 'outputQuoteRequest'> = { Cart: 'outputCart', ShoppingList: 'outputShoppingList', QuoteRequest: 'outputQuoteRequest' };

/** Files and/or text, and what to create. On submit the list below shows the new row In progress and the form is cleared. */
export function IntakeForm() {
  const t = useTranslations('portal.intake');
  const { mutate } = useIntakes();
  const [outputType, setOutputType] = useState<OutputType>('Cart');
  const [files, setFiles] = useState<File[]>([]);
  const [listName, setListName] = useState('');
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const picker = useRef<HTMLInputElement>(null);

  function addFiles(event: ChangeEvent<HTMLInputElement>) {
    const next = [...files, ...Array.from(event.target.files ?? [])];
    event.target.value = '';
    const problem = validateIntake({ outputType, listName: 'x', text: 'x', files: next });
    if (problem && problem.code !== 'NothingToSubmit') { setError(describeProblem(problem)); return; }
    setError('');
    setFiles(next);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const problem = validateIntake({ outputType, listName, text, files });
    if (problem) { setError(describeProblem(problem)); return; }
    const body = new FormData();
    body.set('outputType', outputType);
    if (outputType === 'ShoppingList') body.set('listName', listName.trim());
    if (text.trim()) body.set('text', text.trim());
    for (const file of files) body.append('files', file);
    setBusy(true); setError('');
    try {
      await submitIntake(body);
      setFiles([]); setText(''); setListName('');
      await mutate();
      document.getElementById('intake-recent')?.focus();
    } catch (e) { setError(e instanceof SendError ? e.message : t('failed')); }
    finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit} noValidate style={{ display: 'grid', gap: 16, maxWidth: 560 }} aria-labelledby="intake-new">
      <h2 id="intake-new" style={{ font: '600 20px/1.2 var(--font-display)' }}>{t('formTitle')}</h2>
      <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <legend style={{ fontWeight: 500, fontSize: 14, marginBottom: 6 }}>{t('outputLegend')}</legend>
        {OUTPUT_TYPES.map((type) => (
          <label key={type} style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
            <input type="radio" name="outputType" value={type} checked={outputType === type} onChange={() => setOutputType(type)} />
            {t(LABEL[type])}
          </label>
        ))}
      </fieldset>
      {outputType === 'ShoppingList' ? <Field label={t('listName')} name="listName" value={listName} onChange={(e) => setListName(e.target.value)} required maxLength={100} /> : null}
      <div className="f" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label htmlFor="intake-files" style={{ fontWeight: 500, fontSize: 14 }}>{t('files', { max: MAX_FILES, size: MAX_FILE_BYTES / 1024 / 1024 })}</label>
        <input id="intake-files" ref={picker} type="file" multiple accept={ACCEPT_ATTRIBUTE} onChange={addFiles} aria-describedby="intake-types" disabled={files.length >= MAX_FILES} />
        <span id="intake-types" className="hint">{t('fileTypes')}</span>
        {files.length > 0 ? (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 4 }}>
            {files.map((file, index) => (
              <li key={`${file.name}-${index}`} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span>{file.name}</span>
                <Button type="button" variant="outline" small onClick={() => setFiles(files.filter((_f, i) => i !== index))} aria-label={t('remove', { name: file.name })}>×</Button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <Field as="textarea" label={t('text')} name="text" style={{ minHeight: 120 }} value={text} onChange={(e) => setText(e.target.value)} maxLength={10000} />
      {error ? <p className="em" role="alert">{error}</p> : null}
      <div><Button type="submit" disabled={busy}>{busy ? t('submitting') : t('submit')}</Button></div>
    </form>
  );
}
