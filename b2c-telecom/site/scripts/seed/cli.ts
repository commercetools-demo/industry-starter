// Tiny shared helpers for the seed commands: argument parsing and the process entry wrapper.
import { EXIT, TargetError } from './config';
import { CtHttpError } from './lib';

export interface Args {
  flags: Set<string>;
  values: Map<string, string>;
}

/** `--flag` or `--name value`. Names listed in `valueFlags` take the next argument. */
export function parseArgs(argv: string[], valueFlags: string[] = []): Args {
  const flags = new Set<string>();
  const values = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const name = arg.slice(2);
    if (valueFlags.includes(name)) {
      const value = argv[i + 1];
      if (value !== undefined && !value.startsWith('--')) {
        values.set(name, value);
        i += 1;
      } else values.set(name, '');
    } else flags.add(name);
  }
  return { flags, values };
}

export type Log = (line: string) => void;

export const consoleLog: Log = (line) => console.log(line);

/** Maps thrown errors to an exit code and a message that never contains credentials. */
export function exitCodeForError(err: unknown, log: Log): number {
  if (err instanceof TargetError) {
    log(err.message);
    return EXIT.TARGET_REFUSED;
  }
  if (err instanceof CtHttpError) {
    log(`commercetools error ${err.statusCode}${err.code ? ` ${err.code}` : ''}: ${err.message}`);
    return EXIT.FAILED;
  }
  log(err instanceof Error ? err.message : String(err));
  return EXIT.FAILED;
}
