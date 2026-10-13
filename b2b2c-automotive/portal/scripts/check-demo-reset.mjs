// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// On-screen password reset of the portal (R-08, owner answer Q-X05, workstream X). With `DEMO_ONSCREEN_RESET=on` anyone who knows an email address
// can reset that account's password. A production build with it on therefore also needs `DEMO_RESET_ACKNOWLEDGED=true` (the owner's
// acknowledgement) and then prints a notice. Same rule as storefront/scripts/check-demo-reset.mjs (the storefront flag value is `true`).
import { pathToFileURL } from 'node:url';
import { isRelease } from './release-env.mjs';

const isProduction = (env) => env.NODE_ENV === 'production' || isRelease(env);

export function checkDemoReset(env = process.env) {
  const result = { problems: [], notices: [] };
  if (env.DEMO_ONSCREEN_RESET !== 'on' || !isProduction(env)) return result;
  if (env.DEMO_RESET_ACKNOWLEDGED !== 'true') {
    result.problems.push('DEMO_ONSCREEN_RESET=on in a production build lets anyone who knows an email address reset that password: set DEMO_RESET_ACKNOWLEDGED=true to accept this for a demo, or unset DEMO_ONSCREEN_RESET');
  } else {
    result.notices.push('NOTICE: the on-screen password reset is on in a production build (DEMO_RESET_ACKNOWLEDGED=true). It is for demos only: anyone who knows an email address can reset that password.');
  }
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { problems, notices } = checkDemoReset();
  for (const notice of notices) console.log(notice);
  if (problems.length) {
    console.error(problems.join('\n'));
    process.exit(1);
  }
  console.log('demo-reset: OK');
}
