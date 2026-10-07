// npm run seed:verify: read-only checks of the seeded project.
import { checks as defaultChecks, type Check } from './checks';
import { consoleLog, exitCodeForError, parseArgs, type Log } from './cli';
import { EXIT } from './config';
import { getAdminApi, loadSeedEnv, type CtApi } from './lib';

export interface VerifyDeps {
  api?: CtApi;
  source?: Record<string, string | undefined>;
  checks?: Check[];
  log?: Log;
}

export async function main(argv: string[], deps: VerifyDeps = {}): Promise<number> {
  const log = deps.log ?? consoleLog;
  parseArgs(argv);
  try {
    const { api, projectKey } = await getAdminApi({ mode: 'read', source: deps.source ?? loadSeedEnv(), api: deps.api });
    let failed = 0;
    for (const check of deps.checks ?? defaultChecks) {
      let result: { ok: boolean; detail?: string };
      try {
        result = await check.run(api, { projectKey });
      } catch (err) {
        result = { ok: false, detail: err instanceof Error ? err.message : String(err) };
      }
      if (!result.ok) failed += 1;
      log(`${result.ok ? 'PASS' : 'FAIL'}  ${check.name}${result.detail ? `  (${result.detail})` : ''}`);
    }
    log(failed === 0 ? 'All checks passed.' : `${failed} check(s) failed.`);
    return failed === 0 ? EXIT.OK : EXIT.FAILED;
  } catch (err) {
    return exitCodeForError(err, log);
  }
}

if (require.main === module) {
  main(process.argv.slice(2)).then((code) => process.exit(code));
}
