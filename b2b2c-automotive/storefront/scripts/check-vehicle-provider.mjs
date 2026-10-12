// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Production gate for the plate and VIN lookup. The mock provider is the only provider (owner answer Q-002), so a production build
// that shows the lookup tabs (VEHICLE_LOOKUP_ENABLED=true) must also say VEHICLE_MOCK_ACKNOWLEDGED=true: nobody sees fake lookups by accident.
import { pathToFileURL } from 'node:url';

const PROVIDERS = ['stub'];

/** `{ problems, notices }` for an environment. Development and test builds always pass (an unknown provider id still fails). */
export function checkVehicleProvider(env = process.env) {
  const problems = [];
  const notices = [];
  const provider = env.VEHICLE_PROVIDER?.trim() || 'stub';
  if (!PROVIDERS.includes(provider)) {
    problems.push(`VEHICLE_PROVIDER "${provider}" is unknown: only ${PROVIDERS.join(', ')} exists`);
    return { problems, notices };
  }
  if (env.NODE_ENV !== 'production') return { problems, notices };
  const lookupOn = env.VEHICLE_LOOKUP_ENABLED?.trim().toLowerCase() === 'true';
  if (!lookupOn) return { problems, notices };
  if (provider === 'stub') {
    if (env.VEHICLE_MOCK_ACKNOWLEDGED?.trim().toLowerCase() === 'true') {
      notices.push('vehicle lookup: the plate and VIN tabs are ON in a production build with the MOCK provider (VEHICLE_MOCK_ACKNOWLEDGED=true); results are labelled "Demo lookup".');
    } else {
      problems.push(
        'VEHICLE_LOOKUP_ENABLED=true with VEHICLE_PROVIDER=stub in a production build shows fake plate and VIN results: set VEHICLE_LOOKUP_ENABLED=false, or acknowledge the demo with VEHICLE_MOCK_ACKNOWLEDGED=true',
      );
    }
  }
  return { problems, notices };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { problems, notices } = checkVehicleProvider();
  for (const n of notices) console.log(n);
  if (problems.length) {
    console.error(problems.join('\n'));
    process.exit(1);
  }
  console.log('vehicle-provider: OK');
}
