import { describe, it, expect } from 'vitest';
import type { Schedule } from '../../../src/lib/types';

describe('Schedule type', () => {
  it('Schedule - should have all required fields with correct types', () => {
    const schedule: Schedule = {
      productName: 'web-app',
      environmentName: 'staging',
      startDateTime: new Date('2024-01-15T10:00:00+09:00'),
      endDateTime: new Date('2024-01-15T18:00:00+09:00'),
      personInChargeId: 'U1234ABCD',
      personInChargeName: 'John Doe',
      remarks: 'Feature testing',
    };

    expect(schedule.productName).toBe('web-app');
    expect(schedule.environmentName).toBe('staging');
    expect(schedule.startDateTime).toBeInstanceOf(Date);
    expect(schedule.endDateTime).toBeInstanceOf(Date);
    expect(schedule.personInChargeId).toBe('U1234ABCD');
    expect(schedule.personInChargeName).toBe('John Doe');
    expect(schedule.remarks).toBe('Feature testing');
  });

  it('Schedule - should allow empty remarks', () => {
    const schedule: Schedule = {
      productName: 'api-server',
      environmentName: 'staging',
      startDateTime: new Date('2024-01-15T10:00:00+09:00'),
      endDateTime: new Date('2024-01-15T18:00:00+09:00'),
      personInChargeId: 'U5678EFGH',
      personInChargeName: 'Jane Smith',
      remarks: '',
    };

    expect(schedule.remarks).toBe('');
  });
});
