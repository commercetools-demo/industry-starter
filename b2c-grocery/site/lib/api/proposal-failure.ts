import 'server-only';
import { privateJson } from './private-json';
import { ProposalConflictError, ProposalNotEditableError, ProposalNotFoundError } from '../ct/order-edits';

/** Maps proposal errors to responses: not found or not the caller's 404, not editable 422 `NOT_EDITABLE`, stale 409 `STALE`. */
export function proposalFailure(e: unknown) {
  if (e instanceof ProposalNotFoundError) return privateJson({ error: 'PROPOSAL_NOT_FOUND' }, { status: 404 });
  if (e instanceof ProposalNotEditableError) return privateJson({ error: 'NOT_EDITABLE' }, { status: 422 });
  if (e instanceof ProposalConflictError) return privateJson({ error: 'STALE' }, { status: 409 });
  console.error('Proposal request failed', e instanceof Error ? e.message : e);
  return privateJson({ error: 'PROPOSALS_ERROR' }, { status: 500 });
}
