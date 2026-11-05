# lib/agent: the shopping assistant core

A TypeScript port of Anthropic's commerce agent (`github.com/anthropics/commerce-agents`,
Apache-2.0) for workstream T. Read `plans/workstreams/T-shopping-assistant.md` and
`openspec/changes/add-shopping-assistant/` first.

```
common/    role-independent core   (from commerce-common/commerce_common/)
shopping/  the shopping role       (from shopping-agent/core/shopping_agent/)
runtime/   the turn loop           (from shopping-agent/runtime-messages-api/)
(no backend here) the backend is `lib/ct/assistant-backend.ts`, outside this directory: it is the only integration surface and it implements `shopping/backend.ts`
store/     session storage         (new code)
skills/    SKILL.md flows + generated module
```

Rules for this directory

- Module names follow upstream so a later upstream diff stays readable.
- Every ported file starts with exactly this header (a test enforces it):

  ```ts
  // Copyright 2026 Anthropic PBC
  // SPDX-License-Identifier: Apache-2.0
  // Adapted from <upstream path>; changes: <what differs>.
  ```

- Copy prompts, tool descriptions, gate messages and skill bodies verbatim.
- Nothing under this directory imports `@commercetools/*`, `lib/ct/*` or a client-only module.
- Nothing that renders into the tool list or the static system prompt may read the environment.
- Add each new vendored path to `storefront/NOTICE`.
