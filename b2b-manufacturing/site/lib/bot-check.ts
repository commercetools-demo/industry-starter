/** Minimum time a person needs to fill a form; faster is a script. */
export const MIN_FILL_MS = 2000;

export interface BotSignals { website?: string; startedAt?: number }

/** A filled honeypot field, or a form submitted faster than a person could (or without a start time). */
export function looksLikeBot({ website, startedAt }: BotSignals, now: number = Date.now()): boolean {
  if (website && website.trim() !== '') return true;
  return !startedAt || now - startedAt < MIN_FILL_MS || startedAt > now;
}
