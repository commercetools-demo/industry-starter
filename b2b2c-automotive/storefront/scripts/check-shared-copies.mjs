// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// The repo has no workspace, so a contract both apps use lives twice. This gate compares each storefront copy with the portal's byte for
// byte (workstream V-10). The portal is read only. Without a `../portal` directory (the storefront checked on its own) the compare is skipped.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** Files that must be identical in both apps, relative to the app root. */
export const SHARED_COPIES = ['lib/contracts/return-item.ts', 'lib/security/origin.ts', 'lib/security/audit-log.ts', 'lib/security/headers.ts', 'lib/security/api-gate.ts'];

const here = path.dirname(fileURLToPath(import.meta.url));

/** `{ problems, notices }` for a storefront root and the portal root. */
export function checkSharedCopies(storefrontRoot = path.resolve(here, '..'), portalRoot = path.resolve(storefrontRoot, '..', 'portal'), files = SHARED_COPIES) {
  const problems = [];
  const notices = [];
  if (!existsSync(portalRoot)) {
    notices.push('shared-copies: ../portal not found, skipped');
    return { problems, notices };
  }
  for (const file of files) {
    const mine = path.join(storefrontRoot, file);
    const theirs = path.join(portalRoot, file);
    if (!existsSync(mine)) problems.push(`${file}: missing in the storefront (copy it from portal/${file})`);
    else if (!existsSync(theirs)) problems.push(`${file}: missing in the portal`);
    else if (!readFileSync(mine).equals(readFileSync(theirs))) problems.push(`${file}: the storefront copy differs from portal/${file}; copy the portal file over it`);
  }
  return { problems, notices };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { problems, notices } = checkSharedCopies();
  for (const n of notices) console.log(n);
  if (problems.length) {
    console.error(problems.join('\n'));
    process.exit(1);
  }
  console.log('shared-copies: OK');
}
