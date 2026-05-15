import { describe, it, expect } from 'vitest';
import * as Contracts from '../../../src/core/contracts';

describe('ISignificanceFilter Interface', () => {
  it('should be defined in contracts', () => {
    expect(Contracts.ISignificanceFilter).toBeDefined();
  });
});

});
