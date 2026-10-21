import 'server-only';
import { domainError } from '@/lib/api-domain';
import { validateAddress } from '@/lib/account/address-validate';
import { getAddressVerifier } from '@/lib/account/address-verifier';
import type { AddressInput } from '@/lib/types';

export interface AddressRequest { address: AddressInput; makeDefault: boolean }

/**
 * `{ address, makeDefault?, confirmed? }` to a checked request, or the Response to return:
 *  - 422 validation_failed with `fields` (format checks);
 *  - 409 address_needs_confirmation with `unresolved` and `suggestion` when the verifier cannot confirm the address.
 *    Nothing is written; the shopper decides and may resend with `confirmed: true` (Keep what I typed).
 */
export async function readAddressRequest(raw: unknown): Promise<AddressRequest | Response> {
  const body = (raw ?? {}) as { address?: unknown; makeDefault?: unknown; confirmed?: unknown };
  const checked = validateAddress(body.address);
  if (!checked.ok) {
    return Response.json(
      { error: { code: 'validation_failed', message: 'Some of the information is not valid', fields: checked.fields } },
      { status: 422 },
    );
  }
  if (body.confirmed !== true) {
    const verdict = await getAddressVerifier().verify(checked.address);
    if (!verdict.ok) {
      return domainError('address_needs_confirmation', 409, {
        unresolved: verdict.unresolved,
        ...(verdict.suggestion ? { suggestion: verdict.suggestion } : {}),
      });
    }
  }
  return { address: checked.address, makeDefault: body.makeDefault === true };
}
