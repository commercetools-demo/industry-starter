/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { describe, expect, it } from 'vitest';
import { canTransition, nativeStates, RETURN_STATUSES, RETURN_WINDOW_DAYS, returnWindowProblem, withinReturnWindow } from './return-item';

const DAY = 86_400_000;
const delivered = '2026-09-01T10:00:00.000Z';
const at = (days: number) => new Date(Date.parse(delivered) + days * DAY);

describe('return contract', () => {
  it('allows only the lifecycle moves of the plan', () => {
    const allowed: [string, string][] = [['requested', 'in-transit'], ['requested', 'received'], ['requested', 'rejected'], ['in-transit', 'received'], ['received', 'inspected'], ['inspected', 'refunded'], ['inspected', 'rejected']];
    for (const from of RETURN_STATUSES) for (const to of RETURN_STATUSES) expect(canTransition(from, to), `${from} -> ${to}`).toBe(allowed.some(([a, b]) => a === from && b === to));
  });
  it('day 30 is accepted and day 31 is not; no delivery date is NOT_DELIVERED', () => {
    expect(RETURN_WINDOW_DAYS).toBe(30);
    expect(withinReturnWindow(delivered, at(30))).toBe(true);
    expect(withinReturnWindow(delivered, at(31))).toBe(false);
    expect(returnWindowProblem(delivered, at(31))).toBe('RETURN_WINDOW_CLOSED');
    expect(returnWindowProblem(delivered, at(2))).toBeNull();
    expect(returnWindowProblem(undefined, at(1))).toBe('NOT_DELIVERED');
  });
  it('maps statuses to native shipment and payment states (D5)', () => {
    expect(nativeStates('requested')).toEqual({ shipmentState: 'Advised', paymentState: 'Initial' });
    expect(nativeStates('inspected').shipmentState).toBe('Returned');
    expect(nativeStates('refunded').paymentState).toBe('Refunded');
    expect(nativeStates('rejected', true)).toEqual({ shipmentState: 'Unusable', paymentState: 'NotRefunded' });
    expect(nativeStates('rejected', false).shipmentState).toBe('Advised');
  });
});
