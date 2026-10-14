/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// Test kit for the catalog seller routes (workstream T). Route tests mock `@/lib/portal/seam` and `@/lib/ct/associate` with these
// factories (inside `vi.mock(path, async () => (await import('@/test/seller-routes')).seamModule())`), pick a synthetic user with
// `asUser`, and mock the service module of the route, so no commercetools call can happen.
import { vi } from 'vitest';
import { sessionFor } from '@/lib/authz/test-helpers';
import type { LogicalRole, Session } from '@/lib/types';

export const sellerState: { session: Session; roles: LogicalRole[] } = { session: sessionFor('adminA'), roles: ['admin'] };

export function asUser(who: 'adminA' | 'buyerA' | 'adminB' | 'nobody') {
  if (who === 'nobody') {
    sellerState.session = {};
    sellerState.roles = [];
    return;
  }
  sellerState.session = sessionFor(who);
  sellerState.roles = who === 'buyerA' ? ['buyer'] : ['admin'];
}

export function seamModule() {
  return {
    readSession: async () => sellerState.session,
    writeSession: vi.fn(),
    clearSession: vi.fn(),
    getPorts: () => ({ loadViewer: async () => null }),
    devFixturesEnabled: () => false,
  };
}

export function associateModule() {
  return { getAssociateRoles: async () => ({ roleKeys: [], roles: sellerState.roles, ctPermissions: [] }) };
}

export const params = <T extends Record<string, string>>(value: T) => ({ params: Promise.resolve(value) });
