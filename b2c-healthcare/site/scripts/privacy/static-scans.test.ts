import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { CUSTOM_TYPES } from '../seed/data/types';
import { LIST_LINE_TYPE } from '../seed/data/recurrence';

/**
 * Static scans (workstream X-05, spec health-data-minimization): the rules of D-025 enforced as tests over the whole code base.
 *  (a) no commerce custom-field type has a field named like a clinical value;
 *  (b) no logging call receives a health-like key, property or variable (AST scan of lib/, app/api and the other server code);
 *  (c) no route definition or URL builder carries a health-like query parameter.
 */
const site = path.resolve(__dirname, '../..');

/** Field names that would hold clinical content. */
export const HEALTH_FIELD = /sig|diagnosis|condition|result|reason/i;
/** Names that must not reach a log line or a URL: clinical content, prescription and booking detail, contact data. */
export const HEALTH_NAME = /^(sig|diagnos\w*|conditions?|results?|reason|labs?|labValues?|labResults?|labName|rx|rxNumber|rxLine\w*|medications?|medicationName\w*|booking|bookings|bookingRef\w*|symptoms?|allerg\w*|dose|email|phone)$/i;

const SKIP_DIRS = new Set(['node_modules', '.next', 'docs', 'test']);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) {
      if (!SKIP_DIRS.has(name)) walk(full, out);
    } else if (/\.(ts|tsx)$/.test(name) && !/\.(test|spec)\.(ts|tsx)$/.test(name) && !name.endsWith('.d.ts')) {
      out.push(full);
    }
  }
  return out;
}

const rel = (f: string) => path.relative(site, f);
const parse = (file: string) => ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
const visit = (node: ts.Node, fn: (n: ts.Node) => void) => {
  fn(node);
  ts.forEachChild(node, (c) => visit(c, fn));
};
const line = (sf: ts.SourceFile, n: ts.Node) => sf.getLineAndCharacterOfPosition(n.getStart()).line + 1;

// ------------------------------------------------------------------ (a) custom-field types

describe('static scan (a): custom-field types', () => {
  it('Order carries a reference not a condition: no custom type of an order, cart, line item, payment or customer has a field named like sig, diagnosis, condition, result or reason', () => {
    const types = [...CUSTOM_TYPES, LIST_LINE_TYPE];
    const bad = types.flatMap((t) => (t.fieldDefinitions as { name: string }[]).filter((f) => HEALTH_FIELD.test(f.name)).map((f) => `${t.key}.${f.name}`));
    expect(bad).toEqual([]);
    expect(types.some((t) => (t.resourceTypeIds as string[]).includes('order'))).toBe(true);
    expect(types.some((t) => (t.resourceTypeIds as string[]).includes('line-item'))).toBe(true);
  });

  it('Order carries a reference not a condition: custom fields written by the code carry no health-like name either', () => {
    const offenders: string[] = [];
    for (const file of walk(path.join(site, 'lib'))) {
      const sf = parse(file);
      visit(sf, (n) => {
        // { action: 'setCustomField' | 'setLineItemCustomField' | ..., name: '<field>' }
        if (!ts.isObjectLiteralExpression(n)) return;
        const props = n.properties.filter(ts.isPropertyAssignment);
        const action = props.find((p) => p.name.getText() === 'action' && ts.isStringLiteralLike(p.initializer) && /CustomField$/.test(p.initializer.text));
        const name = props.find((p) => p.name.getText() === 'name' && ts.isStringLiteralLike(p.initializer));
        if (action && name && HEALTH_FIELD.test((name.initializer as ts.StringLiteral).text)) offenders.push(`${rel(file)}:${line(sf, n)}`);
      });
    }
    expect(offenders).toEqual([]);
  });

  it('the scan itself catches a bad type (sanity)', () => {
    expect(HEALTH_FIELD.test('diagnosisNote')).toBe(true);
    expect(HEALTH_FIELD.test('reasonForVisit')).toBe(true);
    expect(HEALTH_FIELD.test('rxLineRef')).toBe(false);
    expect(HEALTH_FIELD.test('dispensedQty')).toBe(false);
  });
});

// ------------------------------------------------------------------ (b) logging calls

const LOG_OBJECTS = new Set(['console', 'log', 'logger']);
const LOG_METHODS = new Set(['log', 'error', 'warn', 'info', 'debug', 'trace']);

/** Offending names inside the arguments of one logging call. */
export function healthNamesIn(args: readonly ts.Node[]): string[] {
  const found: string[] = [];
  for (const arg of args) {
    visit(arg, (n) => {
      if ((ts.isPropertyAssignment(n) || ts.isShorthandPropertyAssignment(n)) && HEALTH_NAME.test(n.name.getText().replace(/^['"]|['"]$/g, ''))) found.push(n.name.getText());
      else if (ts.isPropertyAccessExpression(n) && HEALTH_NAME.test(n.name.text)) found.push(n.name.text);
      else if (ts.isIdentifier(n) && !(ts.isPropertyAccessExpression(n.parent) && n.parent.name === n) && !(ts.isPropertyAssignment(n.parent) && n.parent.name === n) && !(ts.isShorthandPropertyAssignment(n.parent) && n.parent.name === n) && HEALTH_NAME.test(n.text)) found.push(n.text);
    });
  }
  return found;
}

export function loggingViolations(file: string): string[] {
  const sf = parse(file);
  const out: string[] = [];
  visit(sf, (n) => {
    if (!ts.isCallExpression(n) || !ts.isPropertyAccessExpression(n.expression)) return;
    const callee = n.expression;
    if (!ts.isIdentifier(callee.expression) || !LOG_OBJECTS.has(callee.expression.text) || !LOG_METHODS.has(callee.name.text)) return;
    const names = healthNamesIn(n.arguments);
    if (names.length > 0) out.push(`${rel(file)}:${line(sf, n)} ${callee.expression.text}.${callee.name.text}(... ${[...new Set(names)].join(', ')})`);
  });
  return out;
}

describe('static scan (b): logging calls', () => {
  const roots = ['lib', 'app', 'components', 'hooks', 'context', 'netlify', 'scripts/privacy'].map((d) => path.join(site, d));

  it('Commerce data alone does not re identify: no console.* or logger call receives a sig, diagnosis, condition, result, reason, lab, RX, medication, booking, email or phone name (AST scan of lib/, app/, components/, hooks/, context/, netlify/)', () => {
    const files = roots.flatMap((r) => walk(r));
    expect(files.length).toBeGreaterThan(100);
    expect(files.flatMap(loggingViolations)).toEqual([]);
  });

  it('the scan sees app/api route handlers and lib/ct modules', () => {
    const files = roots.flatMap((r) => walk(r)).map(rel);
    expect(files.some((f) => f.startsWith('app/api/'))).toBe(true);
    expect(files.some((f) => f.startsWith('lib/ct/'))).toBe(true);
    const calls = roots.flatMap((r) => walk(r)).reduce((n, f) => n + (readFileSync(f, 'utf8').match(/\b(console|log|logger)\.(log|error|warn|info|debug)\(/g) ?? []).length, 0);
    expect(calls).toBeGreaterThan(15); // the scan is not vacuous
  });

  it('the scan catches a violating call (sanity)', () => {
    const sf = ts.createSourceFile('x.ts', 'log.error("x", { reason: booking.reason }); console.warn(rxNumber); log.info("fine", { status: 200 });', ts.ScriptTarget.Latest, true);
    const hits: string[] = [];
    visit(sf, (n) => {
      if (ts.isCallExpression(n)) hits.push(...healthNamesIn(n.arguments));
    });
    expect(hits).toEqual(['reason', 'reason', 'booking', 'rxNumber']);
  });
});

// ------------------------------------------------------------------ (c) query parameters

const QUERY_PARAM = /[?&]([A-Za-z_][\w-]*)=/g;

export function queryParamViolations(file: string): string[] {
  const sf = parse(file);
  const out: string[] = [];
  const check = (name: string, n: ts.Node) => {
    if (HEALTH_NAME.test(name)) out.push(`${rel(file)}:${line(sf, n)} ?${name}=`);
  };
  visit(sf, (n) => {
    // URL builders: '/api/x?name=...' in string or template text
    if (ts.isStringLiteralLike(n) || ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n)) {
      for (const m of n.text.matchAll(QUERY_PARAM)) check(m[1], n);
    }
    // readers: searchParams.get('name') / .has('name') / .getAll('name')
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && ['get', 'getAll', 'has'].includes(n.expression.name.text) && /searchParams|params|query/i.test(n.expression.expression.getText())) {
      const first = n.arguments[0];
      if (first && ts.isStringLiteralLike(first)) check(first.text, n);
    }
    // writers: params.set('name', ...) / append
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && ['set', 'append'].includes(n.expression.name.text) && /searchParams|params|query/i.test(n.expression.expression.getText())) {
      const first = n.arguments[0];
      if (first && ts.isStringLiteralLike(first)) check(first.text, n);
    }
    // Next pages: `searchParams: Promise<{ name?: string }>` member names
    if (ts.isPropertySignature(n) && n.name.getText() === 'searchParams' && n.type) {
      visit(n.type, (m) => {
        if (ts.isPropertySignature(m)) check(m.name.getText().replace(/^['"]|['"]$/g, ''), m);
      });
    }
    // Next pages: `const query = await searchParams` then query.name / query['name'] (or a destructuring of it)
    if (ts.isVariableDeclaration(n) && n.initializer && /\bsearchParams\b/.test(n.initializer.getText())) {
      if (ts.isObjectBindingPattern(n.name)) for (const el of n.name.elements) check((el.propertyName ?? el.name).getText(), el);
      else if (ts.isIdentifier(n.name)) {
        const holder = n.name.text;
        visit(n.getSourceFile(), (m) => {
          if (ts.isPropertyAccessExpression(m) && ts.isIdentifier(m.expression) && m.expression.text === holder) check(m.name.text, m);
          if (ts.isElementAccessExpression(m) && ts.isIdentifier(m.expression) && m.expression.text === holder && ts.isStringLiteralLike(m.argumentExpression)) check(m.argumentExpression.text, m);
        });
      }
    }
    // route definitions with `query: { name: ... }` (Link/router objects)
    if (ts.isPropertyAssignment(n) && n.name.getText() === 'query' && ts.isObjectLiteralExpression(n.initializer)) {
      for (const p of n.initializer.properties) if (p.name) check(p.name.getText().replace(/^['"]|['"]$/g, ''), p);
    }
  });
  return out;
}

describe('static scan (c): query parameters', () => {
  const roots = ['lib', 'app', 'components', 'hooks', 'context', 'proxy.ts'].map((d) => path.join(site, d));
  const files = () => roots.flatMap((r) => (r.endsWith('.ts') ? [r] : walk(r)));

  it('Commerce data alone does not re identify: no route definition, URL builder or search-param reader uses a health-like query parameter', () => {
    expect(files().length).toBeGreaterThan(100);
    expect(files().flatMap(queryParamViolations)).toEqual([]);
  });

  it('the scan reads page search params (journal ?category, policies ?version) and would flag a health-like one (sanity)', () => {
    expect(queryParamViolations(path.join(site, 'app/[locale]/journal/page.tsx'))).toEqual([]);
    const sf = ts.createSourceFile('p.tsx', 'type P = { searchParams: Promise<{ reason?: string }> }; async function f({ searchParams }: P) { const q = await searchParams; return q.diagnosis; }', ts.ScriptTarget.Latest, true);
    const hits: string[] = [];
    visit(sf, (n) => {
      if (ts.isPropertySignature(n) && n.name.getText() === 'searchParams' && n.type) visit(n.type, (m) => { if (ts.isPropertySignature(m) && HEALTH_NAME.test(m.name.getText())) hits.push(m.name.getText()); });
    });
    expect(hits).toEqual(['reason']);
  });

  it('the scan sees the URL builders in lib/api-paths.ts', () => {
    const sf = parse(path.join(site, 'lib/api-paths.ts'));
    let seen = 0;
    visit(sf, (n) => {
      if (ts.isStringLiteralLike(n) || ts.isTemplateHead(n)) seen += [...n.text.matchAll(QUERY_PARAM)].length;
    });
    expect(seen).toBeGreaterThan(0);
  });
});
