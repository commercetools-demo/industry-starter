'use client';
import { useState } from 'react';
import { useQuoteList } from '@/hooks/useQuoteList';

/** Edit and remove handlers for the lines of the list; the cache is set from each response. `error` is true after a failed call. */
export function useLineEditor(onDone?: (message: 'updated' | 'removed', name: string) => void) {
  const { list, update } = useQuoteList();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  async function run(method: 'PATCH' | 'DELETE', id: string, body: unknown, message: 'updated' | 'removed') {
    const name = list.lines.find((l) => l.id === id)?.name ?? '';
    setBusy(true); setError(false);
    try { await update(method, `/api/quote-list/lines/${id}`, body); onDone?.(message, name); } catch { setError(true); } finally { setBusy(false); }
  }
  return {
    busy, error,
    onChange: (id: string, patch: { frequency?: string; note?: string }) => run('PATCH', id, patch, 'updated'),
    onRemove: (id: string) => run('DELETE', id, undefined, 'removed'),
  };
}
