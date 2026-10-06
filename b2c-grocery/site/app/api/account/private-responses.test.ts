// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });

const routes = walk(__dirname).filter((f) => /route\.ts$/.test(f));

describe('Shared cache: every /api/account/* route answers through privateJson()', () => {
  it('finds the account routes', () => {
    expect(routes.length).toBeGreaterThanOrEqual(3);
  });

  it.each(routes.map((r) => [path.relative(__dirname, r), r]))('%s: no bare NextResponse.json / Response.json, uses privateJson and the session', (_name, file) => {
    const source = readFileSync(file, 'utf8');
    expect(source).not.toMatch(/NextResponse\.json|Response\.json|new Response\(|new NextResponse\(/);
    // `wishlist-api` helpers wrap privateJson and the session lookup (customerIdOf) for the wishlist routes.
    expect(source).toMatch(/privateJson|wishlistJson|wishlistError/);
    // The (protected) layout guards pages only: the route must check the session itself.
    expect(source).toMatch(/getSession\(\)|customerIdOf\(/);
    expect(source).toMatch(/unauthenticated\(\)|401/);
  });
});
