// @vitest-environment node
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { findHardcodedColors } from './check-tokens.mjs';

function project(files: Record<string, string>) {
  const root = mkdtempSync(path.join(tmpdir(), 'tok-'));
  for (const [rel, content] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    writeFileSync(path.join(root, rel), content);
  }
  return root;
}

describe('findHardcodedColors', () => {
  it('flags a hex colour in a component', () => {
    const hits = findHardcodedColors(project({ 'components/ui/x.tsx': 'export const c = "#fff";\n' }));
    expect(hits).toEqual(['components/ui/x.tsx:1']);
  });
  it('ignores globals.css, tests and icon files', () => {
    const root = project({
      'app/globals.css': ':root { --bg: #fafafa; }\n',
      'components/x.test.tsx': 'const c = "#fff";\n',
      'app/icon.tsx': 'const c = "#abcdef";\n',
    });
    expect(findHardcodedColors(root)).toEqual([]);
  });
  it('passes when there are no hex colours', () => {
    expect(findHardcodedColors(project({ 'app/page.tsx': 'export default function P() { return null; }\n' }))).toEqual([]);
  });
});
