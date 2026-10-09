'use client';
import { useId, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { LiveRegion } from '@/components/ui/LiveRegion';
import { useFocusTrap } from '@/hooks/useFocusTrap';

const IGNORE = () => undefined;

/**
 * Shows the one-time password of a new colleague. It is deliberately not dismissible by Escape or by clicking outside:
 * the only way out is "I've copied it", because the password cannot be looked up again.
 */
export function TeamPasswordDialog({ name, password, onDone }: { name: string; password: string; onDone: () => void }) {
  const t = useTranslations('portal.team');
  const titleId = useId();
  const box = useRef<HTMLDivElement>(null);
  const [note, setNote] = useState('');
  useFocusTrap(box, true, IGNORE);

  async function copy() {
    try {
      await navigator.clipboard.writeText(password);
      setNote(t('copied'));
    } catch {
      setNote(t('copyFailed'));
    }
  }

  return (
    <div className="modal on" data-testid="password-dialog">
      <div className="box" role="dialog" aria-modal="true" aria-labelledby={titleId} ref={box} tabIndex={-1}>
        <h2 id={titleId} style={{ font: '600 24px/1.2 var(--font-display)' }}>{t('passwordTitle')}</h2>
        <p>{t('passwordBody', { name })}</p>
        <div className="f" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label htmlFor={`${titleId}-pw`} style={{ fontWeight: 500, fontSize: 14 }}>{t('passwordLabel')}</label>
          <input id={`${titleId}-pw`} readOnly value={password} spellCheck={false} autoComplete="off" style={{ fontFamily: 'var(--font-mono)' }} onFocus={(e) => e.currentTarget.select()} />
        </div>
        <LiveRegion>{note}</LiveRegion>
        {note ? <p className="hint" role="presentation">{note}</p> : null}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Button variant="outline" onClick={copy}>{t('copy')}</Button>
          <Button onClick={onDone}>{t('passwordDone')}</Button>
        </div>
      </div>
    </div>
  );
}
