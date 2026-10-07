// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '../..');
const isSource = (name: string): boolean => /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name);
const sources = [
  ...readdirSync(__dirname).filter(isSource).map((name) => path.join(__dirname, name)),
  ...readdirSync(path.join(root, 'lib/home')).filter(isSource).map((name) => path.join(root, 'lib/home', name)),
  path.join(root, 'app/[locale]/page.tsx'),
];
const FORBIDDEN = [/next\/headers/, /session/i, /useCart/, /useSession/, /buyer-context/, /visible-offers/, /lib\/market\/server/];

describe('home sources', () => {
  it('Expired session: home sources import no session or cart module', () => {
    const offenders = sources.flatMap((file) =>
      readFileSync(file, 'utf8')
        .split('\n')
        .filter((line) => /^\s*(import|export)\b.*\bfrom\b/.test(line) && FORBIDDEN.some((pattern) => pattern.test(line)))
        .map((line) => `${path.relative(root, file)}: ${line.trim()}`),
    );
    expect(offenders).toEqual([]);
  });

  it('the guard sees the home files', () => {
    expect(sources.length).toBeGreaterThanOrEqual(7);
  });
});
