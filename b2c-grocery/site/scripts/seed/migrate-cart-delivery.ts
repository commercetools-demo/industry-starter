import types from './data/types.json';
import { getAdminRoot } from './lib';

/**
 * An order can carry only ONE custom type, so `finalTotal` lives on `cart-delivery` (the type every order from a cart gets).
 * Adds any field of data/types.json that the live type is missing (addFieldDefinition); never removes or changes fields.
 */
async function main() {
  const { root } = getAdminRoot();
  const wanted = types.find((t) => t.key === 'cart-delivery');
  if (!wanted) throw new Error('cart-delivery missing from data/types.json');
  const live = (await root.types().withKey({ key: 'cart-delivery' }).get().execute()).body;
  const have = new Set(live.fieldDefinitions.map((f) => f.name));
  const actions = wanted.fieldDefinitions
    .filter((f) => !have.has(f.name))
    .map((fieldDefinition) => ({ action: 'addFieldDefinition' as const, fieldDefinition: fieldDefinition as never }));
  if (actions.length === 0) return console.log('cart-delivery already up to date');
  await root.types().withKey({ key: 'cart-delivery' }).post({ body: { version: live.version, actions } }).execute();
  console.log(`cart-delivery: added ${actions.length} field(s): ${wanted.fieldDefinitions.filter((f) => !have.has(f.name)).map((f) => f.name).join(', ')}`);
}
main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
