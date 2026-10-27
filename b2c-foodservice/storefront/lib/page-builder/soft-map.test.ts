import { describe, expect, it, vi } from 'vitest';
import type { PageBuilderComponent } from '@commercetools-labs/page-builder';
import { withSoftFail } from './soft-map';

const Banner: PageBuilderComponent = () => 'banner';

describe('withSoftFail', () => {
  it('returns the real component for a known type', () => {
    const map = withSoftFail({ banner: Banner }, vi.fn());
    expect(map.banner).toBe(Banner);
  });

  it('renders nothing for an unknown type and names it in the log once', () => {
    const log = vi.fn();
    const map = withSoftFail({ banner: Banner }, log);
    const Skip = map['promo-countdown'];
    expect(Skip({ data: undefined as never })).toBeNull();
    expect(Skip({ data: undefined as never })).toBeNull();
    expect(map['promo-countdown']).toBe(Skip);
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0][0]).toContain('promo-countdown');
  });

  it('does not treat inherited object keys as components', () => {
    const log = vi.fn();
    const map = withSoftFail({}, log);
    const Skip = map['toString'] as PageBuilderComponent;
    expect(Skip({ data: undefined as never })).toBeNull();
    expect(log).toHaveBeenCalledTimes(1);
  });
});
