// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// BFF boundary: a 'use client' file must not import server-only code.
import path from 'node:path';

const rule = {
  meta: {
    type: 'problem',
    schema: [],
    messages: {
      serverInClient:
        "BFF boundary: a 'use client' file must not import '{{source}}'. Call a Route Handler through an SWR hook and take types from lib/types.ts.",
    },
  },
  create(context) {
    const filename = context.filename ?? context.getFilename();
    const libCt = `${path.sep}lib${path.sep}ct`;

    function isServerOnly(source) {
      if (source.startsWith('@commercetools/')) return true;
      if (source === 'server-only') return true;
      if (source === '@/lib/ct' || source.startsWith('@/lib/ct/')) return true;
      if (source === '@/lib/session' || source.startsWith('@/lib/session/')) return true;
      if (source.startsWith('.')) {
        const resolved = path.resolve(path.dirname(filename), source);
        return resolved.includes(`${libCt}${path.sep}`) || resolved.endsWith(libCt);
      }
      return false;
    }

    return {
      Program(program) {
        const first = program.body[0];
        const isClient = first && first.type === 'ExpressionStatement' && first.directive === 'use client';
        if (!isClient) return;
        for (const node of program.body) {
          if (node.type !== 'ImportDeclaration') continue;
          // import type from lib/ct is also an error: types live in lib/types.ts.
          if (isServerOnly(node.source.value)) {
            context.report({ node, messageId: 'serverInClient', data: { source: node.source.value } });
          }
        }
      },
    };
  },
};

export default rule;
