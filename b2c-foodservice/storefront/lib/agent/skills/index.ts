import { SkillRegistry } from '../common/skills';
import { SKILL_SOURCES } from './skills.generated';

/** The installed skills: search-discovery, purchase-research, planning-goals, customer-care (memory-personalization is not installed, memory is off). Throws when the generated module is empty. */
export function loadSkillRegistry(): SkillRegistry {
  return SkillRegistry.fromSources(SKILL_SOURCES);
}
