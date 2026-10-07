// @vitest-environment node
import { removeDecor } from './remove-decor';

function mockRoot() {
  const calls: string[] = [];
  const handle = (kind: string) => ({
    withId: ({ ID }: { ID: string }) => ({
      post: () => ({ execute: async () => (calls.push(`unpublish ${ID}`), { body: { version: 9 } }) }),
      delete: () => ({ execute: async () => (calls.push(`delete ${kind} ${ID}`), { body: {} }) }),
    }),
  });
  return { calls, root: { products: () => handle('product'), inventory: () => handle('inventory'), categories: () => handle('category'), productTypes: () => handle('product-type') } as never };
}

const backup = {
  products: [{ id: 'p1', version: 1, masterData: { published: true } }],
  inventory: [{ id: 'i1', version: 1 }],
  categories: [{ id: 'root', version: 1, ancestors: [] }, { id: 'leaf', version: 1, ancestors: [{}, {}] }],
  productTypes: [{ id: 't1', version: 1 }],
};

describe('removeDecor', () => {
  it('dry run deletes nothing', async () => {
    const { root, calls } = mockRoot();
    expect(await removeDecor(root, backup, { confirm: false }, () => {})).toBe(false);
    expect(calls).toEqual([]);
  });

  it('deletes in order: unpublish+product, inventory, categories deepest first, product types last', async () => {
    const { root, calls } = mockRoot();
    await removeDecor(root, backup, { confirm: true }, () => {});
    expect(calls).toEqual(['unpublish p1', 'delete product p1', 'delete inventory i1', 'delete category leaf', 'delete category root', 'delete product-type t1']);
  });

  it('only touches ids listed in the backup', async () => {
    const { root, calls } = mockRoot();
    await removeDecor(root, { ...backup, products: [], inventory: [], categories: [], productTypes: [] }, { confirm: true }, () => {});
    expect(calls).toEqual([]);
  });
});
