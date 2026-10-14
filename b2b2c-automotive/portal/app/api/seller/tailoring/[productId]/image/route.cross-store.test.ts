// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { expectCrossStoreForbidden } from '@/lib/authz/test-helpers';
import { asUser, params } from '@/test/seller-routes';

vi.mock('@/lib/portal/seam', async () => (await import('@/test/seller-routes')).seamModule());
vi.mock('@/lib/ct/associate', async () => (await import('@/test/seller-routes')).associateModule());
const store = vi.hoisted(() => ({ upload: vi.fn(async () => 'https://cdn.example/store-a/new.png') }));
vi.mock('@/lib/ct/seller/image-store', () => ({ getImageStore: () => store }));

import { POST } from './route';

function png(width: number, height: number): Uint8Array {
  const b = new Uint8Array(64);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  new DataView(b.buffer).setUint32(16, width);
  new DataView(b.buffer).setUint32(20, height);
  return b;
}

const upload = (storeKey: string, bytes: Uint8Array, name = 'photo.jpg', type = 'image/jpeg') => {
  const form = new FormData();
  form.set('storeKey', storeKey);
  form.set('file', new File([bytes as unknown as BlobPart], name, { type }));
  return new Request('http://localhost:3000/api/seller/tailoring/p1/image', { method: 'POST', body: form });
};
const ctx = params({ productId: 'p1' });

beforeEach(() => {
  asUser('adminA');
  store.upload.mockClear();
});

describe('POST /api/seller/tailoring/[productId]/image', () => {
  it('cross-store: another store is refused and nothing is uploaded', async () => {
    await expectCrossStoreForbidden((req) => POST(req, ctx), (other) => upload(other, png(800, 800)));
    expect(store.upload).not.toHaveBeenCalled();
  });

  it('a valid 800 x 800 image is uploaded, the bytes decide (a png named .jpg is fine); it saves nothing', async () => {
    const res = await POST(upload('store-a', png(800, 800)), ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ url: 'https://cdn.example/store-a/new.png', width: 800, height: 800 });
    expect(store.upload).toHaveBeenCalledWith('store-a', expect.any(File));
  });

  it('a 300 x 300 image and a gif are refused with the limit message and not uploaded', async () => {
    for (const bytes of [png(300, 300), new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, ...new Array(60).fill(0)])]) {
      const res = await POST(upload('store-a', bytes), ctx);
      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({ error: 'Use a JPG, PNG or WebP of at least 600 x 600 px and at most 10 MB.', code: 'IMAGE_INVALID' });
    }
    expect(store.upload).not.toHaveBeenCalled();
  });

  it('a Buyer is refused', async () => {
    asUser('buyerA');
    expect((await POST(upload('store-a', png(800, 800)), ctx)).status).toBe(403);
    expect(store.upload).not.toHaveBeenCalled();
  });
});
