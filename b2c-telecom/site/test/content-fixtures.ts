import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const created: string[] = [];

/** Writes `{ 'en-US/about.md': '...' }` into a fresh temporary content root and returns its path. */
export function makeContentRoot(files: Record<string, string>): string {
  const root = mkdtempSync(path.join(os.tmpdir(), 'malva-content-'));
  created.push(root);
  for (const [relative, text] of Object.entries(files)) {
    const full = path.join(root, relative);
    mkdirSync(path.dirname(full), { recursive: true });
    writeFileSync(full, text);
  }
  return root;
}

export function removeContentRoots(): void {
  for (const root of created.splice(0)) rmSync(root, { recursive: true, force: true });
}

export function pageFile(title: string, body = 'Body', extra = ''): string {
  return `---\ntitle: ${title}\ndescription: ${title} description\n${extra}---\n${body}\n`;
}
