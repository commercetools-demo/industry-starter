// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getSession = vi.fn();
const getCustomerByIdCached = vi.fn();
vi.mock('@/lib/session', () => ({ getSession: () => getSession() }));
vi.mock('@/lib/ct/customers', () => ({ getCustomerByIdCached: (id: string) => getCustomerByIdCached(id) }));

import { getHeaderUser } from './header-user';

describe('design-storefront-shell: Session-resolved header state', () => {
  beforeEach(() => {
    getSession.mockReset();
    getCustomerByIdCached.mockReset();
  });

  it('Expired session: an empty session is anonymous and reads no customer', async () => {
    getSession.mockResolvedValue({});
    expect(await getHeaderUser()).toBeNull();
    expect(getCustomerByIdCached).not.toHaveBeenCalled();
  });

  it('a signed-in session gives the customer name for the initials', async () => {
    getSession.mockResolvedValue({ customerId: 'c1' });
    getCustomerByIdCached.mockResolvedValue({ id: 'c1', firstName: 'Sam', lastName: 'Rivera' });
    expect(await getHeaderUser()).toEqual({ id: 'c1', firstName: 'Sam', lastName: 'Rivera' });
  });

  it('a customer that no longer exists renders as anonymous', async () => {
    getSession.mockResolvedValue({ customerId: 'gone' });
    getCustomerByIdCached.mockResolvedValue(null);
    expect(await getHeaderUser()).toBeNull();
  });

  it('a commercetools outage keeps the header signed in with the id only', async () => {
    getSession.mockResolvedValue({ customerId: 'c1' });
    getCustomerByIdCached.mockRejectedValue(new Error('503'));
    expect(await getHeaderUser()).toEqual({ id: 'c1' });
  });
});
