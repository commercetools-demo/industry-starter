// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeRequest } from '@/test/request';

const getSlotDays = vi.fn();
vi.mock('@/lib/ct/doctor-slots', () => ({ getSlotDays: (...a: unknown[]) => getSlotDays(...a) }));

import { dynamic, GET } from './route';

const ctx = (key: string) => ({ params: Promise.resolve({ key }) });
const body = { mode: 'remote', timezone: 'America/New_York', days: [{ date: '2026-10-08', slots: [{ startsAt: '2026-10-08T14:00:00.000Z', time: '10:00' }] }] };

beforeEach(() => {
  getSlotDays.mockReset().mockResolvedValue(body);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('product-detail-page: slots endpoint', () => {
  it('returns the days with the zone and is never cached', async () => {
    const response = await GET(makeRequest('/api/doctors/mlv-doc-a/slots?mode=remote'), ctx('mlv-doc-a'));
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(dynamic).toBe('force-dynamic');
    expect(await response.json()).toEqual(body);
    expect(getSlotDays).toHaveBeenCalledWith('mlv-doc-a', 'remote');
  });

  it('every call reads live data (no memo between requests)', async () => {
    await GET(makeRequest('/api/doctors/mlv-doc-a/slots?mode=remote'), ctx('mlv-doc-a'));
    await GET(makeRequest('/api/doctors/mlv-doc-a/slots?mode=remote'), ctx('mlv-doc-a'));
    expect(getSlotDays).toHaveBeenCalledTimes(2);
  });

  it('a missing or unknown mode, or an implausible key, is a 400 without reading anything', async () => {
    for (const [url, key] of [
      ['/api/doctors/mlv-doc-a/slots', 'mlv-doc-a'],
      ['/api/doctors/mlv-doc-a/slots?mode=video', 'mlv-doc-a'],
      ['/api/doctors/x/slots?mode=remote', '../x'],
    ]) {
      const response = await GET(makeRequest(url), ctx(key));
      expect(response.status).toBe(400);
    }
    expect(getSlotDays).not.toHaveBeenCalled();
  });

  it('an unknown doctor is a 404', async () => {
    getSlotDays.mockResolvedValue(null);
    expect((await GET(makeRequest('/api/doctors/mlv-doc-z/slots?mode=office'), ctx('mlv-doc-z'))).status).toBe(404);
  });

  it('a failing read is a safe error body', async () => {
    getSlotDays.mockRejectedValue(new Error('internal detail'));
    const response = await GET(makeRequest('/api/doctors/mlv-doc-a/slots?mode=office'), ctx('mlv-doc-a'));
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain('internal detail');
  });
});
