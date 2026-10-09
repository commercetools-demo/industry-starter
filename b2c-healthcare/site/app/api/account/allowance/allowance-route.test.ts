// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getSession = vi.fn();
vi.mock('@/lib/session', () => ({ getSession: () => getSession(), updateSession: vi.fn(), clearCustomer: vi.fn() }));
const getPatient = vi.fn();
vi.mock('@/lib/ct/patient', () => ({ getPatient: (...a: unknown[]) => getPatient(...a) }));
const getAllowanceView = vi.fn();
vi.mock('@/lib/ct/allowance', () => ({ getAllowanceView: (...a: unknown[]) => getAllowanceView(...a) }));

import * as route from './route';

const API_DIR = join(import.meta.dirname, '..', '..');
const walk = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));

beforeEach(() => {
  getSession.mockReset().mockResolvedValue({ customerId: 'c-sam' });
  getPatient.mockReset().mockResolvedValue({ patientRef: 'pt_sam', name: 'Sam' });
  getAllowanceView.mockReset().mockResolvedValue({ cycle: '2026-10', currency: 'USD', granted: 5000, consumed: 0, balance: 5000, forfeitsOn: '2026-11-01', lapsing: 5000, lastLapsed: null });
});

describe('benefit-allowance-drawdown: Allowance is not cash (U-07)', () => {
  it('reads the signed-in member\'s own allowance and nothing else', async () => {
    const response = await route.GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ balance: 5000, forfeitsOn: '2026-11-01' });
    expect(getAllowanceView).toHaveBeenCalledWith('pt_sam');
  });

  it('signed out: 401', async () => {
    getSession.mockResolvedValue({});
    expect((await route.GET()).status).toBe(401);
  });

  it.each(['POST', 'PUT', 'PATCH', 'DELETE'] as const)('an attempt to change an allowance with %s is refused with a 4xx and nothing is written', async (method) => {
    const response = await route[method]();
    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('GET');
    expect(await response.json()).toMatchObject({ code: 'ALLOWANCE_NOT_CASH' });
    expect(getAllowanceView).not.toHaveBeenCalled();
  });

  it('there is exactly one allowance route in the API, and it exports no handler that could pay out', () => {
    const routes = walk(API_DIR).filter((f) => f.endsWith('route.ts')).map((f) => relative(API_DIR, f));
    expect(routes.filter((r) => /allowance/i.test(r))).toEqual(['account/allowance/route.ts']);
    expect(routes.filter((r) => /withdraw|transfer|cash-?out|redeem|payout/i.test(r))).toEqual([]);
  });

  it('no module writes an allowance except through an order: drawdown and restore are called only from placement and cancel', () => {
    const root = join(API_DIR, '..', '..');
    const callers = new Set<string>();
    for (const dir of ['app', 'lib', 'hooks', 'components']) {
      for (const file of walk(join(root, dir)).filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f))) {
        if (/\b(drawdown|restoreAllowance|grantCycle)\(/.test(readFileSync(file, 'utf8'))) callers.add(relative(root, file));
      }
    }
    expect([...callers].sort()).toEqual(['lib/ct/allowance.ts', 'lib/ct/checkout-fixtures.ts', 'lib/ct/order-cancel-hooks.ts', 'lib/ct/order-cancel.ts', 'lib/ct/orders.ts', 'lib/ct/tender.ts', 'lib/funding/allowance-core.ts'].sort());
  });
});
