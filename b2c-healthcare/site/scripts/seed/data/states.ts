import { PREFIX } from '../lib';
import { L } from './types';

/** Order states matching the timeline in the design; `transitions` lists allowed next states by key. */
export interface StateDef { key: string; name: string; initial: boolean; transitions: string[] }

export const STATES: StateDef[] = [
  { key: `${PREFIX}received`, name: 'Received', initial: true, transitions: [`${PREFIX}pharmacist-review`, `${PREFIX}cancelled`] },
  { key: `${PREFIX}pharmacist-review`, name: 'Pharmacist review', initial: false, transitions: [`${PREFIX}packed-shipped`, `${PREFIX}cancelled`] },
  { key: `${PREFIX}packed-shipped`, name: 'Packed and shipped', initial: false, transitions: [`${PREFIX}delivered`] },
  { key: `${PREFIX}delivered`, name: 'Delivered', initial: false, transitions: [] },
  { key: `${PREFIX}cancelled`, name: 'Cancelled', initial: false, transitions: [] },
];

export const stateDraft = (s: StateDef) => ({ key: s.key, type: 'OrderState', initial: s.initial, name: L(s.name), roles: [] as string[] });

export const transitionRefs = (s: StateDef) => s.transitions.map((key) => ({ typeId: 'state', key }));
