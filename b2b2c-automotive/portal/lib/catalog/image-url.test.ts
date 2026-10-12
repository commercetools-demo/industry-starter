import { describe, expect, it, vi } from 'vitest';
import { fetchImageFromUrl, isPrivateAddress } from './image-url';

function pngBytes(width = 800, height = 800, size = 64): Uint8Array {
  const b = new Uint8Array(size);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  new DataView(b.buffer).setUint32(16, width);
  new DataView(b.buffer).setUint32(20, height);
  return b;
}
const ok = (body: Uint8Array, init: ResponseInit = {}) => new Response(body as unknown as BodyInit, { status: 200, ...init });
const publicLookup = async () => ['93.184.216.34'];

describe('fetchImageFromUrl', () => {
  it('private, loopback and link-local hosts refused', async () => {
    const fetcher = vi.fn();
    for (const url of ['https://127.0.0.1/x.png', 'https://10.0.0.5/x.png', 'https://169.254.169.254/latest', 'https://[::1]/x.png', 'https://192.168.1.1/x.png']) {
      await expect(fetchImageFromUrl(url, { fetch: fetcher, lookup: publicLookup })).rejects.toMatchObject({ code: 'IMAGE_URL_REFUSED' });
    }
    await expect(fetchImageFromUrl('https://internal.example/x.png', { fetch: fetcher, lookup: async () => ['10.1.2.3'] })).rejects.toMatchObject({ code: 'IMAGE_URL_REFUSED' });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('http, credentials in the URL and garbage are refused', async () => {
    const fetcher = vi.fn();
    for (const url of ['http://example.com/x.png', 'https://user:pw@example.com/x.png', 'not a url']) {
      await expect(fetchImageFromUrl(url, { fetch: fetcher, lookup: publicLookup })).rejects.toMatchObject({ code: 'IMAGE_URL_REFUSED' });
    }
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('redirect to a private host refused; two redirects allowed, a third refused', async () => {
    const lookup = async (host: string) => (host === 'evil.example' ? ['127.0.0.1'] : ['93.184.216.34']);
    const toPrivate = vi.fn(async () => new Response(null, { status: 302, headers: { location: 'https://evil.example/x.png' } }));
    await expect(fetchImageFromUrl('https://cdn.example/x.png', { fetch: toPrivate, lookup })).rejects.toMatchObject({ code: 'IMAGE_URL_REFUSED' });
    expect(toPrivate).toHaveBeenCalledTimes(1);

    let hops = 0;
    const twice = vi.fn(async () => (hops++ < 2 ? new Response(null, { status: 301, headers: { location: `https://cdn.example/${hops}.png` } }) : ok(pngBytes())));
    await expect(fetchImageFromUrl('https://cdn.example/x.png', { fetch: twice, lookup })).resolves.toMatchObject({ ok: true });

    const loop = vi.fn(async () => new Response(null, { status: 301, headers: { location: 'https://cdn.example/again.png' } }));
    await expect(fetchImageFromUrl('https://cdn.example/x.png', { fetch: loop, lookup })).rejects.toMatchObject({ code: 'IMAGE_URL_REFUSED' });
  });

  it('timeout', async () => {
    const slow = vi.fn((_url: unknown, init?: RequestInit) => new Promise<Response>((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(new Error('aborted')))));
    await expect(fetchImageFromUrl('https://cdn.example/x.png', { fetch: slow as unknown as typeof fetch, lookup: publicLookup, timeoutMs: 20 })).rejects.toMatchObject({ code: 'IMAGE_INVALID' });
  });

  it('size cap', async () => {
    const big = vi.fn(async () => ok(pngBytes(800, 800, 11 * 1024 * 1024)));
    await expect(fetchImageFromUrl('https://cdn.example/big.png', { fetch: big, lookup: publicLookup })).rejects.toMatchObject({ code: 'IMAGE_INVALID' });
    const declared = vi.fn(async () => ok(pngBytes(), { headers: { 'content-length': String(20 * 1024 * 1024) } }));
    await expect(fetchImageFromUrl('https://cdn.example/big.png', { fetch: declared, lookup: publicLookup })).rejects.toMatchObject({ code: 'IMAGE_INVALID' });
  });

  it('valid https image accepted, saved URL is the pasted one; small image refused with the limit message', async () => {
    const good = vi.fn(async () => ok(pngBytes(900, 700)));
    await expect(fetchImageFromUrl('https://cdn.example/a.png', { fetch: good, lookup: publicLookup })).resolves.toEqual({ ok: true, width: 900, height: 700, mime: 'image/png', url: 'https://cdn.example/a.png' });
    const small = vi.fn(async () => ok(pngBytes(300, 300)));
    await expect(fetchImageFromUrl('https://cdn.example/a.png', { fetch: small, lookup: publicLookup })).rejects.toMatchObject({ message: 'Use a JPG, PNG or WebP of at least 600 x 600 px and at most 10 MB.' });
  });
});

describe('isPrivateAddress', () => {
  it('classifies addresses', () => {
    expect(isPrivateAddress('172.20.1.1')).toBe(true);
    expect(isPrivateAddress('172.32.1.1')).toBe(false);
    expect(isPrivateAddress('::ffff:127.0.0.1')).toBe(true);
    expect(isPrivateAddress('fd00::1')).toBe(true);
    expect(isPrivateAddress('2606:4700::1111')).toBe(false);
    expect(isPrivateAddress('93.184.216.34')).toBe(false);
  });
});
