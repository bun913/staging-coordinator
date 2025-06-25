import type { Result } from './result';
import { ok, err } from './result';
import { ValidationError } from './errors';
import type { Schedule } from '../lib/types';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

export enum ScheduleStatus {
  NOT_STARTED = 'NOT_STARTED',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
}

/**
 * Get current date and time in specified timezone
 */
export const getCurrentDateTime = (timezoneStr: string): Result<Date> => {
  try {
    // Get current time in specified timezone using dayjs
    const now = dayjs.tz(dayjs(), timezoneStr);

    // Get the UTC offset in minutes for the specified timezone
    const offsetMinutes = now.utcOffset();

    // Create a UTC Date and adjust it by the timezone offset
    // This ensures schedule comparisons work correctly with the adjusted time
    const utcNow = dayjs.utc();
    const adjustedUtcTime = utcNow.add(offsetMinutes, 'minute');

    return ok(adjustedUtcTime.toDate());
  } catch (_error) {
    return err(new ValidationError(`Invalid timezone: ${timezoneStr}`, { field: 'timezone' }));
  }
};

/**
 * Check if current time is within the specified time range
 * Range is inclusive of start time, exclusive of end time [start, end)
 */
export const isWithinTimeRange = (current: Date, start: Date, end: Date): boolean => {
  return current >= start && current < end;
};

/**
 * Format date and time for display in specified timezone
 */
export const formatDateTime = (date: Date, timezone: string): Result<string> => {
  try {
    const formatter = new Intl.DateTimeFormat('ja-JP', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    const formatted = formatter.format(date);
    // Convert to YYYY/MM/DD HH:MM format
    const parts = formatted.split(' ');
    const datePart = parts[0].replace(/-/g, '/');
    const timePart = parts[1];

    return ok(`${datePart} ${timePart}`);
  } catch (_error) {
    return err(new ValidationError(`Invalid timezone: ${timezone}`, { field: 'timezone' }));
  }
};

/**
 * Find schedules that are currently active at the given time
 */
export const findActiveSchedules = (schedules: Schedule[], currentTime: Date): Schedule[] => {
  return schedules.filter((schedule) =>
    isWithinTimeRange(currentTime, schedule.startDateTime, schedule.endDateTime)
  );
};

/**
 * Find overlapping schedules for the same environment
 */
export const findOverlappingSchedules = (schedules: Schedule[]): Schedule[][] => {
  const overlaps: Schedule[][] = [];

  for (let i = 0; i < schedules.length; i++) {
    for (let j = i + 1; j < schedules.length; j++) {
      const schedule1 = schedules[i];
      const schedule2 = schedules[j];

      // Only check schedules in the same environment
      if (schedule1.environmentName !== schedule2.environmentName) {
        continue;
      }

      // Check if time ranges overlap
      const overlap =
        schedule1.startDateTime < schedule2.endDateTime &&
        schedule2.startDateTime < schedule1.endDateTime;

      if (overlap) {
        overlaps.push([schedule1, schedule2]);
      }
    }
  }

  return overlaps;
};

/**
 * Get the status of a schedule relative to current time
 */
export const getScheduleStatus = (schedule: Schedule, currentTime: Date): ScheduleStatus => {
  if (currentTime < schedule.startDateTime) {
    return ScheduleStatus.NOT_STARTED;
  }

  if (currentTime >= schedule.endDateTime) {
    return ScheduleStatus.COMPLETED;
  }

  return ScheduleStatus.ACTIVE;
};
