import 'server-only';
import { randomBytes } from 'node:crypto';
import type { Address, AddressDraft, BusinessUnit } from '@commercetools/platform-sdk';
import { ApiError } from '../errors';
import type { Site, SiteInput, SitesResult } from '../portal/types';
import { listThreads, OPEN_STATUSES } from './portal-quotes';
import { notFoundError } from './ownership';
import { can, forbidden, getAssociateContext, updateUnit } from './team-unit';

type Session = { customerId: string; businessUnitKey: string; locale?: string };

export const EDIT_SITES = 'UpdateBusinessUnitDetails';

export const toSite = (address: Address, defaultId: string | undefined): Site => ({
  key: address.key ?? address.id ?? '', name: address.company ?? '', contactName: address.additionalAddressInfo ?? '', phone: address.phone ?? '',
  streetName: address.streetName ?? '', city: address.city ?? '', postalCode: address.postalCode ?? '', country: address.country, isDefault: Boolean(defaultId) && address.id === defaultId,
});

const draftOf = (input: SiteInput, key?: string): AddressDraft => ({
  ...(key ? { key } : {}), company: input.name, streetName: input.streetName, city: input.city, postalCode: input.postalCode, country: input.country,
  ...(input.contactName ? { additionalAddressInfo: input.contactName } : {}), ...(input.phone ? { phone: input.phone } : {}),
});

const find = (unit: BusinessUnit, key: string): Address => {
  const address = unit.addresses.find((a) => a.key === key);
  if (!address) throw notFoundError();
  return address;
};

async function requireEditor(session: Session) {
  const ctx = await getAssociateContext(session);
  if (!can(ctx, EDIT_SITES)) throw forbidden();
  return ctx;
}

export async function listSites(session: Session): Promise<SitesResult> {
  const ctx = await getAssociateContext(session);
  const { unit } = ctx;
  return { sites: unit.addresses.map((a) => toSite(a, unit.defaultShippingAddressId)), canEdit: can(ctx, EDIT_SITES) };
}

export async function addSite(session: Session, input: SiteInput): Promise<SitesResult> {
  await requireEditor(session);
  const key = `${session.businessUnitKey}-site-${randomBytes(3).toString('hex')}`;
  await updateUnit(session.businessUnitKey, (unit) => [
    { action: 'addAddress', address: draftOf(input, key) },
    ...(unit.defaultShippingAddressId ? [] : [{ action: 'setDefaultShippingAddress' as const, addressKey: key }]),
  ]);
  return listSites(session);
}

export async function updateSite(session: Session, key: string, input: SiteInput): Promise<SitesResult> {
  await requireEditor(session);
  await updateUnit(session.businessUnitKey, (unit) => { find(unit, key); return [{ action: 'changeAddress', addressKey: key, address: draftOf(input, key) }]; });
  return listSites(session);
}

export async function setDefaultSite(session: Session, key: string): Promise<SitesResult> {
  await requireEditor(session);
  await updateUnit(session.businessUnitKey, (unit) => { find(unit, key); return [{ action: 'setDefaultShippingAddress', addressKey: key }]; });
  return listSites(session);
}

/** A site that an open quote request ships to is refused with a reason, as is the default site (choose another default first). */
export async function removeSite(session: Session, key: string): Promise<SitesResult> {
  await requireEditor(session);
  const threads = await listThreads(session);
  await updateUnit(session.businessUnitKey, (unit) => {
    const address = find(unit, key);
    if (unit.defaultShippingAddressId === address.id) throw new ApiError(409, 'This is your default site. Choose another default site before removing it.');
    if (threads.some((t) => OPEN_STATUSES.includes(t.status) && (t.siteKey === key || (!t.siteKey && t.site === address.company)))) throw new ApiError(409, 'This site is used by an open quote request, so it cannot be removed yet.');
    return [{ action: 'removeAddress', addressKey: key }];
  });
  return listSites(session);
}
