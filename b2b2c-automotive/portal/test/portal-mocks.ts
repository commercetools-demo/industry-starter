import { vi } from 'vitest';
import type { PortalPorts } from '@/lib/portal/ports';
import type { PortalSession } from '@/lib/portal/types';

/** In-memory stand-in for lib/portal/seam.ts: a session store and a set of spy-able ports. */
export function createSeamMock(initial: PortalSession = {}) {
  const state = { session: { ...initial } as PortalSession, writes: 0, cleared: 0 };
  const ports: { [K in keyof PortalPorts]: ReturnType<typeof vi.fn> } = {
    loadViewer: vi.fn(async () => null),
    listUnits: vi.fn(async () => []),
    resolveContext: vi.fn(async () => null),
    login: vi.fn(async () => ({ kind: 'invalid' })),
    loginDemo: vi.fn(async () => ({ kind: 'invalid' })),
    listDemoAccounts: vi.fn(async () => []),
    register: vi.fn(async () => 'created'),
    createPasswordToken: vi.fn(async () => null),
    resetPassword: vi.fn(async () => false),
    searchParts: vi.fn(async () => []),
    shippedOrders: vi.fn(async () => []),
    pendingBusinessName: vi.fn(async () => undefined),
  };
  const seam = {
    readSession: vi.fn(async () => state.session),
    writeSession: vi.fn(async (fn: (s: PortalSession) => PortalSession) => {
      state.writes += 1;
      state.session = fn(state.session);
      return state.session;
    }),
    clearSession: vi.fn(async () => {
      state.cleared += 1;
      state.session = {};
    }),
    getPorts: () => ports as unknown as PortalPorts,
    devFixturesEnabled: () => false,
  };
  return { state, ports, seam };
}
