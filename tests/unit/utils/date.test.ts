import { describe, it, expect } from 'vitest';
import {
  getCurrentDateTime,
  isWithinTimeRange,
  formatDateTime,
  findActiveSchedules,
  findOverlappingSchedules,
  getScheduleStatus,
  ScheduleStatus,
} from '../../../src/utils/date';
import type { Schedule } from '../../../src/lib/types';

describe('Basic Date Operations', () => {
  describe('getCurrentDateTime', () => {
    it('getCurrentDateTime - when timezone provided - returns date in specified timezone', () => {
      const result = getCurrentDateTime('Asia/Tokyo');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBeInstanceOf(Date);
        // Check that it's a valid recent date (within last minute)
        const now = new Date();
        const diff = Math.abs(now.getTime() - result.value.getTime());
        expect(diff).toBeLessThan(60000); // Within 1 minute
      }
    });

    it('getCurrentDateTime - when invalid timezone - returns error result', () => {
      const result = getCurrentDateTime('Invalid/Timezone');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('Invalid timezone');
      }
    });
  });

  describe('isWithinTimeRange', () => {
    it('isWithinTimeRange - when current time is within range - returns true', () => {
      const start = new Date('2024-01-15T10:00:00Z');
      const current = new Date('2024-01-15T12:00:00Z');
      const end = new Date('2024-01-15T18:00:00Z');

      const result = isWithinTimeRange(current, start, end);

      expect(result).toBe(true);
    });

    it('isWithinTimeRange - when current time equals start time - returns true', () => {
      const start = new Date('2024-01-15T10:00:00Z');
      const current = new Date('2024-01-15T10:00:00Z');
      const end = new Date('2024-01-15T18:00:00Z');

      const result = isWithinTimeRange(current, start, end);

      expect(result).toBe(true);
    });

    it('isWithinTimeRange - when current time equals end time - returns false', () => {
      const start = new Date('2024-01-15T10:00:00Z');
      const current = new Date('2024-01-15T18:00:00Z');
      const end = new Date('2024-01-15T18:00:00Z');

      const result = isWithinTimeRange(current, start, end);

      expect(result).toBe(false);
    });

    it('isWithinTimeRange - when current time is before start - returns false', () => {
      const start = new Date('2024-01-15T10:00:00Z');
      const current = new Date('2024-01-15T09:00:00Z');
      const end = new Date('2024-01-15T18:00:00Z');

      const result = isWithinTimeRange(current, start, end);

      expect(result).toBe(false);
    });

    it('isWithinTimeRange - when current time is after end - returns false', () => {
      const start = new Date('2024-01-15T10:00:00Z');
      const current = new Date('2024-01-15T19:00:00Z');
      const end = new Date('2024-01-15T18:00:00Z');

      const result = isWithinTimeRange(current, start, end);

      expect(result).toBe(false);
    });
  });

  describe('formatDateTime', () => {
    it('formatDateTime - when valid date and timezone - returns formatted string', () => {
      const date = new Date('2024-01-15T10:00:00Z');
      const result = formatDateTime(date, 'Asia/Tokyo');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toMatch(/2024\/01\/15 \d{2}:\d{2}/);
      }
    });

    it('formatDateTime - when invalid timezone - returns error result', () => {
      const date = new Date('2024-01-15T10:00:00Z');
      const result = formatDateTime(date, 'Invalid/Timezone');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('Invalid timezone');
      }
    });
  });
});

describe('Schedule Operations', () => {
  const createSchedule = (
    productName: string,
    environmentName: string,
    startTime: string,
    endTime: string,
    personId = 'U123',
    personName = 'Test User',
    remarks = 'Test'
  ): Schedule => ({
    productName,
    environmentName,
    startDateTime: new Date(startTime),
    endDateTime: new Date(endTime),
    personInChargeId: personId,
    personInChargeName: personName,
    remarks,
  });

  describe('findActiveSchedules', () => {
    it('findActiveSchedules - when current time overlaps with schedules - returns active schedules', () => {
      const schedules: Schedule[] = [
        createSchedule('app1', 'staging', '2024-01-15T10:00:00Z', '2024-01-15T12:00:00Z'),
        createSchedule('app2', 'staging', '2024-01-15T14:00:00Z', '2024-01-15T16:00:00Z'),
        createSchedule('app3', 'staging', '2024-01-15T11:00:00Z', '2024-01-15T13:00:00Z'),
      ];
      const currentTime = new Date('2024-01-15T11:30:00Z');

      const result = findActiveSchedules(schedules, currentTime);

      expect(result).toHaveLength(2);
      expect(result[0].productName).toBe('app1');
      expect(result[1].productName).toBe('app3');
    });

    it('findActiveSchedules - when no schedules are active - returns empty array', () => {
      const schedules: Schedule[] = [
        createSchedule('app1', 'staging', '2024-01-15T10:00:00Z', '2024-01-15T12:00:00Z'),
        createSchedule('app2', 'staging', '2024-01-15T14:00:00Z', '2024-01-15T16:00:00Z'),
      ];
      const currentTime = new Date('2024-01-15T13:00:00Z');

      const result = findActiveSchedules(schedules, currentTime);

      expect(result).toHaveLength(0);
    });
  });

  describe('findOverlappingSchedules', () => {
    it('findOverlappingSchedules - when schedules overlap - returns overlapping pairs', () => {
      const schedules: Schedule[] = [
        createSchedule('app1', 'staging', '2024-01-15T10:00:00Z', '2024-01-15T12:00:00Z'),
        createSchedule('app2', 'staging', '2024-01-15T11:00:00Z', '2024-01-15T13:00:00Z'),
        createSchedule('app3', 'production', '2024-01-15T11:30:00Z', '2024-01-15T14:00:00Z'),
      ];

      const result = findOverlappingSchedules(schedules);

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveLength(2);
      expect(result[0][0].productName).toBe('app1');
      expect(result[0][1].productName).toBe('app2');
    });

    it('findOverlappingSchedules - when no schedules overlap - returns empty array', () => {
      const schedules: Schedule[] = [
        createSchedule('app1', 'staging', '2024-01-15T10:00:00Z', '2024-01-15T12:00:00Z'),
        createSchedule('app2', 'staging', '2024-01-15T13:00:00Z', '2024-01-15T15:00:00Z'),
      ];

      const result = findOverlappingSchedules(schedules);

      expect(result).toHaveLength(0);
    });
  });

  describe('getScheduleStatus', () => {
    it('getScheduleStatus - when current time is before schedule - returns NOT_STARTED', () => {
      const schedule = createSchedule(
        'app1',
        'staging',
        '2024-01-15T14:00:00Z',
        '2024-01-15T16:00:00Z'
      );
      const currentTime = new Date('2024-01-15T13:00:00Z');

      const result = getScheduleStatus(schedule, currentTime);

      expect(result).toBe(ScheduleStatus.NOT_STARTED);
    });

    it('getScheduleStatus - when current time is within schedule - returns ACTIVE', () => {
      const schedule = createSchedule(
        'app1',
        'staging',
        '2024-01-15T14:00:00Z',
        '2024-01-15T16:00:00Z'
      );
      const currentTime = new Date('2024-01-15T15:00:00Z');

      const result = getScheduleStatus(schedule, currentTime);

      expect(result).toBe(ScheduleStatus.ACTIVE);
    });

    it('getScheduleStatus - when current time is after schedule - returns COMPLETED', () => {
      const schedule = createSchedule(
        'app1',
        'staging',
        '2024-01-15T14:00:00Z',
        '2024-01-15T16:00:00Z'
      );
      const currentTime = new Date('2024-01-15T17:00:00Z');

      const result = getScheduleStatus(schedule, currentTime);

      expect(result).toBe(ScheduleStatus.COMPLETED);
    });
  });
});
