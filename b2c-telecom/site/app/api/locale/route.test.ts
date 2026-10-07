// @vitest-environment node
import { readCartForSwitch, discardCartForSwitch } from '@/lib/market/cartSeam';
import { revalidatePath } from 'next/cache';
import { POST } from './route';

vi.mock('@/lib/market/cartSeam', () => ({
  readCartForSwitch: vi.fn(),
  discardCartForSwitch: vi.fn(),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

function post(body: string) {
  return new Request('http://localhost/api/locale', { method: 'POST', headers: { 'content-type': 'application/json' }, body });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(readCartForSwitch).mockResolvedValue(null);
});

describe('POST /api/locale', () => {
  it('rejects an unsupported locale with 400 and the VALIDATION error', async () => {
    const res = await POST(post(JSON.stringify({ locale: 'fr-FR' })));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: { code: 'VALIDATION', message: 'Unsupported locale' } });
  });

  it('rejects a missing locale and invalid JSON with 400', async () => {
    expect((await POST(post('{}'))).status).toBe(400);
    const res = await POST(post('not json'));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: { code: 'VALIDATION', message: 'Unsupported locale' } });
    expect(res.headers.get('set-cookie')).toBeNull();
  });

  it('Region switched before a cart exists: language, currency and country follow the new market and the cart action is none', async () => {
    const res = await POST(post(JSON.stringify({ locale: 'de-DE' })));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ locale: 'de-DE', currency: 'EUR', country: 'DE', cart: { action: 'none', droppedLines: [] } });
    const cookie = res.headers.get('set-cookie') ?? '';
    expect(cookie).toContain('malva-market=de-DE');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toMatch(/SameSite=lax/i);
    expect(cookie).toContain('Max-Age=31536000');
    expect(cookie).toContain('Path=/');
    expect(discardCartForSwitch).not.toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith('/', 'layout');
  });

  it('Region switched with a cart: the old cart is discarded explicitly through the seam', async () => {
    vi.mocked(readCartForSwitch).mockResolvedValue({
      currency: 'USD',
      country: 'US',
      lines: [
        { offerKey: 'malva-offer-cable-500', name: 'Cable 500' },
        { offerKey: 'malva-offer-spotify', name: 'Spotify' },
      ],
    });
    const res = await POST(post(JSON.stringify({ locale: 'de-DE' })));
    const json = await res.json();
    expect(json.cart.action).toBe('discarded');
    expect(json.cart.droppedLines.map((line: { name: string }) => line.name)).toEqual(['Cable 500', 'Spotify']);
    expect(discardCartForSwitch).toHaveBeenCalledTimes(1);
  });

  it('switching to the current market is a no-op that still answers 200 with action none', async () => {
    vi.mocked(readCartForSwitch).mockResolvedValue({ currency: 'USD', country: 'US', lines: [{ offerKey: 'malva-offer-cable-500', name: 'Cable 500' }] });
    const res = await POST(post(JSON.stringify({ locale: 'en-US' })));
    expect(res.status).toBe(200);
    expect((await res.json()).cart).toEqual({ action: 'none', droppedLines: [] });
    expect(discardCartForSwitch).not.toHaveBeenCalled();
  });
});
