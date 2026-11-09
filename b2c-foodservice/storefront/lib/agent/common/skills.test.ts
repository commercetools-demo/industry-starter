// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadSkillRegistry } from '../skills';
import { SkillLoadError, SkillRegistry, parseSkillMd } from './skills';

describe('skills', () => {
  it('Empty registry fails loudly', () => {
    expect(() => new SkillRegistry([])).toThrow(SkillLoadError);
  });

  it('Duplicate names are refused', () => {
    const s = { name: 'a', description: 'd', body: 'b' };
    expect(() => new SkillRegistry([s, s])).toThrow(/duplicate/);
  });

  it('Frontmatter is parsed, a horizontal rule in the body survives', () => {
    const skill = parseSkillMd('---\nname: x\ndescription: "Does a thing"\n---\n\n# T\n\nA\n\n---\n\nB\n');
    expect(skill).toEqual({ name: 'x', description: 'Does a thing', body: '# T\n\nA\n\n---\n\nB' });
    expect(() => parseSkillMd('no frontmatter')).toThrow(/frontmatter/);
    expect(() => parseSkillMd('---\nname: x\n---\nbody')).toThrow(/name.*description/);
  });

  it('Generated module is current and equals the SKILL.md files byte for byte', () => {
    const dir = join(__dirname, '..', 'skills');
    const names = readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
    const registry = loadSkillRegistry();
    expect(registry.names).toEqual(names);
    expect(names).toEqual(['customer-care', 'planning-goals', 'purchase-research', 'search-discovery']);
    for (const name of names) {
      const body = parseSkillMd(readFileSync(join(dir, name, 'SKILL.md'), 'utf8')).body;
      expect(registry.getInstructions(name)).toBe(body);
    }
  });

  it('The index is one line per skill, sorted, and the same bytes twice', () => {
    const a = loadSkillRegistry().indexBlock();
    expect(a).toBe(loadSkillRegistry().indexBlock());
    const lines = a.split('\n');
    expect(lines).toHaveLength(4);
    expect(lines.every((l) => l.startsWith('- `'))).toBe(true);
    expect([...lines].sort()).toEqual(lines);
  });

  it('An unknown skill is null', () => {
    expect(loadSkillRegistry().getInstructions('nope')).toBeNull();
  });
});
