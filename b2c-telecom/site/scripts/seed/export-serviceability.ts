// npm run seed:export-serviceability: writes the built-in copy of the serviceability table that K reads when the storefront
// API client cannot read Custom Objects (scope view_key_value_documents). Run after editing data/serviceability.ts.
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { SERVICEABILITY_ROWS, rowValue } from './data/serviceability';

export const SERVICEABILITY_JSON = path.join(__dirname, '..', '..', 'lib', 'offers', 'serviceability-table.json');

/** Postal code -> value, exactly what the Custom Objects hold. */
export function exportServiceability(): Record<string, ReturnType<typeof rowValue>> {
  return Object.fromEntries(SERVICEABILITY_ROWS.map((row) => [row.postalCode, rowValue(row)]));
}

if (require.main === module) {
  writeFileSync(SERVICEABILITY_JSON, `${JSON.stringify(exportServiceability(), null, 2)}\n`);
  console.log(`Wrote ${SERVICEABILITY_JSON}`);
}
