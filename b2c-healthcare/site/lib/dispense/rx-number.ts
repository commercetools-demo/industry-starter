/** Longest input considered; anything longer cannot be an RX number and is never echoed in full. */
export const RX_INPUT_MAX = 40;

/**
 * `rx 48213`, `RX48213`, `rx-48213`, ` RX - 48213 ` all become `RX-48213`. Returns null for anything that is not
 * "RX" followed by 3 to 10 digits. The result is also the Custom Object key, so it is restricted to `[A-Z0-9-]`.
 */
export function normalizeRx(input: string): string | null {
  const match = /^RX[\s-]*(\d{3,10})$/i.exec(input.trim());
  return match ? `RX-${match[1]}` : null;
}

/** Input as it may be echoed back: trimmed, control characters removed, capped. Never logged. */
export function echoable(input: string): string {
  return input.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, RX_INPUT_MAX);
}

const HTML: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const escapeHtml = (text: string): string => text.replace(/[&<>"']/g, (c) => HTML[c]);

/** The one message for an unknown or foreign RX number (identical for both). Input is HTML-escaped. */
export function notFoundMessage(input: string): string {
  return `We couldn't find “${escapeHtml(echoable(input))}”. Check the number printed on your prescription.`;
}
