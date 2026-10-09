import 'server-only';
import { randomInt } from 'node:crypto';
import type { Associate, BusinessUnit } from '@commercetools/platform-sdk';
import { ApiError } from '../errors';
import type { InviteResult, TeamInput, TeamMember, TeamResult, TeamRoleKey } from '../portal/types';
import { apiRoot, provisioningRoot } from './client';
import { ADMIN_ROLE_KEY } from './business-units';
import { notFoundError } from './ownership';
import { can, forbidden, getAssociateContext, updateUnit } from './team-unit';

type Session = { customerId: string; businessUnitKey: string };

export const EDIT_TEAM = 'UpdateAssociates';

const SAME_ADMIN = () => new ApiError(409, 'A company needs at least one administrator. Make someone else an administrator first.');

export const toMember = (associate: Associate, you: string): TeamMember => {
  const customer = associate.customer.obj;
  const name = [customer?.firstName, customer?.lastName].filter(Boolean).join(' ');
  return { customerId: associate.customer.id, name: name || customer?.email || '', email: customer?.email ?? '', roleKeys: associate.associateRoleAssignments.map((r) => r.associateRole.key), isYou: associate.customer.id === you };
};

export async function listTeam(session: Session): Promise<TeamResult> {
  const ctx = await getAssociateContext(session);
  return { members: ctx.unit.associates.map((a) => toMember(a, session.customerId)), canEdit: can(ctx, EDIT_TEAM) };
}

const admins = (unit: BusinessUnit) => unit.associates.filter((a) => a.associateRoleAssignments.some((r) => r.associateRole.key === ADMIN_ROLE_KEY));
const isAdmin = (associate: Associate) => associate.associateRoleAssignments.some((r) => r.associateRole.key === ADMIN_ROLE_KEY);

async function requireEditor(session: Session) {
  const ctx = await getAssociateContext(session);
  if (!can(ctx, EDIT_TEAM)) throw forbidden();
  return ctx;
}

const ALPHABET = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
/** 15 random characters in three dash-separated groups, without look-alike characters. Shown once to the administrator. */
export function generateTemporaryPassword(): string {
  const group = () => Array.from({ length: 5 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
  return `${group()}-${group()}-${group()}`;
}

const isDuplicate = (error: unknown): boolean => Boolean((error as { body?: { errors?: Array<{ code?: string }> } }).body?.errors?.some((e) => e.code === 'DuplicateField'));

/**
 * No email is sent (Q-003, Q-022): the colleague's customer is created here with a random one-time password that the caller shows once,
 * flagged `mustChangePassword` so the first sign-in is forced to a screen that sets their own. The association with the company is made with
 * the provisioning client; if that fails the customer is deleted again so no half-created account remains.
 */
export async function inviteColleague(session: Session, input: TeamInput): Promise<InviteResult> {
  await requireEditor(session);
  const temporaryPassword = generateTemporaryPassword();
  let customer;
  try {
    customer = (await apiRoot.customers().post({
      body: {
        email: input.email, password: temporaryPassword, firstName: input.firstName, lastName: input.lastName, isEmailVerified: true,
        custom: { type: { typeId: 'type', key: 'mpw-customer' }, fields: { mustChangePassword: true } },
      },
    }).execute()).body.customer;
  } catch (error) {
    if (isDuplicate(error)) throw new ApiError(409, 'That email address already has an account.');
    throw error;
  }
  try {
    const unit = await updateUnit(session.businessUnitKey, () => [{
      action: 'addAssociate',
      associate: { customer: { typeId: 'customer', id: customer.id }, associateRoleAssignments: [{ associateRole: { typeId: 'associate-role', key: input.roleKey } }] },
    }], provisioningRoot);
    const added = unit.associates.find((a) => a.customer.id === customer.id);
    return {
      temporaryPassword,
      member: { customerId: customer.id, name: `${input.firstName} ${input.lastName}`, email: input.email, roleKeys: added ? added.associateRoleAssignments.map((r) => r.associateRole.key) : [input.roleKey], isYou: false },
    };
  } catch (error) {
    try {
      await apiRoot.customers().withId({ ID: customer.id }).delete({ queryArgs: { version: customer.version } }).execute();
    } catch {
      console.error('colleague compensation failed');
    }
    throw error;
  }
}

/** Last administrator: the only holder of mpw-admin cannot be demoted, not even by themselves. */
export async function changeRole(session: Session, customerId: string, roleKey: TeamRoleKey): Promise<TeamResult> {
  await requireEditor(session);
  await updateUnit(session.businessUnitKey, (unit) => {
    const target = unit.associates.find((a) => a.customer.id === customerId);
    if (!target) throw notFoundError();
    if (target.associateRoleAssignments.length === 1 && target.associateRoleAssignments[0].associateRole.key === roleKey) return [];
    if (isAdmin(target) && roleKey !== ADMIN_ROLE_KEY && admins(unit).length <= 1) throw SAME_ADMIN();
    return [{ action: 'changeAssociate', associate: { customer: { typeId: 'customer', id: customerId }, associateRoleAssignments: [{ associateRole: { typeId: 'associate-role', key: roleKey } }] } }];
  }, provisioningRoot);
  return listTeam(session);
}

export async function removeColleague(session: Session, customerId: string): Promise<TeamResult> {
  await requireEditor(session);
  await updateUnit(session.businessUnitKey, (unit) => {
    const target = unit.associates.find((a) => a.customer.id === customerId);
    if (!target) throw notFoundError();
    if (isAdmin(target) && admins(unit).length <= 1) throw SAME_ADMIN();
    return [{ action: 'removeAssociate', customer: { typeId: 'customer', id: customerId } }];
  }, provisioningRoot);
  return listTeam(session);
}
