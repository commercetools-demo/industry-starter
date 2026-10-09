import { evalPredicate } from './fake-predicate';

/**
 * In-memory Custom Objects for unit tests; never the network.
 * Models the parts the code relies on: create-only `version: 0` (409 when the object exists), optimistic
 * concurrency on a given version, delete with an optional version, query by container with a simple `value(...)` predicate.
 */
export interface FakeObject { id: string; container: string; key: string; version: number; value: unknown; createdAt: string; lastModifiedAt: string }

export interface FakeObjects {
  objects: FakeObject[];
  /** Return an error to make the matching write fail. */
  failOn?: (op: 'post' | 'delete', container: string, key: string) => Error | undefined;
  calls: { op: string; container: string; key?: string; dataErasure?: boolean }[];
  customObjects: () => unknown;
}

const err = (statusCode: number, message: string) => Object.assign(new Error(message), { statusCode, code: statusCode });

/** `value(<predicate>)` evaluated with `evalPredicate` (equality, `in`, `is defined`, comparisons, nesting, `and`); any other predicate matches everything. */
export function matchPredicate(o: FakeObject, where?: string): boolean {
  if (!where) return true;
  const inner = /^value\((.*)\)$/.exec(where.trim());
  if (!inner) return true;
  return evalPredicate(o.value, inner[1], false);
}

export function createFakeObjects(): FakeObjects {
  const self: FakeObjects = { objects: [], calls: [], customObjects: undefined as never };
  let n = 0;
  const find = (container: string, key: string) => self.objects.find((o) => o.container === container && o.key === key);
  self.customObjects = () => ({
    // every object of the project, paged (the full reset lists all `malva-*` containers this way)
    get: (a: { queryArgs?: { limit?: number; offset?: number } } = {}) => ({
      execute: async () => {
        self.calls.push({ op: 'query', container: '*' });
        const { limit = 20, offset = 0 } = a.queryArgs ?? {};
        return { body: { results: structuredClone(self.objects.slice(offset, offset + limit)), count: Math.min(limit, self.objects.length), total: self.objects.length, limit, offset } };
      },
    }),
    post: (a: { body: { container: string; key: string; value: unknown; version?: number } }) => ({
      execute: async () => {
        const { container, key, value, version } = a.body;
        self.calls.push({ op: 'post', container, key });
        const injected = self.failOn?.('post', container, key);
        if (injected) throw injected;
        const existing = find(container, key);
        const now = new Date().toISOString();
        if (existing) {
          if (version !== undefined && version !== existing.version) throw err(409, `version mismatch: expected ${version}, actual ${existing.version}`);
          existing.value = structuredClone(value);
          existing.version += 1;
          existing.lastModifiedAt = now;
          return { statusCode: 200, body: structuredClone(existing) };
        }
        if (version !== undefined && version !== 0) throw err(409, 'version given but the object does not exist');
        const created: FakeObject = { id: `co-${(n += 1)}`, container, key, version: 1, value: structuredClone(value), createdAt: now, lastModifiedAt: now };
        self.objects.push(created);
        return { statusCode: 201, body: structuredClone(created) };
      },
    }),
    withContainerAndKey: (s: { container: string; key: string }) => ({
      get: () => ({
        execute: async () => {
          self.calls.push({ op: 'get', container: s.container, key: s.key });
          const o = find(s.container, s.key);
          if (!o) throw err(404, 'not found');
          return { body: structuredClone(o) };
        },
      }),
      delete: (a: { queryArgs?: { version?: number; dataErasure?: boolean } } = {}) => ({
        execute: async () => {
          self.calls.push({ op: 'delete', container: s.container, key: s.key, dataErasure: a.queryArgs?.dataErasure });
          const injected = self.failOn?.('delete', s.container, s.key);
          if (injected) throw injected;
          const o = find(s.container, s.key);
          if (!o) throw err(404, 'not found');
          if (a.queryArgs?.version !== undefined && a.queryArgs.version !== o.version) throw err(409, 'version mismatch');
          self.objects = self.objects.filter((x) => x !== o);
          return { body: structuredClone(o) };
        },
      }),
    }),
    withContainer: (s: { container: string }) => ({
      get: (a: { queryArgs?: { where?: string; limit?: number; offset?: number } } = {}) => ({
        execute: async () => {
          self.calls.push({ op: 'query', container: s.container });
          const { where, limit = 20, offset = 0 } = a.queryArgs ?? {};
          const all = self.objects.filter((o) => o.container === s.container && matchPredicate(o, where));
          return { body: { results: structuredClone(all.slice(offset, offset + limit)), count: Math.min(limit, all.length), total: all.length, limit, offset } };
        },
      }),
    }),
  });
  return self;
}
