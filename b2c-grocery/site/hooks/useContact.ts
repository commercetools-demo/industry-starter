'use client';

import { useCallback, useState } from 'react';
import type { ContactErrors } from '@/lib/contact-validation';
import { ApiError, sendJson } from '@/lib/fetcher';

export interface ContactPayload {
  name: string;
  email: string;
  topic: string;
  message: string;
  /** Honeypot: real visitors never fill it. */
  website: string;
}

export type ContactResult = { ok: true } | { ok: false; reason: 'validation'; fields: ContactErrors } | { ok: false; reason: 'rateLimited' | 'failed' };

/** Posts the contact form. Never throws: the result says what went wrong. */
export function useContact() {
  const [isPending, setPending] = useState(false);

  const submit = useCallback(async (payload: ContactPayload): Promise<ContactResult> => {
    setPending(true);
    try {
      await sendJson<{ ok: true }>('/api/contact', 'POST', payload);
      return { ok: true };
    } catch (error) {
      if (error instanceof ApiError && error.status === 400) {
        const fields = (error.data as { fields?: ContactErrors } | undefined)?.fields;
        if (fields) return { ok: false, reason: 'validation', fields };
      }
      if (error instanceof ApiError && error.status === 429) return { ok: false, reason: 'rateLimited' };
      return { ok: false, reason: 'failed' };
    } finally {
      setPending(false);
    }
  }, []);

  return { submit, isPending };
}
