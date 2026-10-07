// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const SITE = path.resolve(__dirname, '..');

describe('reference slice', () => {
  it.each(['lib/ct/session.ts', 'app/api/auth/session/route.ts', 'hooks/useSession.ts'])('%s exists and is named in the README', (file) => {
    expect(existsSync(path.join(SITE, file)), file).toBe(true);
    expect(readFileSync(path.join(SITE, 'README.md'), 'utf8')).toContain(`\`${file}\``);
  });
});
