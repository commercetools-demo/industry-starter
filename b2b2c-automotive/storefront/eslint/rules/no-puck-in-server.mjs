// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// createContext footgun: Puck packages call createContext at import time, which breaks in Server Components.
// Value imports from @commercetools-demo/puck-* are only allowed in files that start with 'use client'; `import type` is fine.
const PUCK = /^@commercetools-demo\/puck-/;

const rule = {
  meta: {
    type: 'problem',
    schema: [],
    messages: {
      puck: "Value import from '{{source}}' in a Server Component. Move it into a 'use client' file; only `import type` is allowed here.",
    },
  },
  create(context) {
    let isClient = false;
    return {
      Program(node) {
        isClient = node.body.some((n) => n.type === 'ExpressionStatement' && n.directive === 'use client');
      },
      ImportDeclaration(node) {
        if (isClient || !PUCK.test(String(node.source.value))) return;
        if (node.importKind === 'type') return;
        if (node.specifiers.length > 0 && node.specifiers.every((s) => s.importKind === 'type')) return;
        context.report({ node, messageId: 'puck', data: { source: node.source.value } });
      },
    };
  },
};

export default rule;
