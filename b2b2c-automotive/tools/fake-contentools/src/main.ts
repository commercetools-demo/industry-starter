// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { createFakeContentools } from './server.ts';
import { defaultOptionsFromEnv } from './state.ts';

const options = defaultOptionsFromEnv();
const fake = createFakeContentools(options);
await fake.listen();

const mode = options.stubMode ? 'record-only stub' : 'fake service';
console.log(`fake-contentools (${mode}) listening on ${fake.url}`);
console.log(`  request log:  GET ${fake.url}/__admin/requests   (also GET/DELETE /__log)`);
console.log(`  failure mode: ${options.fail.mode}  (POST ${fake.url}/__admin/fail)`);
console.log(`  jwt mode:     ${options.jwtMode}   projects: ${options.projectKeys === '*' ? 'any' : options.projectKeys.join(',')}`);

const stop = (): void => {
  void fake.close().then(() => process.exit(0));
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
