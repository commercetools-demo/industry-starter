// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const dir = __dirname;
const files = readdirSync(dir).filter((name) => /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name));

// The catalog is identical for every buyer (D-058): cached reads are shared, so none may read the session.
describe('no session in cached functions', () => {
  it('no file under lib/ct imports both unstable_cache and the session module', () => {
    const offenders = files.filter((name) => {
      const source = readFileSync(path.join(dir, name), 'utf8');
      const usesCache = /\bunstable_cache\b/.test(source);
      const usesSession = /from\s+['"](@\/lib\/ct\/session|\.\/session)['"]/.test(source);
      return usesCache && usesSession;
    });
    expect(offenders).toEqual([]);
  });

  it('the guard sees the catalog files', () => {
    expect(files).toEqual(expect.arrayContaining(['catalog.ts', 'categories.ts', 'session.ts']));
  });
});
