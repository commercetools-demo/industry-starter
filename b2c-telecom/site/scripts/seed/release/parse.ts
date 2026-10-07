// Release manifest parsing: hand-written checks (no schema library), canonical hash.
import { createHash } from 'node:crypto';
import { RELEASE_KEY_PATTERN, type Issue, type ReleaseManifest } from './types';

export class ManifestError extends Error {
  constructor(readonly issues: Issue[]) {
    super(issues.map((i) => `${i.code} ${i.key}: ${i.message}`).join('\n'));
    this.name = 'ManifestError';
  }
}

const ALLOWED_FIELDS = [
  'schema',
  'key',
  'name',
  'author',
  'releaseAt',
  'endsAt',
  'createOffers',
  'patchOffers',
  'withdrawOffers',
  'reinstateOffers',
  'replaces',
  'createCartDiscounts',
  'withdrawCartDiscounts',
  'reinstateCartDiscounts',
  'externalChecklist',
  'expedite',
  'rollbackOf',
] as const;

/** Resources a campaign must never touch: naming one as a manifest field is refused (rule 6). */
export const FORBIDDEN_FIELDS = ['productTypes', 'categories', 'taxCategories', 'zones', 'shippingMethods', 'customers', 'orders', 'customerGroups', 'recurrencePolicies'];

export const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;

export function isIsoUtc(value: unknown): value is string {
  return typeof value === 'string' && ISO_UTC.test(value) && !Number.isNaN(Date.parse(value));
}

type Obj = Record<string, unknown>;

const isObject = (value: unknown): value is Obj => typeof value === 'object' && value !== null && !Array.isArray(value);
const isStringArray = (value: unknown): value is string[] => Array.isArray(value) && value.every((v) => typeof v === 'string');

/** Parses JSON text or an already parsed value. Throws ManifestError listing every problem. */
export function parseReleaseManifest(input: unknown): ReleaseManifest {
  let raw: unknown = input;
  if (typeof input === 'string') {
    try {
      raw = JSON.parse(input);
    } catch (err) {
      throw new ManifestError([{ code: 'PARSE', key: '-', message: `not valid JSON: ${err instanceof Error ? err.message : String(err)}`, severity: 'error' }]);
    }
  }
  const issues: Issue[] = [];
  const add = (code: string, key: string, message: string): void => void issues.push({ code, key, message, severity: 'error' });
  if (!isObject(raw)) throw new ManifestError([{ code: 'PARSE', key: '-', message: 'the manifest must be a JSON object', severity: 'error' }]);
  const key = typeof raw.key === 'string' ? raw.key : '-';

  for (const field of Object.keys(raw)) {
    if (FORBIDDEN_FIELDS.includes(field)) add('FORBIDDEN_RESOURCE', field, `a release cannot change ${field} (full reindex or not campaign data)`);
    else if (!(ALLOWED_FIELDS as readonly string[]).includes(field)) add('PARSE', field, 'unknown field');
  }
  if (raw.schema !== 1) add('PARSE', 'schema', 'must be 1');
  if (typeof raw.key !== 'string' || !RELEASE_KEY_PATTERN.test(raw.key)) add('PARSE', 'key', `must match ${RELEASE_KEY_PATTERN.source}`);
  for (const field of ['name', 'author'] as const) {
    if (typeof raw[field] !== 'string' || (raw[field] as string).trim() === '') add('PARSE', field, 'must be a non-empty string');
  }
  if (!isIsoUtc(raw.releaseAt)) add('PARSE', 'releaseAt', 'must be an ISO-8601 UTC instant ending in Z, e.g. "2026-11-15T09:00:00Z"');
  if (raw.endsAt !== undefined && !isIsoUtc(raw.endsAt)) add('PARSE', 'endsAt', 'must be an ISO-8601 UTC instant ending in Z');

  const list = (field: string, check: (item: unknown) => boolean, what: string): void => {
    const value = raw[field];
    if (value !== undefined && !(Array.isArray(value) && value.every(check))) add('PARSE', field, `must be a list of ${what}`);
  };
  list('createOffers', (o) => isObject(o) && typeof o.key === 'string', 'offer manifests (objects with a key)');
  list('patchOffers', (o) => isObject(o) && typeof o.key === 'string', 'offer patches (objects with a key)');
  list('createCartDiscounts', (o) => isObject(o) && typeof o.key === 'string', 'cart discount manifests (objects with a key)');
  list('replaces', (o) => isObject(o) && typeof o.old === 'string' && typeof o.new === 'string', '{ old, new } pairs');
  for (const field of ['withdrawOffers', 'reinstateOffers', 'withdrawCartDiscounts', 'reinstateCartDiscounts', 'externalChecklist']) {
    if (raw[field] !== undefined && !isStringArray(raw[field])) add('PARSE', field, 'must be a list of strings');
  }
  if (raw.expedite !== undefined && !(isObject(raw.expedite) && typeof raw.expedite.reason === 'string')) add('PARSE', 'expedite', 'must be { reason: string }');
  if (raw.rollbackOf !== undefined && typeof raw.rollbackOf !== 'string') add('PARSE', 'rollbackOf', 'must be a release key');
  if (issues.length > 0) throw new ManifestError(issues.map((i) => (i.key === '-' ? { ...i, key } : i)));

  return {
    schema: 1,
    key: raw.key as string,
    name: raw.name as string,
    author: raw.author as string,
    releaseAt: raw.releaseAt as string,
    ...(raw.endsAt !== undefined ? { endsAt: raw.endsAt as string } : {}),
    createOffers: (raw.createOffers ?? []) as ReleaseManifest['createOffers'],
    patchOffers: (raw.patchOffers ?? []) as ReleaseManifest['patchOffers'],
    withdrawOffers: (raw.withdrawOffers ?? []) as string[],
    reinstateOffers: (raw.reinstateOffers ?? []) as string[],
    replaces: (raw.replaces ?? []) as ReleaseManifest['replaces'],
    createCartDiscounts: (raw.createCartDiscounts ?? []) as ReleaseManifest['createCartDiscounts'],
    withdrawCartDiscounts: (raw.withdrawCartDiscounts ?? []) as string[],
    reinstateCartDiscounts: (raw.reinstateCartDiscounts ?? []) as string[],
    externalChecklist: (raw.externalChecklist ?? []) as string[],
    ...(raw.expedite !== undefined ? { expedite: raw.expedite as { reason: string } } : {}),
    ...(raw.rollbackOf !== undefined ? { rollbackOf: raw.rollbackOf as string } : {}),
  };
}

/** JSON with object keys sorted recursively, so equal content always hashes the same. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Obj)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function sha256OfManifest(manifest: ReleaseManifest): string {
  return createHash('sha256').update(canonicalJson(manifest)).digest('hex');
}
