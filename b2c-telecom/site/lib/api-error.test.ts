import { API_ERROR_STATUS, ApiError, isApiErrorCode } from './api-error';

describe('ApiError', () => {
  it('maps every code to its HTTP status', () => {
    expect(API_ERROR_STATUS).toEqual({
      VALIDATION: 400,
      UNAUTHENTICATED: 401,
      FORBIDDEN: 403,
      NOT_FOUND: 404,
      CONFLICT: 409,
      RATE_LIMITED: 429,
      INTERNAL: 500,
      UPSTREAM_ERROR: 502,
    });
    expect(new ApiError('CONFLICT', 'x').status).toBe(409);
    expect(new ApiError('RATE_LIMITED', 'x').status).toBe(429);
  });

  it('serialises to the shared body, with details only when given', () => {
    expect(new ApiError('VALIDATION', 'bad').toBody()).toEqual({ error: { code: 'VALIDATION', message: 'bad' } });
    expect(new ApiError('VALIDATION', 'bad', { field: 'a' }).toBody()).toEqual({
      error: { code: 'VALIDATION', message: 'bad', details: { field: 'a' } },
    });
  });

  it('recognises codes', () => {
    expect(isApiErrorCode('NOT_FOUND')).toBe(true);
    expect(isApiErrorCode('nope')).toBe(false);
    expect(isApiErrorCode(404)).toBe(false);
  });
});
