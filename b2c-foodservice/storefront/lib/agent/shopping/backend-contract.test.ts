// @vitest-environment node
import { FakeBackend, product, session } from '../testing';
import { type ContractHarness, runBackendContract } from './backend-contract';
import type { Order } from './types';

// The contract run against the agent's test double (the storefront backend runs it in lib/ct/assistant-backend.test.ts).
runBackendContract('FakeBackend', () => {
  const orders: Order[] = [{ orderId: 'MC-OWN', items: [], total: 10, currency: 'USD' }];
  const backend = new FakeBackend([product('p1'), product('p2')]);
  backend.orders = orders;
  backend.foreignOrders.add('MC-FOREIGN');
  const guest = new FakeBackend([product('p1')]);
  guest.signedIn = false;
  const harness: ContractHarness = {
    backend,
    guest,
    ctx: session(),
    knownId: 'p1',
    otherId: 'p2',
    familyId: 'fam:p3',
    unknownId: 'nope',
    ownOrder: 'MC-OWN',
    foreignOrder: 'MC-FOREIGN',
    breakSearch: () => {
      backend.failWith = new Error('index down');
    },
  };
  return harness;
});
