import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { Link } from '@/i18n/routing';
import type { Dir } from '@/lib/portal/list-query';

export type Tone = 'info' | 'success' | 'warn' | 'danger';
const TONE: Record<Tone, { bg: string; fg: string; border: string }> = {
  info: { bg: 'var(--sl-info-bg)', fg: 'var(--sl-info-fg)', border: 'var(--sl-info-fg)' },
  success: { bg: 'var(--sl-success-bg)', fg: 'var(--sl-success-fg)', border: 'var(--sl-success-fg)' },
  warn: { bg: 'var(--sl-warn-bg)', fg: 'var(--sl-ink)', border: 'var(--sl-warn-border)' },
  danger: { bg: 'var(--sl-danger-bg)', fg: 'var(--sl-danger-fg)', border: 'var(--sl-danger-fg)' },
};
/** Marks that differ by tone, so status never rests on colour alone (the text is always there too). */
const MARK: Record<Tone, string> = { info: '○', success: '✓', warn: '◐', danger: '!' };

/** Status badge: the status as text plus the tone's colours and a mark. `data-tone` lets tests and styles find the tone. */
export function StatusBadge({ tone, children }: { tone: Tone; children: ReactNode }) {
  const c = TONE[tone];
  return (
    <span data-tone={tone} style={{ display: 'inline-flex', gap: 6, alignItems: 'center', background: c.bg, color: c.fg, border: `1px solid ${c.border}`, font: '600 12px var(--font-sans)', padding: '3px 8px', borderRadius: 'var(--r-2, 4px)', whiteSpace: 'nowrap' }}>
      <span aria-hidden="true">{MARK[tone]}</span>{children}
    </span>
  );
}

export interface Column { key: string; label: string; sortable?: boolean }
export interface Row { id: string; cells: ReactNode[] }

/** A real table with a caption; sortable headers are links whose URL carries the sort (`aria-sort` on the header). */
export function DataTable({ caption, columns, rows, sort, dir, sortHref }: { caption: string; columns: Column[]; rows: Row[]; sort: string; dir: Dir; sortHref: (column: string, dir: Dir) => string }) {
  const t = useTranslations('portal.lists');
  return (
    <div style={{ overflowX: 'auto' }}>
      <table>
        <caption style={{ textAlign: 'left', font: '600 16px var(--font-sans)', padding: '0 0 12px' }}>{caption}</caption>
        <thead>
          <tr>
            {columns.map((c) => {
              const active = c.key === sort;
              return (
                <th key={c.key} scope="col" aria-sort={c.sortable ? (active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none') : undefined}>
                  {c.sortable ? (
                    <Link href={sortHref(c.key, active && dir === 'asc' ? 'desc' : 'asc')} aria-label={t('sortBy', { column: c.label })} style={{ color: 'inherit' }}>
                      {c.label}{active && <span aria-hidden="true"> {dir === 'asc' ? '▲' : '▼'}</span>}
                    </Link>
                  ) : c.label}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>{rows.map((r) => <tr key={r.id}>{r.cells.map((cell, i) => <td key={columns[i]?.key ?? i}>{cell}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

export interface FilterField { name: string; label: string; value: string; options?: { value: string; label: string }[]; type?: 'date' | 'month'; all?: string }

/** A GET form (works without JavaScript); the chosen filters end up in the URL. The sort stays when filters change. */
export function FilterForm({ fields, hidden, resetHref }: { fields: FilterField[]; hidden: Record<string, string>; resetHref: string }) {
  const t = useTranslations('portal.lists');
  return (
    <form method="get" aria-label={t('filters')} style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 24 }}>
      {Object.entries(hidden).filter(([, v]) => v).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      {fields.map((f) => (
        <label key={f.name} className="f" style={{ minWidth: 180 }}>
          {f.label}
          {f.options ? (
            <select name={f.name} defaultValue={f.value}>
              {f.all !== undefined && <option value="">{f.all}</option>}
              {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          ) : <input type={f.type ?? 'text'} name={f.name} defaultValue={f.value} />}
        </label>
      ))}
      <button type="submit" className="btn sm">{t('apply')}</button>
      <Link href={resetHref} className="btn o sm">{t('reset')}</Link>
    </form>
  );
}

/** The portal serves seeded sample data (D5): say so on every list. */
export function DemoNote() {
  const t = useTranslations('portal.lists');
  return <p className="hint" style={{ marginTop: 24 }}>{t('demo')}</p>;
}

export function DownloadLink({ href, label, children }: { href?: string; label: string; children: ReactNode }) {
  return href ? <a href={href} download aria-label={label}>{children}</a> : <span>—</span>;
}
