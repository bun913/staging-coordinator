import { describe, it, expect } from 'vitest';
import { ok, err, isOk, isErr, type Result } from '../../../src/utils/result';

describe('Result type', () => {
  it('ok - should create successful result', () => {
    const result = ok('success');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe('success');
    }
  });

  it('err - should create error result', () => {
    const error = new Error('test error');
    const result = err(error);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe(error);
    }
  });

  it('should work with different types', () => {
    const numberResult: Result<number> = ok(42);
    const stringResult: Result<string> = err(new Error('failed'));

    expect(numberResult.ok).toBe(true);
    expect(stringResult.ok).toBe(false);
  });
});

describe('isOk', () => {
  it('isOk - when result is success - returns true', () => {
    const result = ok('success');

    expect(isOk(result)).toBe(true);
  });

  it('isOk - when result is error - returns false', () => {
    const result = err(new Error('failed'));

    expect(isOk(result)).toBe(false);
  });
});

describe('isErr', () => {
  it('isErr - when result is error - returns true', () => {
    const result = err(new Error('failed'));

    expect(isErr(result)).toBe(true);
  });

  it('isErr - when result is success - returns false', () => {
    const result = ok('success');

    expect(isErr(result)).toBe(false);
  });
});
