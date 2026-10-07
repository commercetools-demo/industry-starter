// npm run release:validate | preview | apply | cancel | rollback | history | verify  (workstream X, D-057, D-069)
// First argument after the command is the release key; the manifest is releases/<key>.release.json (or releases/examples/).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { consoleLog, exitCodeForError, parseArgs, type Log } from './cli';
import { EXIT } from './config';
import { getAdminApi, loadSeedEnv, type CtApi } from './lib';
import { applyRelease, cancelRelease, type ApplyDeps } from './release/apply';
import { buildCatalogIndex } from './release/catalogIndex';
import { defaultOperator, renderHistory } from './release/history';
import { ManifestError, isIsoUtc, parseReleaseManifest, sha256OfManifest } from './release/parse';
import { buildRollbackManifest } from './release/plan';
import { previewRelease, renderPreview } from './release/preview';
import { revalidateRelease } from './release/revalidate';
import { getRecord, listRecords } from './release/store';
import { EXIT_INCONSISTENT, type ReleaseManifest, type ReleaseSnapshot } from './release/types';
import { errorsOf, renderIssues, validateRelease } from './release/validate';

export { EXIT_INCONSISTENT };

export const COMMANDS = ['validate', 'preview', 'apply', 'cancel', 'rollback', 'history', 'verify'] as const;
export type Command = (typeof COMMANDS)[number];

const WRITE_COMMANDS: Command[] = ['apply', 'cancel'];
const VALUE_FLAGS = ['confirm-project', 'at', 'operator', 'fail-after', 'release-at', 'file', 'expedite'];

export interface ReleaseDeps {
  api?: CtApi;
  source?: Record<string, string | undefined>;
  log?: Log;
  now?: () => Date;
  readFile?: (file: string) => string | null;
  writeFile?: (file: string, text: string) => void;
  writeState?: ApplyDeps['writeState'];
  /** Directory of the manifests (tests point it elsewhere). */
  releasesDir?: string;
}

const defaultDir = path.resolve(__dirname, 'releases');

function positional(argv: string[]): string[] {
  return argv.filter((a, i) => !a.startsWith('--') && !(i > 0 && argv[i - 1].startsWith('--') && VALUE_FLAGS.includes(argv[i - 1].slice(2))));
}

function readText(file: string): string | null {
  return existsSync(file) ? readFileSync(file, 'utf8') : null;
}

function writeText(file: string, text: string): void {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, text);
}

function defaultWriteState(dir: string): NonNullable<ApplyDeps['writeState']> {
  return (key, snapshot) => writeText(path.join(dir, '.state', `${key}.before.json`), `${JSON.stringify(snapshot, null, 2)}\n`);
}

export function loadManifest(key: string, args: ReturnType<typeof parseArgs>, deps: ReleaseDeps): ReleaseManifest {
  const dir = deps.releasesDir ?? defaultDir;
  const read = deps.readFile ?? readText;
  const explicit = args.values.get('file');
  const candidates = explicit ? [path.resolve(explicit)] : [path.join(dir, `${key}.release.json`), path.join(dir, 'examples', `${key}.release.json`)];
  for (const file of candidates) {
    const text = read(file);
    if (text === null) continue;
    const manifest = parseReleaseManifest(text);
    const override = args.values.get('release-at');
    if (override) {
      if (!isIsoUtc(override)) throw new ManifestError([{ code: 'PARSE', key: 'release-at', message: '--release-at must be an ISO-8601 UTC instant ending in Z', severity: 'error' }]);
      return { ...manifest, releaseAt: override };
    }
    return manifest;
  }
  throw new ManifestError([{ code: 'PARSE', key, message: `no manifest file found (looked at ${candidates.join(', ')})`, severity: 'error' }]);
}

const isoSeconds = (date: Date): string => date.toISOString().replace(/\.\d{3}Z$/, 'Z');

export async function main(argv: string[], deps: ReleaseDeps = {}): Promise<number> {
  const log = deps.log ?? consoleLog;
  const clock = deps.now ?? (() => new Date());
  const args = parseArgs(argv, VALUE_FLAGS);
  const [command, key] = positional(argv);
  if (!command || !(COMMANDS as readonly string[]).includes(command)) {
    log(`Usage: release.ts <${COMMANDS.join('|')}> <release-key> [--confirm-project <key>] [--at <ISO>] [--ack] [--operator <name>] [--release-at <ISO>] [--file <path>]`);
    return EXIT.FAILED;
  }
  const cmd = command as Command;
  if (cmd !== 'history' && !key) {
    log(`release:${cmd} needs a release key as its first argument.`);
    return EXIT.FAILED;
  }
  const failAfterText = args.values.get('fail-after');
  if (failAfterText !== undefined && (!/^\d+$/.test(failAfterText) || Number(failAfterText) < 1 || !args.values.get('confirm-project'))) {
    log('--fail-after <n> needs a whole number of at least 1 and --confirm-project <key>.');
    return EXIT.FAILED;
  }

  try {
    const { api } = await getAdminApi({
      mode: WRITE_COMMANDS.includes(cmd) ? 'write' : 'read',
      confirmProject: args.values.get('confirm-project'),
      source: deps.source ?? loadSeedEnv(),
      api: deps.api,
    });
    const at = args.values.get('at');
    if (at !== undefined && !isIsoUtc(at)) {
      log('--at must be an ISO-8601 UTC instant ending in Z, e.g. 2026-11-15T09:00:00Z');
      return EXIT.FAILED;
    }

    if (cmd === 'history') {
      const records = await listRecords(api);
      for (const line of renderHistory(records, at ? new Date(at) : undefined)) log(line);
      return EXIT.OK;
    }

    const relDir = deps.releasesDir ?? defaultDir;
    const applyDeps: ApplyDeps = {
      api,
      log,
      operator: args.values.get('operator') || defaultOperator(),
      ack: args.flags.has('ack'),
      ...(failAfterText !== undefined ? { failAfter: Number(failAfterText) } : {}),
      now: clock,
      writeState: deps.writeState ?? defaultWriteState(relDir),
    };

    if (cmd === 'cancel') return (await cancelRelease(key, applyDeps)).exitCode;

    if (cmd === 'rollback') {
      const record = await getRecord(api, key);
      if (!record) {
        log(`No release record "${key}".`);
        return EXIT.PREFLIGHT;
      }
      if (record.status !== 'scheduled') {
        log(`Release ${key} is ${record.status}; only a scheduled release that took effect can be rolled back.`);
        return EXIT.PREFLIGHT;
      }
      const now = clock();
      if (Date.parse(record.releaseAt) > now.getTime()) {
        log(`Release ${key} has not taken effect yet (${record.releaseAt}); use: npm run release:cancel -- ${key}`);
        return EXIT.PREFLIGHT;
      }
      if (!record.manifest) {
        log(`The record of ${key} holds no manifest; it cannot be inverted automatically.`);
        return EXIT.PREFLIGHT;
      }
      const reason = args.values.get('expedite') || undefined;
      const releaseAt = at ?? isoSeconds(new Date(Math.ceil((now.getTime() + (reason ? 3 : 15) * 60 * 1000) / 1000) * 1000));
      const rollback = buildRollbackManifest(record.manifest, record.before as ReleaseSnapshot, { releaseAt, ...(reason ? { expediteReason: reason } : {}) });
      const file = path.join(relDir, `${rollback.key}.release.json`);
      (deps.writeFile ?? writeText)(file, `${JSON.stringify(rollback, null, 2)}\n`);
      log(`Rollback manifest written to ${file}`);
      log(JSON.stringify(rollback, null, 2));
      log(`Apply it like any release: npm run release:apply -- ${rollback.key} --confirm-project <project>${rollback.externalChecklist.length > 0 ? ' --ack' : ''}`);
      return EXIT.OK;
    }

    if (cmd === 'verify') {
      const result = await revalidateRelease(api, key, clock());
      if (result.effective) log(`Release ${key} already took effect; nothing dark is left to verify.`);
      for (const problem of result.problems) log(`PROBLEM ${problem}`);
      log(result.ok ? `Release ${key}: OK` : `Release ${key}: ${result.problems.length} problem(s)`);
      return result.ok ? EXIT.OK : EXIT.PREFLIGHT;
    }

    const manifest = loadManifest(key, args, deps);
    if (cmd === 'apply') return (await applyRelease(manifest, applyDeps)).exitCode;

    const index = await buildCatalogIndex(api);
    const issues = validateRelease(manifest, index, { now: clock() });
    if (cmd === 'validate') {
      for (const line of renderIssues(issues)) log(line);
      const errors = errorsOf(issues);
      log(errors.length === 0 ? `OK (${sha256OfManifest(manifest).slice(0, 12)})` : `${errors.length} validation error(s).`);
      return errors.length === 0 ? EXIT.OK : EXIT.PREFLIGHT;
    }
    // preview: informational, never writes
    for (const line of renderIssues(issues)) log(line);
    const preview = previewRelease(manifest, index, { ...(at ? { at: new Date(at) } : {}), now: clock() });
    for (const line of renderPreview(preview)) log(line);
    return EXIT.OK;
  } catch (err) {
    if (err instanceof ManifestError) {
      for (const issue of err.issues) log(`ERROR ${issue.code} ${issue.key}: ${issue.message}`);
      return EXIT.PREFLIGHT;
    }
    return exitCodeForError(err, log);
  }
}

if (require.main === module) {
  main(process.argv.slice(2)).then((code) => process.exit(code));
}
