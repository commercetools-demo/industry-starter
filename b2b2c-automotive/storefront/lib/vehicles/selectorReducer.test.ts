// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { describe, expect, it } from 'vitest';
import { initialSelection, optionsQuery, selectorReducer } from './selectorReducer';

describe('Selector reducer (make, model, year, engine)', () => {
  it('starts empty', () => {
    expect(initialSelection).toEqual({});
  });

  it('selecting a level sets it', () => {
    expect(selectorReducer({}, { type: 'select', level: 'make', key: 'volkswagen' })).toEqual({ make: 'volkswagen' });
  });

  it('changing make clears the rest', () => {
    const full = { make: 'volkswagen', model: 'golf', year: '2016', engine: '2-0-tdi' };
    expect(selectorReducer(full, { type: 'select', level: 'make', key: 'audi' })).toEqual({ make: 'audi' });
  });

  it('changing the year clears the engine only', () => {
    const full = { make: 'volkswagen', model: 'golf', year: '2016', engine: '2-0-tdi' };
    expect(selectorReducer(full, { type: 'select', level: 'year', key: '2019' })).toEqual({ make: 'volkswagen', model: 'golf', year: '2019' });
  });

  it('choosing the empty option clears that level and below', () => {
    const full = { make: 'volkswagen', model: 'golf', year: '2016', engine: '2-0-tdi' };
    expect(selectorReducer(full, { type: 'select', level: 'model', key: '' })).toEqual({ make: 'volkswagen' });
  });

  it('reset empties everything', () => {
    expect(selectorReducer({ make: 'audi', model: 'a3' }, { type: 'reset' })).toEqual({});
  });

  it('builds the options query for the next level', () => {
    expect(optionsQuery({}, 'make')).toEqual({});
    expect(optionsQuery({ make: 'audi' }, 'model')).toEqual({ make: 'audi' });
    expect(optionsQuery({ make: 'audi', model: 'a3' }, 'year')).toEqual({ make: 'audi', model: 'a3' });
    expect(optionsQuery({ make: 'audi', model: 'a3', year: '2018' }, 'engine')).toEqual({ make: 'audi', model: 'a3', year: '2018' });
  });

  it('a level is available only when the one before it is chosen', () => {
    expect(optionsQuery({}, 'model')).toBeNull();
    expect(optionsQuery({ make: 'audi' }, 'year')).toBeNull();
    expect(optionsQuery({ make: 'audi', model: 'a3' }, 'engine')).toBeNull();
  });
});
