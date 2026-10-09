'use client';
import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Tag } from '@/components/ui/content';
import { Link } from '@/i18n/routing';
import type { QuoteListLine } from '@/lib/types';

export interface LineActions {
  onChange: (id: string, patch: { frequency?: string; note?: string }) => void;
  onRemove: (id: string) => void;
  busy: boolean;
}

/** Frequency choices of a line: "no preference", One-off, then what the service supports. */
export const frequencyOptions = (line: QuoteListLine): string[] => ['one-off', ...(line.frequencies ?? []).filter((f) => f !== 'one-off')];

export function NoteInput({ line, label, placeholder, onSave, id }: { line: QuoteListLine; label: string; placeholder: string; onSave: (note: string) => void; id: string }) {
  const [value, setValue] = useState(line.note ?? '');
  return (
    <>
      <label htmlFor={id} className="sr-only">{label}</label>
      <input id={id} type="text" value={value} maxLength={500} placeholder={placeholder} onChange={(e) => setValue(e.target.value)} onBlur={() => { if (value.trim() !== (line.note ?? '')) onSave(value); }} />
    </>
  );
}

/** The editable table of the quote list page. Never shows a price. */
export function QuoteLines({ lines, onChange, onRemove, busy }: { lines: QuoteListLine[] } & LineActions) {
  const t = useTranslations('quoteList');
  const base = useId();
  return (
    <div className="ql-table">
      <table>
        <caption className="sr-only">{t('tableLabel')}</caption>
        <thead><tr><th scope="col">{t('colService')}</th><th scope="col">{t('colCategory')}</th><th scope="col">{t('colFrequency')}</th><th scope="col">{t('colNotes')}</th><th scope="col"><span className="sr-only">{t('colRemove')}</span></th></tr></thead>
        <tbody>
          {lines.map((line) => {
            const available = line.available !== false;
            const fid = `${base}-f-${line.id}`; const nid = `${base}-n-${line.id}`;
            return (
              <tr key={line.id} data-testid="quote-line">
                <td>
                  {available ? <Link className="ql-name" href={`/${line.category ?? 'plumbing'}/${line.slug}`}>{line.name}</Link> : <span className="ql-name">{line.name}</span>}
                  {!available ? <span className="ql-flag" data-testid="unavailable">{t('unavailable')}</span> : null}
                  {!available ? <small style={{ display: 'block', color: 'var(--fg2)' }}>{t('unavailableHelp')}</small> : null}
                </td>
                <td>{line.category ? <Tag>{t(`categories.${line.category}`)}</Tag> : null}</td>
                <td>
                  {available ? (
                    <>
                      <label htmlFor={fid} className="ql-label">{t('frequencyFor', { name: line.name })}</label>
                      <select id={fid} aria-label={t('frequencyFor', { name: line.name })} value={line.frequency ?? ''} disabled={busy} onChange={(e) => onChange(line.id, { frequency: e.target.value })}>
                        <option value="">{t('frequencyNone')}</option>
                        {frequencyOptions(line).map((f) => <option key={f} value={f}>{t.has(`frequencies.${f}`) ? t(`frequencies.${f}`) : f}</option>)}
                      </select>
                    </>
                  ) : null}
                </td>
                <td>{available ? <><span className="ql-label" aria-hidden="true">{t('colNotes')}</span><NoteInput id={nid} line={line} label={t('noteFor', { name: line.name })} placeholder={t('notePlaceholder')} onSave={(note) => onChange(line.id, { note })} /></> : null}</td>
                <td><Button variant="outline" small disabled={busy} aria-label={t('removeFor', { name: line.name })} onClick={() => onRemove(line.id)}>{t('remove')}</Button></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
