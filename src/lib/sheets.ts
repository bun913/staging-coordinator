import type { Result } from '../utils/result';
import { ok, err } from '../utils/result';
import type { Schedule } from './types';
import { validateScheduleRow } from './schedule';
import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';

export interface SheetsClient {
  fetchSchedules(): Promise<Result<Schedule[]>>;
}

// Google Sheets API wrapper interface for dependency injection
export interface GoogleSheetsApi {
  getValues(spreadsheetId: string, range: string): Promise<string[][]>;
}

// Default Google Sheets API implementation
class GoogleSheetsApiImpl implements GoogleSheetsApi {
  private sheets;

  constructor(credentials: object) {
    const auth = new GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    this.sheets = google.sheets({ version: 'v4', auth });
  }

  async getValues(spreadsheetId: string, range: string): Promise<string[][]> {
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    return (response.data.values as string[][]) || [];
  }
}

export class GoogleSheetsClient implements SheetsClient {
  constructor(
    private readonly api: GoogleSheetsApi,
    private readonly spreadsheetId: string,
    private readonly sheetName: string
  ) {}

  async fetchSchedules(): Promise<Result<Schedule[]>> {
    try {
      const range = `${this.sheetName}!A:G`; // Columns A through G
      const rawData = await this.api.getValues(this.spreadsheetId, range);

      if (!rawData || rawData.length === 0) {
        return ok([]);
      }

      // Skip header row if exists (assume first row is header)
      const dataRows = rawData.slice(1);
      const schedules: Schedule[] = [];

      for (const [index, row] of dataRows.entries()) {
        const rowNumber = index + 2; // +2 because we skipped header and arrays are 0-indexed

        const result = validateScheduleRow(row);
        if (result.ok) {
          schedules.push(result.value);
        } else {
          // Log validation error but continue processing other rows
          console.warn(`Row ${rowNumber}: ${result.error.message}`);
        }
      }

      return ok(schedules);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error occurred';
      return err(new Error(`Failed to fetch schedules from Google Sheets: ${message}`));
    }
  }
}

// Factory function for easy usage
interface SheetsClientConfig {
  credentials?: object;
  api?: GoogleSheetsApi;
  spreadsheetId: string;
  sheetName?: string;
}

export const createSheetsClient = (config: SheetsClientConfig): SheetsClient => {
  if (!config.api && !config.credentials) {
    throw new Error('Either api or credentials must be provided');
  }

  const api = config.api || new GoogleSheetsApiImpl(config.credentials as object);
  const sheetName = config.sheetName || 'シート1';
  return new GoogleSheetsClient(api, config.spreadsheetId, sheetName);
};
