// Probe result model and the wrapper that turns any thrown error into a recordable outcome (never a token or secret).
export type ProbeStatus = 'PASS' | 'FAIL' | 'INFO' | 'UNKNOWN' | 'BLOCKED';

export interface ProbeResult {
  id: string;
  title: string;
  status: ProbeStatus;
  /** HTTP status + error code + the first 200 characters of the message, or a short fact. */
  evidence: string;
}

export interface ProbeOutcome {
  status: ProbeStatus;
  evidence: string;
}

export interface ErrorSummary {
  status?: number;
  code?: string;
  message: string;
}

const MAX_MESSAGE = 200;

/** Maps an SDK error, a spike HTTP error or anything else to `{status, code, message <= 200 chars}`. */
export function summarizeError(err: unknown): ErrorSummary {
  const e = err as { statusCode?: unknown; status?: unknown; code?: unknown; message?: unknown; body?: { errors?: { code?: unknown; message?: unknown }[]; message?: unknown } };
  const first = e?.body?.errors?.[0];
  const status = typeof e?.statusCode === 'number' ? e.statusCode : typeof e?.status === 'number' ? e.status : typeof e?.code === 'number' ? e.code : undefined;
  const code = typeof first?.code === 'string' ? first.code : typeof e?.code === 'string' ? e.code : undefined;
  const raw = typeof first?.message === 'string' ? first.message : typeof e?.body?.message === 'string' ? e.body.message : typeof e?.message === 'string' ? e.message : 'unknown error';
  return { ...(status !== undefined ? { status } : {}), ...(code ? { code } : {}), message: raw.slice(0, MAX_MESSAGE) };
}

export function formatError(err: unknown): string {
  const s = summarizeError(err);
  return [s.status !== undefined ? `HTTP ${s.status}` : null, s.code ?? null, s.message].filter(Boolean).join(' ');
}

/** Runs one probe; a throw is a FAIL with the error as evidence. The probe may return its own status (INFO, UNKNOWN, BLOCKED...). */
export async function runProbe(id: string, title: string, fn: () => Promise<ProbeOutcome>): Promise<ProbeResult> {
  try {
    const outcome = await fn();
    return { id, title, ...outcome };
  } catch (err) {
    return { id, title, status: 'FAIL', evidence: formatError(err) };
  }
}

export const blocked = (id: string, title: string, reason: string): ProbeResult => ({ id, title, status: 'BLOCKED', evidence: reason });
