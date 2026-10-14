/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// Value imports from @commercetools-demo/puck-* are only allowed in files that start with a 'use client' directive:
// the packages call createContext at module load, which does not exist in React Server Components.
const PUCK = /^@commercetools-demo\/puck-/;

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: 'problem',
    schema: [],
    messages: {
      puckInServer:
        "Value import from '{{source}}' in a Server Component. Put it behind a 'use client' file (createContext is not available in RSC), or use 'import type'.",
    },
  },
  create(context) {
    let isClient = false;
    return {
      Program(node) {
        isClient = node.body.some((s) => s.type === 'ExpressionStatement' && s.directive === 'use client');
      },
      ImportDeclaration(node) {
        if (isClient || !PUCK.test(String(node.source.value))) return;
        if (node.importKind === 'type') return;
        if (node.specifiers.length > 0 && node.specifiers.every((s) => s.type === 'ImportSpecifier' && s.importKind === 'type')) return;
        context.report({ node, messageId: 'puckInServer', data: { source: String(node.source.value) } });
      },
    };
  },
};

export default rule;
