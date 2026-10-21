export type ErrorCode =
  | 'bad_request' | 'validation_failed' | 'unauthorized' | 'forbidden' | 'not_found'
  | 'conflict' | 'rate_limited' | 'upstream_unavailable' | 'wrong_project' | 'internal_error';
