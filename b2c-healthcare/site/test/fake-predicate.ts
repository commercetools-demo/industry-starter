/**
 * A small evaluator for the commercetools query predicates the unit tests need (never the network). Supported terms, joined
 * by ` and `: `f="x"`, `f=true`, `f=3`, `f!="x"`, `f<"x"` (and `>`, `<=`, `>=`, compared as strings or numbers), `f in ("a", "b")`,
 * `f is defined`, and nesting `f(<predicate>)` (an array field matches when any element does). An unsupported term evaluates to
 * `onUnknown` (default false).
 */
type Rec = Record<string, unknown>;

/** Splits on ` and ` outside parentheses and quotes. */
function splitTop(expr: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let inQuote = false;
  let start = 0;
  for (let i = 0; i < expr.length; i += 1) {
    const ch = expr[i];
    if (ch === '"') inQuote = !inQuote;
    else if (!inQuote && ch === '(') depth += 1;
    else if (!inQuote && ch === ')') depth -= 1;
    else if (!inQuote && depth === 0 && expr.startsWith(' and ', i)) {
      parts.push(expr.slice(start, i));
      start = i + 5;
      i += 4;
    }
  }
  parts.push(expr.slice(start));
  return parts.map((p) => p.trim()).filter(Boolean);
}

const cmp = (have: unknown, op: string, want: string | number | boolean): boolean => {
  if (have === undefined || have === null) return false;
  const a = typeof want === 'string' ? String(have) : typeof want === 'number' ? Number(have) : have;
  switch (op) {
    case '=': return a === want || String(have) === String(want);
    case '!=': return String(have) !== String(want);
    case '<': return (a as string | number) < want;
    case '>': return (a as string | number) > want;
    case '<=': return (a as string | number) <= want;
    case '>=': return (a as string | number) >= want;
    default: return false;
  }
};

function term(obj: unknown, t: string, onUnknown: boolean): boolean {
  const o = (obj ?? {}) as Rec;
  let m = /^(\w+)\s+is\s+defined$/.exec(t);
  if (m) return o[m[1]] !== undefined && o[m[1]] !== null;
  m = /^(\w+)\s+in\s+\((.*)\)$/.exec(t);
  if (m) return [...m[2].matchAll(/"([^"]*)"/g)].some((v) => v[1] === String(o[m![1]]));
  m = /^(\w+)\s*(!=|<=|>=|=|<|>)\s*(?:"([^"]*)"|(true|false|-?\d+))$/.exec(t);
  if (m) {
    const want: string | number | boolean = m[3] !== undefined ? m[3] : m[4] === 'true' ? true : m[4] === 'false' ? false : Number(m[4]);
    return cmp(o[m[1]], m[2], want);
  }
  m = /^(\w+)\((.*)\)$/.exec(t);
  if (m) {
    const inner = o[m[1]];
    if (Array.isArray(inner)) return inner.some((x) => evalPredicate(x, m![2], onUnknown));
    if (inner === undefined || inner === null) return false;
    return evalPredicate(inner, m[2], onUnknown);
  }
  return onUnknown;
}

export function evalPredicate(obj: unknown, expr: string | undefined, onUnknown = false): boolean {
  if (!expr) return true;
  return splitTop(expr).every((t) => term(obj, t, onUnknown));
}
