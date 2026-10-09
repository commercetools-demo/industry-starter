/** Filtering, sorting and summary helpers for the portal lists. Pure: the URL (searchParams) is the only state. */
export type SearchParams = Record<string, string | string[] | undefined>;
export type Dir = 'asc' | 'desc';

export const first = (v: string | string[] | undefined): string => (Array.isArray(v) ? v[0] : v) ?? '';

/** A filter value only counts when it is one of the allowed values; anything else is ignored, never echoed. */
export const pick = (v: string | string[] | undefined, allowed: readonly string[]): string => { const s = first(v); return allowed.includes(s) ? s : ''; };

export function sortState(params: SearchParams, columns: readonly string[], defaults: { sort: string; dir: Dir }): { sort: string; dir: Dir } {
  const sort = pick(params.sort, columns) || defaults.sort;
  const dir = pick(params.dir, ['asc', 'desc']) as Dir | '';
  return { sort, dir: dir || defaults.dir };
}

export function sortRows<T>(rows: T[], sort: string, dir: Dir, value: (row: T, key: string) => string | number): T[] {
  const sign = dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const x = value(a, sort); const y = value(b, sort);
    return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))) * sign;
  });
}

/** A query string from the non-empty entries. */
export const toQuery = (entries: Record<string, string>): string => {
  const q = new URLSearchParams(Object.entries(entries).filter(([, v]) => v));
  const s = q.toString();
  return s ? `?${s}` : '';
};

export interface Diversion { month: string; recycledKg: number; totalKg: number; rate: number | null }
const rate = (recycled: number, total: number) => (total > 0 ? Math.round((recycled / total) * 1000) / 10 : null);

/** The monthly diversion rate and the trailing twelve months ending with it (inclusive), from the notes' weights (annual reports are summaries and not counted). */
export function diversionRate(docs: { date: string; kind: string; recycledKg?: number; totalKg?: number }[], month: string): { month: Diversion; trailing: Diversion } {
  const notes = docs.filter((d) => d.kind !== 'Annual report' && typeof d.totalKg === 'number');
  const [y, m] = month.split('-').map(Number) as [number, number];
  const startIdx = y * 12 + (m - 1) - 11;
  const idx = (d: string) => Number(d.slice(0, 4)) * 12 + Number(d.slice(5, 7)) - 1;
  const sum = (rows: typeof notes, label: string): Diversion => {
    const recycledKg = rows.reduce((s, d) => s + (d.recycledKg ?? 0), 0);
    const totalKg = rows.reduce((s, d) => s + (d.totalKg ?? 0), 0);
    return { month: label, recycledKg, totalKg, rate: rate(recycledKg, totalKg) };
  };
  return {
    month: sum(notes.filter((d) => d.date.slice(0, 7) === month), month),
    trailing: sum(notes.filter((d) => idx(d.date) >= startIdx && idx(d.date) <= y * 12 + (m - 1)), month),
  };
}

/** Months that have notes, newest first; the default selection is the latest. */
export const monthsWithNotes = (docs: { date: string; kind: string }[]): string[] => [...new Set(docs.filter((d) => d.kind !== 'Annual report').map((d) => d.date.slice(0, 7)))].sort().reverse();
