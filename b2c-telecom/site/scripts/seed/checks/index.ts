// Registry of seed:verify checks. Workstream G appends checks/catalog.ts, X appends checks/releases.ts.
import { catalogChecks } from './catalog';
import { platformChecks, type Check } from './platform';

export type { Check, CheckResult } from './platform';

export const checks: Check[] = [...platformChecks, ...catalogChecks];
