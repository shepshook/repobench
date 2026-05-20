import { mapSpawnErrorToRca } from '../../../src/infrastructure/pty/rca-utils';

describe('mapSpawnErrorToRca', () => {
  const prefix = 'PtySession failed to spawn: ';

  it('should map "access is denied" to Windows privilege requirements', () => {
    const error = new Error('Access is denied');
    expect(mapSpawnErrorToRca(error)).toBe(`${prefix}Windows privilege requirements (please run as administrator)`);
  });

  it('should map "invalid handle" to environmental configurations issue', () => {
    const error = new Error('Invalid handle');
    expect(mapSpawnErrorToRca(error)).toBe(`${prefix}environmental configurations issue (Invalid handle)`);
  });

  it('should map "internal windows error" to node-pty dependency limitations', () => {
    const error = new Error('Internal Windows Error');
    expect(mapSpawnErrorToRca(error)).toBe(`${prefix}node-pty dependency limitations (Internal Windows error)`);
  });

  it('should handle default case for unknown errors', () => {
    const error = new Error('Some other error');
    expect(mapSpawnErrorToRca(error)).toBe(`${prefix}Some other error`);
  });

  it('should handle string input', () => {
    expect(mapSpawnErrorToRca('access is denied')).toBe(`${prefix}Windows privilege requirements (please run as administrator)`);
    expect(mapSpawnErrorToRca('unknown error')).toBe(`${prefix}unknown error`);
  });

  it('should handle null or undefined input', () => {
    expect(mapSpawnErrorToRca(null)).toBe(`${prefix}null`);
    expect(mapSpawnErrorToRca(undefined)).toBe(`${prefix}undefined`);
  });

  it('should be case-insensitive', () => {
    expect(mapSpawnErrorToRca('ACCESS IS DENIED')).toBe(`${prefix}Windows privilege requirements (please run as administrator)`);
    expect(mapSpawnErrorToRca('InVaLiD HaNdLe')).toBe(`${prefix}environmental configurations issue (Invalid handle)`);
  });
});
