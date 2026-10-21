import type { AddressInput } from '@/lib/types';

export type VerifyResult =
  | { ok: true }
  /** The service could not confirm the address: `unresolved` names the fields, `suggestion` is its best guess. */
  | { ok: false; unresolved: string[]; suggestion?: AddressInput };

/** Port for an address validation service (Q-L-05: none is chosen; an adapter plugs in here). */
export interface AddressVerifier {
  verify(address: AddressInput): Promise<VerifyResult>;
}

/** The default: format checks (`validateAddress`) are all there is, so everything is accepted. */
export const noopVerifier: AddressVerifier = { verify: async () => ({ ok: true }) };

let active: AddressVerifier = noopVerifier;

export const getAddressVerifier = (): AddressVerifier => active;
/** For tests and for wiring a real service. */
export const setAddressVerifier = (verifier: AddressVerifier): void => {
  active = verifier;
};
