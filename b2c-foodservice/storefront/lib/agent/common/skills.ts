// Copyright 2026 Anthropic PBC
// SPDX-License-Identifier: Apache-2.0
// Adapted from commerce-common/commerce_common/skills.py; changes: no filesystem walk (skills are generated into a source module at build time, see scripts/skills-generate.mjs); minimal frontmatter parser (name and description are single-line scalars); an empty registry throws instead of rendering "(no skills installed)".

/** Skill loading. A skill is a `SKILL.md`: frontmatter with `name` and `description`, then the instructions. The static prompt carries the index and `load_skill` returns a body on demand. */

export interface Skill {
  readonly name: string;
  readonly description: string;
  readonly body: string;
}

export class SkillLoadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SkillLoadError';
  }
}

function unquote(value: string): string {
  const v = value.trim();
  if (v.length >= 2 && ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))) return v.slice(1, -1);
  return v;
}

export function parseSkillMd(text: string, path = 'SKILL.md'): Skill {
  const normalised = text.replace(/\r\n/g, '\n');
  if (!normalised.startsWith('---')) throw new SkillLoadError(`${path}: missing YAML frontmatter`);
  const parts = normalised.split('---');
  if (parts.length < 3) throw new SkillLoadError(`${path}: malformed frontmatter fences`);
  const frontmatter = parts[1];
  // Python splits on the first two fences only; the body may itself contain "---" (a horizontal rule).
  const body = parts.slice(2).join('---').trim();
  const meta: Record<string, string> = {};
  for (const line of frontmatter.split('\n')) {
    const match = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line);
    if (match) meta[match[1]] = unquote(match[2]);
  }
  if (!meta.name || !meta.description) throw new SkillLoadError(`${path}: frontmatter needs \`name\` and \`description\``);
  return { name: meta.name, description: meta.description.trim(), body };
}

/** The loaded skills, sorted by name so the index renders the same bytes every time. */
export class SkillRegistry {
  private readonly skills: readonly Skill[];
  private readonly byName: ReadonlyMap<string, Skill>;

  /** @throws SkillLoadError when there are no skills or a name repeats: an empty registry would bake "(no skills installed)" into the cached static prompt and the agent would run every turn with no flows and no error anywhere. */
  constructor(skills: readonly Skill[]) {
    if (skills.length === 0) throw new SkillLoadError('no skills installed: refusing to build a prompt without its flows');
    const names = skills.map((s) => s.name);
    const duplicates = names.filter((n, i) => names.indexOf(n) !== i);
    if (duplicates.length > 0) throw new SkillLoadError(`duplicate skill names: ${[...new Set(duplicates)].sort().join(', ')}`);
    this.skills = [...skills].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    this.byName = new Map(this.skills.map((s) => [s.name, s]));
  }

  static fromSources(sources: ReadonlyArray<{ readonly path: string; readonly text: string }>): SkillRegistry {
    return new SkillRegistry(sources.map((s) => parseSkillMd(s.text, s.path)));
  }

  get names(): string[] {
    return this.skills.map((s) => s.name);
  }

  indexBlock(): string {
    return this.skills.map((s) => `- \`${s.name}\` — ${s.description}`).join('\n');
  }

  getInstructions(name: string): string | null {
    return this.byName.get(name)?.body ?? null;
  }
}
