// Pasted image URL intake (T-08). The server fetches the URL once to validate the bytes: https only, no credentials, DNS
// resolved and private, loopback and link-local addresses refused, at most 2 redirects (each checked again), 5 s timeout,
// 10 MB cap, then the same `validateImage` as an upload. The saved URL is the pasted one.
// Known limit: `fetch` resolves the host again, so a DNS rebinding race between the check and the fetch is not closed here (Q-T14).
import 'server-only';
import { lookup as dnsLookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { CatalogError } from './errors';
import { IMAGE_LIMIT_MESSAGE, MAX_IMAGE_BYTES, validateImage, type ImageCheck } from './image-rules';

export const URL_REFUSED_MESSAGE = 'This image address cannot be used. Use a public https address.';

export interface ImageUrlDeps {
  fetch: typeof fetch;
  lookup: (host: string) => Promise<string[]>;
  timeoutMs: number;
}

const defaultDeps: ImageUrlDeps = {
  fetch: (input, init) => fetch(input, init),
  lookup: async (host) => (await dnsLookup(host, { all: true })).map((a) => a.address),
  timeoutMs: 5000,
};

function ipv4Private(ip: string): boolean {
  const [a, b] = ip.split('.').map(Number);
  return (
    a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224
  );
}

export function isPrivateAddress(address: string): boolean {
  const ip = address.toLowerCase().replace(/^\[|\]$/g, '');
  if (isIP(ip) === 4) return ipv4Private(ip);
  if (isIP(ip) === 6) {
    if (ip === '::' || ip === '::1') return true;
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(ip);
    if (mapped) return ipv4Private(mapped[1]);
    return /^f[cd]/.test(ip) || /^fe[89ab]/.test(ip);
  }
  return true; // not an address at all: refuse
}

const refused = () => new CatalogError(400, 'IMAGE_URL_REFUSED', URL_REFUSED_MESSAGE);

async function assertPublic(url: URL, deps: ImageUrlDeps): Promise<void> {
  if (url.protocol !== 'https:' || url.username || url.password) throw refused();
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = isIP(host) ? [host] : await deps.lookup(host).catch(() => []);
  if (addresses.length === 0 || addresses.some(isPrivateAddress)) throw refused();
}

async function readCapped(response: Response): Promise<Uint8Array> {
  const declared = Number(response.headers.get('content-length'));
  if (declared > MAX_IMAGE_BYTES) throw new CatalogError(400, 'IMAGE_INVALID', IMAGE_LIMIT_MESSAGE);
  const reader = response.body?.getReader();
  if (!reader) return new Uint8Array(await response.arrayBuffer());
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > MAX_IMAGE_BYTES) {
      await reader.cancel();
      throw new CatalogError(400, 'IMAGE_INVALID', IMAGE_LIMIT_MESSAGE);
    }
    chunks.push(value);
  }
  const out = new Uint8Array(size);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

/** Fetches and validates a pasted image URL. Throws `CatalogError` (400) with the limit message or `IMAGE_URL_REFUSED`. */
export async function fetchImageFromUrl(rawUrl: string, overrides: Partial<ImageUrlDeps> = {}): Promise<Extract<ImageCheck, { ok: true }> & { url: string }> {
  const deps = { ...defaultDeps, ...overrides };
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw refused();
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), deps.timeoutMs);
  try {
    let current = url;
    for (let hop = 0; hop <= 2; hop += 1) {
      await assertPublic(current, deps);
      const response = await deps.fetch(current.toString(), { redirect: 'manual', signal: controller.signal, headers: { accept: 'image/jpeg,image/png,image/webp' } });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location || hop === 2) throw refused();
        current = new URL(location, current);
        continue;
      }
      if (!response.ok) throw new CatalogError(400, 'IMAGE_INVALID', IMAGE_LIMIT_MESSAGE);
      const check = validateImage(await readCapped(response));
      if (!check.ok) throw new CatalogError(400, 'IMAGE_INVALID', check.message);
      return { ...check, url: url.toString() };
    }
    throw refused();
  } catch (error) {
    if (error instanceof CatalogError) throw error;
    throw new CatalogError(400, 'IMAGE_INVALID', IMAGE_LIMIT_MESSAGE);
  } finally {
    clearTimeout(timer);
  }
}
