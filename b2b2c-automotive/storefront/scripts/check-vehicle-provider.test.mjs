// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { describe, expect, it } from 'vitest';
import { checkVehicleProvider } from './check-vehicle-provider.mjs';

describe('Vehicle provider production gate', () => {
  it('production with lookup on and mock fails', () => {
    const { problems } = checkVehicleProvider({ NODE_ENV: 'production', VEHICLE_LOOKUP_ENABLED: 'true', VEHICLE_PROVIDER: 'stub' });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('VEHICLE_MOCK_ACKNOWLEDGED');
    expect(checkVehicleProvider({ NODE_ENV: 'production', VEHICLE_LOOKUP_ENABLED: 'true' }).problems).toHaveLength(1);
  });

  it('production with lookup on, mock and acknowledgement passes and prints a notice', () => {
    const result = checkVehicleProvider({ NODE_ENV: 'production', VEHICLE_LOOKUP_ENABLED: 'true', VEHICLE_PROVIDER: 'stub', VEHICLE_MOCK_ACKNOWLEDGED: 'true' });
    expect(result.problems).toEqual([]);
    expect(result.notices).toHaveLength(1);
    expect(result.notices[0]).toContain('MOCK');
  });

  it('production with lookup off passes', () => {
    expect(checkVehicleProvider({ NODE_ENV: 'production', VEHICLE_LOOKUP_ENABLED: 'false' })).toEqual({ problems: [], notices: [] });
    expect(checkVehicleProvider({ NODE_ENV: 'production' })).toEqual({ problems: [], notices: [] });
  });

  it('development always passes', () => {
    expect(checkVehicleProvider({ NODE_ENV: 'development', VEHICLE_LOOKUP_ENABLED: 'true' })).toEqual({ problems: [], notices: [] });
    expect(checkVehicleProvider({})).toEqual({ problems: [], notices: [] });
  });

  it('an unknown provider id fails everywhere', () => {
    expect(checkVehicleProvider({ VEHICLE_PROVIDER: 'acme' }).problems).toHaveLength(1);
  });
});
