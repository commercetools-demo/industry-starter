import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { checkMessages, flatten, usedKeys } from './check-messages.mjs';

const dirs = [];
function tmp(files) {
  const root = mkdtempSync(path.join(tmpdir(), 'malva-msg-'));
  dirs.push(root);
  for (const [f, c] of Object.entries(files)) { mkdirSync(path.dirname(path.join(root, f)), { recursive: true }); writeFileSync(path.join(root, f), c); }
  return root;
}
afterEach(() => { while (dirs.length) rmSync(dirs.pop(), { recursive: true, force: true }); });

describe('malva-locale-routing › Message lookup', () => {
  it('flattens nested catalogues', () => expect(flatten({ a: { b: 'x', c: { d: 'y' } }, e: 'z' })).toEqual(['a.b', 'a.c.d', 'e']));
  it('finds namespaced keys, including rich and server translators', () => {
    const src = "const t = useTranslations('nav'); const f = await getTranslations({ namespace: 'footer' });\n t('home'); t.rich('legal', {}); f('copy'); other('no');";
    expect(usedKeys(src)).toEqual(['nav.home', 'nav.legal', 'footer.copy']);
  });
  it('reads the namespace wherever it sits in the options object', () => {
    expect(usedKeys("const t = await getTranslations({ locale, namespace: 'auth.signIn' }); t('title');")).toEqual(['auth.signIn.title']);
  });
  it('a missing key fails, the key present passes', () => {
    const files = { 'messages/en-US.json': '{"nav":{"home":"Home"}}', 'messages/de-DE.json': '{"nav":{"home":"Start"}}' };
    expect(checkMessages(tmp({ ...files, 'app/p.tsx': "const t = useTranslations('nav'); t('home');" }))).toEqual([]);
    expect(checkMessages(tmp({ ...files, 'components/a.tsx': "const t = useTranslations('nav'); t('about');" }))).toEqual(['components/a.tsx uses missing message key nav.about']);
  });
  it('catalogues must have identical keys', () => {
    const problems = checkMessages(tmp({ 'messages/en-US.json': '{"a":"1","b":"2"}', 'messages/de-DE.json': '{"a":"1","c":"3"}' }));
    expect(problems).toEqual(['de-DE.json lacks key b', 'de-DE.json has extra key c']);
  });
  it('requires en-US.json', () => expect(checkMessages(tmp({}))).toEqual(['messages/en-US.json is missing']));
});
