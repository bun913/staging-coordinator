import type { Result } from '../utils/result';
import { ok, err } from '../utils/result';
import type { Schedule } from './types';

export const parseDateTime = (dateTimeStr: string): Result<Date> => {
  if (!dateTimeStr || dateTimeStr.trim() === '') {
    return err(new Error('Invalid datetime format: empty string'));
  }

  // Expected format: YYYY/MM/DD HH:MM or YYYY/MM/DD HH:MM:SS
  const regex = /^(\d{4})\/(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/;
  const match = dateTimeStr.match(regex);

  if (!match) {
    return err(new Error(`Invalid datetime format: ${dateTimeStr}`));
  }

  const [, year, month, day, hour, minute, second] = match;

  // JavaScript Date constructor expects month to be 0-indexed
  const date = new Date(
    Number.parseInt(year, 10),
    Number.parseInt(month, 10) - 1,
    Number.parseInt(day, 10),
    Number.parseInt(hour, 10),
    Number.parseInt(minute, 10),
    second ? Number.parseInt(second, 10) : 0
  );

  // Check if the date is valid by comparing with input values
  const expectedSecond = second ? Number.parseInt(second, 10) : 0;
  if (
    date.getFullYear() !== Number.parseInt(year, 10) ||
    date.getMonth() !== Number.parseInt(month, 10) - 1 ||
    date.getDate() !== Number.parseInt(day, 10) ||
    date.getHours() !== Number.parseInt(hour, 10) ||
    date.getMinutes() !== Number.parseInt(minute, 10) ||
    date.getSeconds() !== expectedSecond
  ) {
    return err(new Error(`Invalid datetime format: ${dateTimeStr}`));
  }

  return ok(date);
};

export const isValidSlackUserId = (userId: string): boolean => {
  return userId !== null && userId !== undefined && userId.length >= 3;
};

export const validateScheduleRow = (row: string[]): Result<Schedule> => {
  if (row.length < 7) {
    return err(new Error(`Invalid row data: insufficient columns (expected 7, got ${row.length})`));
  }

  const [
    productName,
    environmentName,
    startDateTimeStr,
    endDateTimeStr,
    personInChargeId,
    personInChargeName,
    remarks,
  ] = row;

  // Validate start datetime
  const startDateTimeResult = parseDateTime(startDateTimeStr);
  if (!startDateTimeResult.ok) {
    return err(new Error(`Invalid start datetime: ${startDateTimeResult.error.message}`));
  }

  // Validate end datetime
  const endDateTimeResult = parseDateTime(endDateTimeStr);
  if (!endDateTimeResult.ok) {
    return err(new Error(`Invalid end datetime: ${endDateTimeResult.error.message}`));
  }

  // Validate person in charge ID
  if (!isValidSlackUserId(personInChargeId)) {
    return err(new Error(`Invalid person in charge ID: ${personInChargeId}`));
  }

  return ok({
    productName,
    environmentName,
    startDateTime: startDateTimeResult.value,
    endDateTime: endDateTimeResult.value,
    personInChargeId,
    personInChargeName,
    remarks,
  });
};
