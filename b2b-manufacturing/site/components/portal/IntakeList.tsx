/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

'use client';
import { useTranslations } from 'next-intl';
import { useIntakes } from '@/hooks/useIntakes';
import type { IntakeRecord } from '@/lib/intake/types';
import { formatDate } from './Overview';
import { StatusBadge, type Tone } from './ListParts';

const TONE: Record<IntakeRecord['status'], Tone> = { processing: 'info', done: 'success', failed: 'danger' };

/** Recent intakes of the company, newest first. Rows are read-only for now (actions are decided once there is data). */
export function IntakeList() {
  const t = useTranslations('portal.intake');
  const { intakes, isLoading, failed } = useIntakes();

  const result = (i: IntakeRecord) => {
    if (i.status === 'processing') return null;
    if (i.status === 'failed') return <span className="em">{t.has(`error.${i.errorCode}`) ? t(`error.${i.errorCode}`) : (i.errorMessage ?? '')}</span>;
    return (
      <>
        {i.entity ? <span className="num">{t('createdEntity', { type: t(`type.${i.entity.type}`), id: i.entity.id })}</span> : null}
        {i.entity?.cartId ? <div>{t('quoteCart', { id: i.entity.cartId })}</div> : null}
        {i.warnings.map((w) => <div key={w} className="hint">{t.has(`warning.${w}`) ? t(`warning.${w}`) : w}</div>)}
      </>
    );
  };

  return (
    <section aria-labelledby="intake-recent">
      <h2 id="intake-recent" tabIndex={-1} style={{ font: '600 20px/1.2 var(--font-display)', marginBottom: 16 }}>{t('recent')}</h2>
      {isLoading ? <p role="status">{t('loading')}</p> : null}
      {failed ? <p className="em" role="alert">{t('loadFailed')}</p> : null}
      {!isLoading && !failed && intakes.length === 0 ? <div className="card"><div className="b"><p>{t('empty')}</p></div></div> : null}
      {intakes.length > 0 ? (
        <div style={{ overflowX: 'auto' }}>
          <table>
            <caption className="sr-only">{t('caption')}</caption>
            <thead>
              <tr>
                {(['created', 'type', 'input', 'status', 'result'] as const).map((c) => <th key={c} scope="col">{t(`col.${c}`)}</th>)}
              </tr>
            </thead>
            <tbody>
              {intakes.map((i) => (
                <tr key={i.id}>
                  <td>{formatDate(i.createdAt)}</td>
                  <td>{t(`type.${i.outputType}`)}{i.listName ? `: ${i.listName}` : ''}</td>
                  <td>{i.fileNames.length > 0 ? i.fileNames.join(', ') : t('textOnly')}</td>
                  <td><StatusBadge tone={TONE[i.status]}>{t(`status.${i.status}`)}</StatusBadge></td>
                  <td>{result(i)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
