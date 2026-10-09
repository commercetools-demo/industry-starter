// Crawls a running site (default http://localhost:3000) through its sitemap and checks every public page.
// Usage: node scripts/seo-audit.mjs [baseUrl] [--out report.md]
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const decode = (s) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const pick = (html, re) => { const m = html.match(re); return m ? decode(m[1]) : undefined; };
const metaContent = (html, attr, name) => pick(html, new RegExp(`<meta[^>]+${attr}="${name}"[^>]+content="([^"]*)"`)) ?? pick(html, new RegExp(`<meta[^>]+content="([^"]*)"[^>]+${attr}="${name}"`));

export function auditPage(html, expectedPath) {
  const problems = [];
  const title = pick(html, /<title[^>]*>([^<]*)<\/title>/);
  const description = metaContent(html, 'name', 'description');
  const canonical = pick(html, /<link[^>]+rel="canonical"[^>]+href="([^"]*)"/);
  const hreflangs = [...html.matchAll(/<link[^>]+rel="alternate"[^>]+hrefLang="([^"]*)"/gi)].map((m) => m[1]);
  const h1s = (html.match(/<h1[\s>]/g) ?? []).length;
  if (!title) problems.push('no title'); else if (title.length > 60) problems.push(`title is ${title.length} characters`);
  if (!description) problems.push('no description'); else if (description.length > 160) problems.push(`description is ${description.length} characters`);
  if (!canonical || !canonical.startsWith('http')) problems.push('canonical missing or not absolute');
  else if (!canonical.endsWith(expectedPath)) problems.push(`canonical ${canonical} does not end with ${expectedPath}`);
  if (!['en-US', 'de-DE', 'x-default'].every((l) => hreflangs.includes(l))) problems.push(`hreflang incomplete: ${hreflangs.join(',') || 'none'}`);
  if (!metaContent(html, 'property', 'og:title')) problems.push('no og:title');
  if (!metaContent(html, 'property', 'og:image')) problems.push('no og:image');
  if (!metaContent(html, 'name', 'twitter:card')) problems.push('no twitter:card');
  if (h1s !== 1) problems.push(`${h1s} h1 elements`);
  if (!/<html[^>]+lang="[a-z]{2}-[A-Z]{2}"/.test(html)) problems.push('no lang attribute');
  for (const [, body] of html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
    try { const j = JSON.parse(body.replace(/\\u003c/g, '<')); if (JSON.stringify(j).match(/sample/i)) problems.push('JSON-LD mentions sample content'); } catch { problems.push('JSON-LD does not parse'); }
  }
  return { title, description, canonical, problems };
}

export function crossChecks(pages) {
  const problems = [];
  for (const key of ['title', 'description']) {
    const seen = new Map();
    // The same word can be the right title in both languages ("Recycling"), so uniqueness is per locale.
    for (const p of pages) { const v = p[key]; if (!v) continue; const k = `${p.path.split('/')[1]}|${v}`; (seen.get(k) ?? seen.set(k, []).get(k)).push(p.path); }
    for (const [k, paths] of seen) if (paths.length > 1) problems.push(`duplicate ${key} "${k.split('|')[1]}": ${paths.join(', ')}`);
  }
  return problems;
}

async function main() {
  const base = (process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'http://localhost:3000').replace(/\/$/, '');
  const outIdx = process.argv.indexOf('--out');
  const xml = await (await fetch(`${base}/sitemap.xml`)).text();
  const paths = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(decode(m[1])).pathname);
  const results = [];
  for (const path of paths) {
    const res = await fetch(`${base}${path}`);
    const r = res.ok ? auditPage(await res.text(), path) : { problems: [`HTTP ${res.status}`] };
    results.push({ path, ...r });
  }
  const cross = crossChecks(results);
  const failures = results.filter((r) => r.problems.length);
  const lines = [`# SEO audit of ${base}`, '', `${results.length} pages crawled from the sitemap; ${failures.length} with problems; ${cross.length} cross-page problems.`, '', '| Page | Title | Result |', '| --- | --- | --- |', ...results.map((r) => `| ${r.path} | ${r.title ?? ''} | ${r.problems.length ? r.problems.join('; ') : 'ok'} |`), '', ...cross.map((c) => `- ${c}`)];
  if (outIdx > 0) writeFileSync(process.argv[outIdx + 1], lines.join('\n') + '\n');
  console.log(lines.join('\n'));
  process.exit(failures.length || cross.length ? 1 : 0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
