import 'server-only';

export const FORWARD_TIMEOUT_MS = 5000;

export interface ContactPayload {
  reference: string;
  receivedAt: string;
  locale: string;
  country: string;
  topic: string;
  orderNumber: string;
  name: string;
  email: string;
  message: string;
}

/**
 * Posts the enquiry to the configured receiver. The enquiry counts as accepted only when the receiver answers 2xx
 * within 5 s. Returns false for every other outcome (unset URL, error status, timeout, network error).
 */
export async function forwardContact(payload: ContactPayload): Promise<boolean> {
  const url = process.env.CONTACT_WEBHOOK_URL;
  if (!url) return false;
  const token = process.env.CONTACT_WEBHOOK_TOKEN;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FORWARD_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
