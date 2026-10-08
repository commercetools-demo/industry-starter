import { CATEGORIES } from './data/categories';
import { DOCTORS, doctorKey, doctorSku } from './data/doctors';
import { MEDICATIONS, medKey, medSku } from './data/medications';
import { SAME_DAY_ZONE, SHIPPING_METHODS } from './data/shipping';
import { STATES } from './data/states';
import { TAX_CATEGORIES } from './data/tax';
import { CHANNELS, CUSTOM_TYPES, PRODUCT_TYPES } from './data/types';
import { assertProject, getAdminRoot, hasPrefix, inventoryKey, isMain, listAll, PREFIX, type Rec, type Root } from './lib';

/**
 * Read-only assertions on the seeded project (SEED-PLAN "Verification"). Exit 1 when any fails.
 *
 *   npx tsx scripts/seed/verify.ts [--skip-search] [--no-images]
 */
export interface Check { name: string; ok: boolean; detail?: string }

export interface VerifyOptions { search?: boolean; images?: boolean }

interface Variant { sku?: string; images?: { url: string }[]; prices?: { value: { currencyCode: string; centAmount: number }; channel?: { id?: string; key?: string } }[]; attributes?: { name: string; value: unknown }[] }
interface ProductView { key: string; published: boolean; master: Variant; variants: Variant[] }

const viewOf = (p: Rec): ProductView => {
  const md = p.masterData as { published?: boolean; current?: { masterVariant: Variant; variants?: Variant[] }; staged?: { masterVariant: Variant; variants?: Variant[] } };
  const data = md.current ?? md.staged ?? { masterVariant: {} };
  return { key: p.key as string, published: !!md.published, master: data.masterVariant, variants: data.variants ?? [] };
};

const sameSet = (a: string[], b: string[]) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
const keyOf = (v: unknown) => (typeof v === 'object' && v !== null ? (v as { key?: string }).key : (v as string));

export async function runVerify(root: Root, opts: VerifyOptions = {}): Promise<Check[]> {
  const checks: Check[] = [];
  const check = (name: string, ok: boolean, detail?: string) => checks.push({ name, ok, ...(ok || !detail ? {} : { detail }) });
  const search = opts.search ?? true;
  const images = opts.images ?? true;

  await assertProject(root);
  check('project is spec-test-b2c-healthcare', true);

  // ---- products
  const products = (await listAll(root, 'products')).map(viewOf);
  const doctors = products.filter((p) => p.key.startsWith(`${PREFIX}doc-`));
  const meds = products.filter((p) => p.key.startsWith(`${PREFIX}med-`));
  const unprefixed = products.filter((p) => !p.key.startsWith(PREFIX));
  check(`${DOCTORS.length} doctor products`, sameSet(doctors.map((p) => p.key), DOCTORS.map(doctorKey)), `found ${doctors.map((p) => p.key).join(', ')}`);
  check(`${MEDICATIONS.length} medication products`, sameSet(meds.map((p) => p.key), MEDICATIONS.map(medKey)), `found ${meds.length}`);
  check('no unprefixed products', unprefixed.length === 0, unprefixed.map((p) => p.key).join(', '));
  const unpublished = products.filter((p) => !p.published);
  check('all products published', unpublished.length === 0, unpublished.map((p) => p.key).join(', '));
  const nonUsd = products.filter((p) => [p.master, ...p.variants].some((v) => (v.prices ?? []).length === 0 || (v.prices ?? []).some((x) => x.value.currencyCode !== 'USD')));
  check('every variant has prices and all are USD', nonUsd.length === 0, nonUsd.map((p) => p.key).join(', '));
  if (images) {
    const bad = products.filter((p) => {
      const urls = [p.master, ...p.variants].flatMap((v) => (v.images ?? []).map((i) => i.url));
      return urls.length === 0 || urls.some((u) => u.includes('?') || u.includes('#'));
    });
    check('every product has images and every image URL is clean (no ? or #)', bad.length === 0, bad.map((p) => p.key).join(', '));
  }

  // ---- doctor fees in cents and modes consistent with price channels
  const channels = await listAll(root, 'channels');
  const channelKeyById = new Map(channels.map((c) => [c.id as string, c.key as string]));
  const wrongDoctors: string[] = [];
  for (const d of DOCTORS) {
    const p = doctors.find((x) => x.key === doctorKey(d));
    if (!p) continue;
    const prices = (p.master.prices ?? []).map((x) => `${x.channel?.key ?? channelKeyById.get(x.channel?.id ?? '') ?? '?'}=${x.value.centAmount}`);
    const wanted = Object.entries(d.fees).map(([mode, cents]) => `${PREFIX}${mode}=${cents}`);
    const modes = ((p.master.attributes ?? []).find((a) => a.name === 'modes')?.value as unknown[] | undefined ?? []).map(keyOf).map((m) => `${PREFIX}${m}`);
    if (!sameSet(prices, wanted) || !sameSet(modes, wanted.map((w) => w.split('=')[0])) || p.master.sku !== doctorSku(d)) wrongDoctors.push(d.slug);
  }
  check('doctor fees (cents) and modes match the price channels', wrongDoctors.length === 0, wrongDoctors.join(', '));

  const wrongMeds = MEDICATIONS.filter((d) => {
    const p = meds.find((x) => x.key === medKey(d));
    return !p || p.master.sku !== medSku(d) || p.master.prices?.[0]?.value.centAmount !== d.priceCents;
  });
  check('medication SKUs and prices (cents)', wrongMeds.length === 0, wrongMeds.map((d) => d.slug).join(', '));

  // ---- inventory
  const inventory = await listAll(root, 'inventory');
  const wrongInv = MEDICATIONS.filter((d) => {
    const i = inventory.find((x) => x.key === inventoryKey(medSku(d)));
    return !i || (i.quantityOnStock as number) < 500 || (i.maxCartQuantity ?? undefined) !== d.maxQtyPerOrder;
  });
  check('inventory entry per medication SKU (stock >= 500, cart limit = maxQtyPerOrder)', wrongInv.length === 0, wrongInv.map((d) => d.slug).join(', '));
  const dated = MEDICATIONS.filter((d) => d.expiryDate);
  const datedOk = dated.every((d) => ((inventory.find((x) => x.sku === medSku(d))?.custom as { fields?: Rec } | undefined)?.fields?.expiryDate) === d.expiryDate);
  check('short-dated demo SKU carries expiryDate', dated.length > 0 && datedOk);
  check('no unprefixed inventory entries', inventory.every(hasPrefix), `${inventory.filter((i) => !hasPrefix(i)).length} found`);

  // ---- shipping, tax, zones
  const methods = await listAll(root, 'shippingMethods');
  check('exactly the two mlv- shipping methods', sameSet(methods.map((m) => m.key as string), SHIPPING_METHODS.map((m) => m.key)), methods.map((m) => String(m.key)).join(', '));
  for (const want of SHIPPING_METHODS) {
    const have = methods.find((m) => m.key === want.key);
    const cents = (have?.zoneRates as { shippingRates: { price: { centAmount: number } }[] }[] | undefined)?.[0]?.shippingRates[0]?.price.centAmount;
    check(`${want.key} costs ${want.zoneRates[0].shippingRates[0].price.centAmount} cents`, cents === want.zoneRates[0].shippingRates[0].price.centAmount, `found ${String(cents)}`);
  }
  check('only mlv- tax categories', sameSet((await listAll(root, 'taxCategories')).map((t) => t.key as string), TAX_CATEGORIES.map((t) => t.key)));
  const zones = await listAll(root, 'zones');
  const sameDay = zones.find((z) => z.key === SAME_DAY_ZONE.key);
  check('same-day zone has NY, TX, IL', !!sameDay && sameSet(((sameDay.locations as { state?: string }[]) ?? []).map((l) => l.state ?? ''), SAME_DAY_ZONE.locations.map((l) => l.state)));

  // ---- structure
  const states = await listAll(root, 'states');
  const stateKeyById = new Map(states.map((s) => [s.id as string, s.key as string]));
  const statesOk = STATES.every((want) => {
    const have = states.find((s) => s.key === want.key);
    const transitions = ((have?.transitions as { id?: string; key?: string }[]) ?? []).map((t) => t.key ?? stateKeyById.get(t.id ?? '') ?? '?');
    return !!have && sameSet(transitions, want.transitions);
  });
  check('order states and transitions', statesOk);
  check('custom types', sameSet((await listAll(root, 'types')).map((t) => t.key as string), CUSTOM_TYPES.map((t) => t.key)));
  check('product types', sameSet((await listAll(root, 'productTypes')).map((t) => t.key as string), PRODUCT_TYPES.map((t) => t.key)));
  check('price channels', sameSet(channels.map((c) => c.key as string), CHANNELS.map((c) => c.key)));
  check('categories match the data file', sameSet((await listAll(root, 'categories')).map((c) => c.key as string), CATEGORIES.map((c) => c.key)));

  // ---- search
  if (search) {
    const res = await root.products().search().post({ body: { query: { fullText: { field: 'name', language: 'en-US', value: 'Okafor' } }, limit: 1 } as never }).execute();
    check('Product Search finds "Okafor"', (res.body as { total: number }).total >= 1, 'index may still be filling: run wait-for-search.ts');
  }
  return checks;
}

export const formatChecks = (checks: Check[]): string => checks.map((c) => `${c.ok ? 'PASS' : 'FAIL'}  ${c.name}${c.detail ? `  (${c.detail})` : ''}`).join('\n');

async function main() {
  const argv = process.argv.slice(2);
  const { root } = await getAdminRoot();
  const checks = await runVerify(root, { search: !argv.includes('--skip-search'), images: !argv.includes('--no-images') });
  console.log(formatChecks(checks));
  const failed = checks.filter((c) => !c.ok).length;
  console.log(failed === 0 ? `all ${checks.length} checks passed` : `${failed} of ${checks.length} checks failed`);
  if (failed > 0) process.exit(1);
}

if (isMain(__filename)) main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
