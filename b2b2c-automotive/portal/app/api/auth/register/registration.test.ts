/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const frontend = vi.hoisted(() => ({ createCustomer: vi.fn() }));
const provisioning = vi.hoisted(() => ({ createUnit: vi.fn(), deleteCustomer: vi.fn() }));

vi.mock('@/lib/ct/client', () => ({
  apiRoot: { customers: () => ({ post: (args: unknown) => ({ execute: () => frontend.createCustomer(args) }) }) },
}));
vi.mock('@/lib/ct/provisioning-client', () => ({
  getProvisioningRoot: () => ({
    businessUnits: () => ({ post: (args: unknown) => ({ execute: () => provisioning.createUnit(args) }) }),
    customers: () => ({ withId: () => ({ delete: (args: unknown) => ({ execute: () => provisioning.deleteCustomer(args) }) }) }),
  }),
}));

import { registerReseller, slugify } from './registration';

const input = { companyName: 'Test Garage Nord', name: 'Alex Test', email: 'alex@example.com', password: 'twelve-chars-ok' };

beforeEach(() => {
  frontend.createCustomer.mockReset().mockResolvedValue({ body: { customer: { id: 'cust-1', version: 1 } } });
  provisioning.createUnit.mockReset().mockResolvedValue({ body: {} });
  provisioning.deleteCustomer.mockReset().mockResolvedValue({});
});

describe('registerReseller', () => {
  it('success creates customer, inactive company, admin association', async () => {
    expect(await registerReseller(input)).toBe('created');
    expect(frontend.createCustomer.mock.calls[0][0].body).toMatchObject({ email: 'alex@example.com', isEmailVerified: true, firstName: 'Alex', lastName: 'Test' });
    const draft = provisioning.createUnit.mock.calls[0][0].body;
    expect(draft).toMatchObject({
      unitType: 'Company',
      status: 'Inactive',
      storeMode: 'Explicit',
      name: 'Test Garage Nord',
      associates: [{ customer: { typeId: 'customer', id: 'cust-1' }, associateRoleAssignments: [{ associateRole: { typeId: 'associate-role', key: 'mau-role-admin' }, inheritance: 'Disabled' }] }],
    });
    expect(draft.key).toMatch(/^rs-test-garage-nord-[a-z0-9]{4}$/);
    expect(draft.stores).toBeUndefined();
  });

  it('business unit failure deletes the customer', async () => {
    provisioning.createUnit.mockRejectedValue({ statusCode: 500 });
    await expect(registerReseller(input)).rejects.toBeTruthy();
    expect(provisioning.deleteCustomer).toHaveBeenCalledWith({ queryArgs: { version: 1 } });
  });

  it('a duplicate email creates nothing else', async () => {
    frontend.createCustomer.mockRejectedValue({ statusCode: 400, body: { errors: [{ code: 'DuplicateField' }] } });
    expect(await registerReseller(input)).toBe('duplicate');
    expect(provisioning.createUnit).not.toHaveBeenCalled();
  });

  it('slugs are ascii, lower case and bounded', () => {
    expect(slugify('Küstenwerk Nord GmbH')).toBe('kustenwerk-nord-gmbh');
    expect(slugify('!!!')).toBe('co');
    expect(slugify('x'.repeat(100)).length).toBeLessThanOrEqual(40);
  });
});
