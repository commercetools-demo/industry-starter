'use client';
import { useCallback } from 'react';
import { apiBookingCancel } from '@/lib/api-paths';

export type CancelResult = { ok: true } | { ok: false; tooLate: boolean };

/** `POST /api/bookings/:ref/cancel` for the signed-in patient. Never throws: a network failure is `{ ok: false, tooLate: false }`. */
export function useCancelBooking(): (reference: string) => Promise<CancelResult> {
  return useCallback(async (reference: string) => {
    try {
      const response = await fetch(apiBookingCancel(reference), { method: 'POST' });
      if (response.ok) return { ok: true };
      const body = (await response.json().catch(() => null)) as { code?: unknown } | null;
      return { ok: false, tooLate: response.status === 409 && body?.code === 'too-late' };
    } catch {
      return { ok: false, tooLate: false };
    }
  }, []);
}
