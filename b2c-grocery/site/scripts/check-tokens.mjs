import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HEX = /#[0-9a-fA-F]{3,8}\b/;
const EXTENSIONS = new Set(['.ts', '.tsx', '.css']);
const ROOTS = ['app', 'components'];

const isExempt = (file) => {
  const base = path.basename(file);
  return base === 'globals.css' || /\.test\./.test(base) || /^(icon|opengraph-image)/.test(base);
};

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

/** Lists `file:line` for every hex colour outside the token file. `dir` is the project root (site/). */
export function findHardcodedColors(dir) {
  const hits = [];
  for (const root of ROOTS) {
    let files;
    try {
      files = walk(path.join(dir, root));
    } catch {
      continue;
    }
    for (const file of files) {
      if (!EXTENSIONS.has(path.extname(file)) || isExempt(file)) continue;
      readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
        if (HEX.test(line)) hits.push(`${path.relative(dir, file)}:${i + 1}`);
      });
    }
  }
  return hits;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const hits = findHardcodedColors(process.cwd());
  if (hits.length > 0) {
    console.error(`Hard-coded colours found (use design tokens):\n${hits.join('\n')}`);
    process.exit(1);
  }
}
