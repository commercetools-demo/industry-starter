// seed:verify checks of the coordinated release (workstream X): no record is stuck, every scheduled release still holds.
import type { CtApi } from '../lib';
import { revalidateRecord } from '../release/revalidate';
import { listRecords } from '../release/store';
import type { Check, CheckResult } from './platform';

export function releaseCheck(now: () => Date = () => new Date()): Check {
  return {
    name: 'scheduled releases (no record applying or inconsistent; scheduled releases revalidate)',
    async run(api: CtApi): Promise<CheckResult> {
      const records = await listRecords(api);
      const problems: string[] = [];
      let scheduled = 0;
      for (const record of records) {
        const result = await revalidateRecord(api, record, now());
        if (record.status === 'scheduled' && !result.effective) scheduled += 1;
        for (const problem of result.problems) problems.push(`${record.key}: ${problem}`);
      }
      if (problems.length > 0) return { ok: false, detail: problems.join(' | ') };
      return { ok: true, detail: `${records.length} record(s), ${scheduled} scheduled` };
    },
  };
}

export const releaseChecks: Check[] = [releaseCheck()];
