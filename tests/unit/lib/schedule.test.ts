import { describe, it, expect } from 'vitest';
import { parseDateTime, isValidSlackUserId, validateScheduleRow } from '../../../src/lib/schedule';

describe('parseDateTime', () => {
  it('parseDateTime - when valid datetime string - returns success result with Date', () => {
    const result = parseDateTime('2024/01/15 10:00');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBeInstanceOf(Date);
      expect(result.value.getFullYear()).toBe(2024);
      expect(result.value.getMonth()).toBe(0); // January is 0
      expect(result.value.getDate()).toBe(15);
      expect(result.value.getHours()).toBe(10);
      expect(result.value.getMinutes()).toBe(0);
    }
  });

  it('parseDateTime - when valid datetime without seconds - returns success result', () => {
    const result = parseDateTime('2024/12/31 23:59');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.getFullYear()).toBe(2024);
      expect(result.value.getMonth()).toBe(11); // December is 11
      expect(result.value.getDate()).toBe(31);
      expect(result.value.getHours()).toBe(23);
      expect(result.value.getMinutes()).toBe(59);
      expect(result.value.getSeconds()).toBe(0);
    }
  });

  it('parseDateTime - when valid datetime with seconds - returns success result', () => {
    const result = parseDateTime('2025/06/23 20:00:30');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.getFullYear()).toBe(2025);
      expect(result.value.getMonth()).toBe(5); // June is 5
      expect(result.value.getDate()).toBe(23);
      expect(result.value.getHours()).toBe(20);
      expect(result.value.getMinutes()).toBe(0);
      expect(result.value.getSeconds()).toBe(30);
    }
  });

  it('parseDateTime - when invalid format - returns error result', () => {
    const result = parseDateTime('invalid-date');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error.message).toContain('Invalid datetime format');
    }
  });

  it('parseDateTime - when empty string - returns error result', () => {
    const result = parseDateTime('');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error.message).toContain('Invalid datetime format');
    }
  });

  it('parseDateTime - when invalid date values - returns error result', () => {
    const result = parseDateTime('2024/13/32 25:61');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error.message).toContain('Invalid datetime format');
    }
  });
});

describe('isValidSlackUserId', () => {
  it('isValidSlackUserId - when non-empty string with sufficient length - returns true', () => {
    expect(isValidSlackUserId('U1234ABCD')).toBe(true);
    expect(isValidSlackUserId('whatever')).toBe(true);
    expect(isValidSlackUserId('abc123')).toBe(true);
    expect(isValidSlackUserId('user-id-with-special-chars')).toBe(true);
  });

  it('isValidSlackUserId - when empty string - returns false', () => {
    expect(isValidSlackUserId('')).toBe(false);
  });

  it('isValidSlackUserId - when too short - returns false', () => {
    expect(isValidSlackUserId('ab')).toBe(false);
    expect(isValidSlackUserId('x')).toBe(false);
  });
});

describe('validateScheduleRow', () => {
  it('validateScheduleRow - when valid row data - returns success result with Schedule', () => {
    const row = [
      'web-app',
      'staging',
      '2024/01/15 10:00',
      '2024/01/15 18:00',
      'U1234ABCD',
      'John Doe',
      'Feature testing',
    ];

    const result = validateScheduleRow(row);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.productName).toBe('web-app');
      expect(result.value.environmentName).toBe('staging');
      expect(result.value.startDateTime).toBeInstanceOf(Date);
      expect(result.value.endDateTime).toBeInstanceOf(Date);
      expect(result.value.personInChargeId).toBe('U1234ABCD');
      expect(result.value.personInChargeName).toBe('John Doe');
      expect(result.value.remarks).toBe('Feature testing');
    }
  });

  it('validateScheduleRow - when insufficient columns - returns error result', () => {
    const row = ['web-app', 'staging'];

    const result = validateScheduleRow(row);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('insufficient columns');
    }
  });

  it('validateScheduleRow - when invalid start datetime - returns error result', () => {
    const row = [
      'web-app',
      'staging',
      'invalid-date',
      '2024/01/15 18:00',
      'U1234ABCD',
      'John Doe',
      'Feature testing',
    ];

    const result = validateScheduleRow(row);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('Invalid start datetime');
    }
  });

  it('validateScheduleRow - when invalid end datetime - returns error result', () => {
    const row = [
      'web-app',
      'staging',
      '2024/01/15 10:00',
      'invalid-date',
      'U1234ABCD',
      'John Doe',
      'Feature testing',
    ];

    const result = validateScheduleRow(row);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('Invalid end datetime');
    }
  });

  it('validateScheduleRow - when invalid user ID - returns error result', () => {
    const row = [
      'web-app',
      'staging',
      '2024/01/15 10:00',
      '2024/01/15 18:00',
      'ab', // too short
      'John Doe',
      'Feature testing',
    ];

    const result = validateScheduleRow(row);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('Invalid person in charge ID');
    }
  });
});
