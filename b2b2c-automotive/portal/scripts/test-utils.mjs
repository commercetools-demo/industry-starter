import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach } from 'vitest';

/** Absolute path of the app root (portal/). */
export const appRoot = path.resolve(import.meta.dirname, '..');
/** Reads a file relative to the app root. */
export const readApp = (rel) => readFileSync(path.join(appRoot, rel), 'utf8');

const dirs = [];
afterEach(() => {
  while (dirs.length) rmSync(dirs.pop(), { recursive: true, force: true });
});

/** Creates a temp directory holding `files` (relative path to content) and returns its path. */
export function tmp(files = {}) {
  const root = mkdtempSync(path.join(tmpdir(), 'malva-gate-'));
  dirs.push(root);
  for (const [f, content] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(root, f)), { recursive: true });
    writeFileSync(path.join(root, f), content);
  }
  return root;
}
