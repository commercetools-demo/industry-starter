import type { AllowanceStore, StoredValue } from '@/lib/funding/allowance-core';

/** The part of a commercetools client this store calls (a real `ByProjectKeyRequestBuilder` satisfies it; callers cast, so this file imports no SDK). */
export interface CustomObjectsRoot {
  customObjects(): {
    post(args: { body: { container: string; key: string; value: unknown; version?: number } }): { execute(): Promise<{ body: { key: string; version: number; value: unknown } }> };
    withContainerAndKey(args: { container: string; key: string }): { get(): { execute(): Promise<{ body: { key: string; version: number; value: unknown } }> } };
    withContainer(args: { container: string }): {
      get(args: { queryArgs: { limit: number; offset: number; where?: string } }): { execute(): Promise<{ body: { results: { key: string; version: number; value: unknown }[] } }> };
    };
  };
}

/**
 * An `AllowanceStore` over Custom Objects for any commercetools client (workstream U). It carries no `server-only`
 * import and reads no environment, so the reload script (admin client) and the Netlify scheduled function (their own
 * client, outside Next) can run the same allowance code as the storefront. The storefront itself uses
 * `lib/ct/custom-objects.ts`, which is the same three calls.
 */

const statusOf = (e: unknown): number | undefined => (e as { statusCode?: number } | undefined)?.statusCode;

export function customObjectsStore(root: CustomObjectsRoot): AllowanceStore {
  return {
    async get<T>(container: string, key: string): Promise<StoredValue<T> | null> {
      try {
        const { body } = await root.customObjects().withContainerAndKey({ container, key }).get().execute();
        return { key: body.key, version: body.version, value: body.value as T };
      } catch (error) {
        if (statusOf(error) === 404) return null;
        throw error;
      }
    },
    async put<T>(container: string, key: string, value: T, version?: number): Promise<StoredValue<T>> {
      const { body } = await root.customObjects().post({ body: { container, key, value, ...(version !== undefined ? { version } : {}) } }).execute();
      return { key: body.key, version: body.version, value: body.value as T };
    },
    async createOnly<T>(container: string, key: string, value: T): Promise<boolean> {
      try {
        await root.customObjects().post({ body: { container, key, value, version: 0 } }).execute();
        return true;
      } catch (error) {
        if (statusOf(error) === 409) return false;
        throw error;
      }
    },
    async query<T>(container: string, where?: string): Promise<StoredValue<T>[]> {
      const out: StoredValue<T>[] = [];
      for (let offset = 0; ; offset += 200) {
        const { body } = await root.customObjects().withContainer({ container }).get({ queryArgs: { limit: 200, offset, ...(where ? { where } : {}) } }).execute();
        out.push(...body.results.map((o) => ({ key: o.key, version: o.version, value: o.value as T })));
        if (body.results.length < 200) return out;
      }
    },
  };
}
