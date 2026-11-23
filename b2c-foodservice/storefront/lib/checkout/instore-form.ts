/**
 * The In-store checkout form (D-062): the booth order is free, so the shopper only says who it is for and how to tell them it is
 * ready. Pure rules shared by the page (to enable the button) and the route (to refuse a bad body); no commercetools types.
 */
export type InstoreWho = { mode: 'name'; name: string } | { mode: 'badge' };
export type InstoreNotify = { mode: 'email'; email: string } | { mode: 'phone'; phone: string };
export interface InstoreOrderForm { who: InstoreWho; notify: InstoreNotify }

export const nameOk = (v: string): boolean => v.trim().length >= 2 && v.trim().length <= 100;
export const emailOk = (v: string): boolean => /^\S+@\S+\.\S+$/.test(v.trim()) && v.trim().length <= 254;
export const phoneOk = (v: string): boolean => v.replace(/\D/g, '').length >= 7 && v.trim().length <= 32;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** The form from an untrusted body, trimmed, or null when anything is missing or malformed. */
export function parseInstoreForm(body: unknown): InstoreOrderForm | null {
  if (!isRecord(body) || !isRecord(body.who) || !isRecord(body.notify)) return null;
  const { who, notify } = body;
  let w: InstoreWho;
  if (who.mode === 'name' && typeof who.name === 'string' && nameOk(who.name)) w = { mode: 'name', name: who.name.trim() };
  else if (who.mode === 'badge') w = { mode: 'badge' };
  else return null;
  let n: InstoreNotify;
  if (notify.mode === 'email' && typeof notify.email === 'string' && emailOk(notify.email)) n = { mode: 'email', email: notify.email.trim() };
  else if (notify.mode === 'phone' && typeof notify.phone === 'string' && phoneOk(notify.phone)) n = { mode: 'phone', phone: notify.phone.trim() };
  else return null;
  return { who: w, notify: n };
}
