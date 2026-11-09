// Workstream T2 (U-09): the rules every StorefrontBackend keeps, written once and run against each implementation (the test double and the
// storefront backend). A backend that passes this suite behaves the same to the agent. Test-only: imported from `*.test.ts` files.
import { beforeEach, describe, expect, it } from 'vitest';
import { type StorefrontBackend, SignInRequired, Unavailable } from './backend';
import type { ShoppingSessionContext } from './types';

export interface ContractHarness {
  /** A signed-in shopper's backend. */
  backend: StorefrontBackend;
  /** A guest's backend over the same store. */
  guest: StorefrontBackend;
  ctx: ShoppingSessionContext;
  /** A plain purchasable product, in stock. */
  knownId: string;
  /** A second plain purchasable product, in stock. */
  otherId: string;
  /** A family id: never bought directly. */
  familyId: string;
  /** Matches nothing and exists nowhere. */
  unknownId: string;
  /** An order number of the signed-in shopper. */
  ownOrder: string;
  /** An order number that belongs to someone else. */
  foreignOrder: string;
  /** Makes the next search fail the way an unavailable index does. */
  breakSearch(): void;
}

const quantityOf = (items: { productId: string; quantity: number }[], id: string) => items.find((i) => i.productId === id)?.quantity;

export function runBackendContract(name: string, make: () => ContractHarness | Promise<ContractHarness>): void {
  describe(`${name}: the backend contract`, () => {
    let h: ContractHarness;
    beforeEach(async () => {
      h = await make();
    });

    it('Search that cannot run throws, never returns an empty list', async () => {
      h.breakSearch();
      await expect(h.backend.searchProducts(h.ctx, 'espresso', undefined, 8)).rejects.toThrow();
    });

    it('An empty result is an empty list', async () => {
      expect(await h.backend.searchProducts(h.ctx, 'nothing matches this at all', undefined, 8)).toEqual([]);
    });

    it('An unknown product is null', async () => {
      expect(await h.backend.getProductDetails(h.ctx, h.unknownId)).toBeNull();
    });

    it('A known product carries no absent figure as zero', async () => {
      const details = await h.backend.getProductDetails(h.ctx, h.knownId);
      expect(details).not.toBeNull();
      expect(details && 'rating' in details).toBe(false);
    });

    it('Add, update and remove round trip through the cart', async () => {
      await h.backend.addToCart(h.ctx, h.knownId, 2);
      expect(quantityOf((await h.backend.getCart(h.ctx)).items, h.knownId)).toBe(2);
      await h.backend.updateCartItem(h.ctx, h.knownId, 5);
      expect(quantityOf((await h.backend.getCart(h.ctx)).items, h.knownId)).toBe(5);
      await h.backend.removeFromCart(h.ctx, h.knownId);
      expect((await h.backend.getCart(h.ctx)).items).toEqual([]);
    });

    it('Add keeps the other lines', async () => {
      await h.backend.addToCart(h.ctx, h.knownId, 1);
      await h.backend.addToCart(h.ctx, h.otherId, 1);
      const items = (await h.backend.getCart(h.ctx)).items.map((i) => i.productId).sort();
      expect(items).toEqual([h.knownId, h.otherId].sort());
    });

    it('Update and remove of a product not in the cart leave the cart unchanged', async () => {
      await h.backend.addToCart(h.ctx, h.knownId, 1);
      const before = await h.backend.getCart(h.ctx);
      await h.backend.updateCartItem(h.ctx, h.otherId, 3);
      await h.backend.removeFromCart(h.ctx, h.otherId);
      expect(await h.backend.getCart(h.ctx)).toEqual(before);
    });

    it('A family id is refused by add', async () => {
      await expect(h.backend.addToCart(h.ctx, h.familyId, 1)).rejects.toBeInstanceOf(Unavailable);
      expect((await h.backend.getCart(h.ctx)).items).toEqual([]);
    });

    it('A guest is asked to sign in for orders', async () => {
      await expect(h.guest.getOrders(h.ctx)).rejects.toBeInstanceOf(SignInRequired);
      await expect(h.guest.getOrder(h.ctx, h.ownOrder)).rejects.toBeInstanceOf(SignInRequired);
    });

    it('A foreign order is the same null as an unknown one', async () => {
      const foreign = await h.backend.getOrder(h.ctx, h.foreignOrder);
      const unknown = await h.backend.getOrder(h.ctx, 'MC-NOPE-0000');
      expect(foreign).toBeNull();
      expect(unknown).toBeNull();
    });

    it('An own order is found by its number', async () => {
      const found = await h.backend.getOrder(h.ctx, h.ownOrder);
      expect(found?.orderId).toBe(h.ownOrder);
    });

    it('Preferences carry no email', async () => {
      const prefs = await h.backend.getPreferences(h.ctx);
      expect(JSON.stringify(prefs)).not.toContain('@');
    });
  });
}
