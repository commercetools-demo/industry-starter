// Release records: Custom Objects in container `malva-releases`, key = release key
// (docs: https://docs.commercetools.com/api/projects/custom-objects). Needs the scope manage_key_value_documents.
import type { CtApi } from '../lib';
import { getAll } from '../reconcilers/util';
import { RELEASE_CONTAINER, type ReleaseRecord } from './types';

export async function getRecord(api: CtApi, key: string): Promise<ReleaseRecord | null> {
  const object = (await api.get(`custom-objects/${RELEASE_CONTAINER}/${key}`)) as { value?: ReleaseRecord } | null;
  return object?.value ?? null;
}

/** Upsert (POST /custom-objects with container and key); no version is sent, the last write wins. */
export async function putRecord(api: CtApi, record: ReleaseRecord): Promise<void> {
  await api.post('custom-objects', { container: RELEASE_CONTAINER, key: record.key, value: record });
}

export async function listRecords(api: CtApi): Promise<ReleaseRecord[]> {
  const objects = await getAll(api, 'custom-objects', { where: `container="${RELEASE_CONTAINER}"` });
  return objects.map((o) => o.value as ReleaseRecord).filter(Boolean);
}
