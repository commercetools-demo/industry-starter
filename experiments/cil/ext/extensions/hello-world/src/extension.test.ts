/**
 * A resolver is a plain function, so you test it by calling it directly — no gateway,
 * no network, no login. `pnpm test` runs this (Vitest) both here and, from the repo
 * root, across every extension. Copy this file alongside your own `extension.ts` and
 * assert what your resolvers/hooks/API-extension handlers return.
 *
 * The restricted runtime hands each resolver a context (`now()` + the project's
 * `config` map). Tests stand in a minimal fake for it — see `ctx` below.
 */

import { describe, expect, it } from "vitest";
import { resolvers } from "./extension.js";

// A minimal stand-in for the host-provided ExtensionContext. Pass a `config` to
// exercise merchant-supplied settings (e.g. `GREETING`).
const ctx = (config: Record<string, string> = {}) => ({ now: () => Date.now(), config });

describe("hello-world extension", () => {
  it("greets the world by default", () => {
    expect(resolvers.Query.hello({}, {}, ctx())).toBe(
      "Hello, world, from your integration-layer extension!",
    );
  });

  it("greets a named visitor", () => {
    expect(resolvers.Query.hello({}, { name: "Ada" }, ctx())).toBe(
      "Hello, Ada, from your integration-layer extension!",
    );
  });

  it("honours the GREETING config override set per project", () => {
    expect(resolvers.Query.hello({}, { name: "Ada" }, ctx({ GREETING: "Hi" }))).toBe(
      "Hi, Ada, from your integration-layer extension!",
    );
  });
});
