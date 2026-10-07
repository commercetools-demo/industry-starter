import type { AddressInput } from '@/lib/types';
import { ZIP_TABLE } from './zip-table';

export interface ResolveResult {
  status: 'resolved' | 'unresolved';
  unresolvedFields: Array<'city' | 'state' | 'postalCode'>;
  nearestMatch?: { city: string; state?: string; postalCode: string; country: 'US' | 'DE' };
}

export interface AddressResolver {
  resolve(a: AddressInput): Promise<ResolveResult>;
}

const norm = (value: string | undefined): string => (value ?? '').normalize('NFC').trim().toLowerCase();

/**
 * Deterministic fake (D-059): a postal code in the table must match its city (and state in the US); a code that is not in the table is
 * "resolved" (we cannot judge, so unknown is not wrong). Warning-only: the buyer can keep what they typed. Never throws.
 */
export const tableResolver: AddressResolver = {
  async resolve(a: AddressInput): Promise<ResolveResult> {
    try {
      const prefix = a.postalCode.trim().slice(0, 5);
      const row = ZIP_TABLE[a.country]?.[prefix];
      if (!row) return { status: 'resolved', unresolvedFields: [] };
      const unresolvedFields: ResolveResult['unresolvedFields'] = [];
      if (norm(a.city) !== norm(row.city)) unresolvedFields.push('city');
      if (a.country === 'US' && norm(a.state) !== norm(row.state)) unresolvedFields.push('state');
      if (unresolvedFields.length === 0) return { status: 'resolved', unresolvedFields: [] };
      return {
        status: 'unresolved',
        unresolvedFields,
        nearestMatch: { city: row.city, ...(row.state ? { state: row.state } : {}), postalCode: prefix, country: a.country },
      };
    } catch {
      console.warn('address resolver unavailable');
      return { status: 'resolved', unresolvedFields: [] };
    }
  },
};
