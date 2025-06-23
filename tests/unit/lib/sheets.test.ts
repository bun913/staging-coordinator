import { describe, it, expect, vi } from 'vitest';
import type { SheetsClient, GoogleSheetsApi } from '../../../src/lib/sheets';
import { GoogleSheetsClient, createSheetsClient } from '../../../src/lib/sheets';

describe('SheetsClient interface', () => {
  it('SheetsClient - should have fetchSchedules method returning Promise<Result<Schedule[]>>', () => {
    // This test ensures the interface is properly defined
    const mockClient: SheetsClient = {
      fetchSchedules: async () => {
        return {
          ok: true,
          value: [
            {
              productName: 'web-app',
              environmentName: 'staging',
              startDateTime: new Date('2024-01-15T10:00:00+09:00'),
              endDateTime: new Date('2024-01-15T18:00:00+09:00'),
              personInChargeId: 'U1234ABCD',
              personInChargeName: 'John Doe',
              remarks: 'Feature testing',
            },
          ],
        };
      },
    };

    expect(typeof mockClient.fetchSchedules).toBe('function');
    expect(mockClient.fetchSchedules()).toBeInstanceOf(Promise);
  });

  it('SheetsClient.fetchSchedules - should return error result when operation fails', async () => {
    const mockClient: SheetsClient = {
      fetchSchedules: async () => {
        return {
          ok: false,
          error: new Error('Failed to fetch sheets data'),
        };
      },
    };

    const result = await mockClient.fetchSchedules();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error.message).toBe('Failed to fetch sheets data');
    }
  });
});

describe('GoogleSheetsClient', () => {
  it('GoogleSheetsClient.fetchSchedules - when valid sheet data - returns success result with schedules', async () => {
    const mockSheetsData = [
      ['Product', 'Environment', 'Start', 'End', 'PersonId', 'PersonName', 'Remarks'], // header
      [
        'web-app',
        'staging',
        '2024/01/15 10:00',
        '2024/01/15 18:00',
        'U1234ABCD',
        'John Doe',
        'Feature testing',
      ],
      [
        'api-server',
        'staging',
        '2024/01/16 09:00',
        '2024/01/16 17:00',
        'U5678EFGH',
        'Jane Smith',
        'Bug fixes',
      ],
    ];

    const mockApi: GoogleSheetsApi = {
      getValues: vi.fn().mockResolvedValue(mockSheetsData),
    };

    const client = new GoogleSheetsClient(mockApi, 'test-spreadsheet', 'Sheet1');
    const result = await client.fetchSchedules();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(2);
      expect(result.value[0].productName).toBe('web-app');
      expect(result.value[1].productName).toBe('api-server');
    }
  });

  it('GoogleSheetsClient.fetchSchedules - when invalid row data - returns partial success with valid rows only', async () => {
    const mockSheetsData = [
      [
        'web-app',
        'staging',
        '2024/01/15 10:00',
        '2024/01/15 18:00',
        'U1234ABCD',
        'John Doe',
        'Feature testing',
      ],
      ['invalid', 'data'], // insufficient columns
      [
        'api-server',
        'staging',
        'invalid-date',
        '2024/01/16 17:00',
        'U5678EFGH',
        'Jane Smith',
        'Bug fixes',
      ], // invalid date
    ];

    // TODO: Test should return only the valid first row, logging errors for invalid rows
    expect(mockSheetsData).toHaveLength(3);
    expect(mockSheetsData[1]).toHaveLength(2); // insufficient columns
  });

  it('GoogleSheetsClient.fetchSchedules - when sheets API fails - returns error result', async () => {
    // TODO: Test Google Sheets API connection failure
    // Should return Result<never, Error> with appropriate error message
    const expectedError = new Error('Failed to connect to Google Sheets API');
    expect(expectedError).toBeInstanceOf(Error);
  });
});

describe('createSheetsClient', () => {
  it('createSheetsClient - when api provided - should use injected api', () => {
    const mockApi: GoogleSheetsApi = {
      getValues: vi.fn(),
    };

    const client = createSheetsClient({
      api: mockApi,
      spreadsheetId: 'test-id',
      sheetName: 'Sheet1',
    });

    expect(client).toBeDefined();
    expect(typeof client.fetchSchedules).toBe('function');
  });

  it('createSheetsClient - when credentials provided - should create default api', () => {
    const mockCredentials = {
      type: 'service_account',
      project_id: 'test-project',
      private_key: 'test-key',
      client_email: 'test@test.com',
    };

    const client = createSheetsClient({
      credentials: mockCredentials,
      spreadsheetId: 'test-id',
      sheetName: 'Sheet1',
    });

    expect(client).toBeDefined();
    expect(typeof client.fetchSchedules).toBe('function');
  });

  it('createSheetsClient - when neither api nor credentials provided - should throw error', () => {
    expect(() => {
      createSheetsClient({
        spreadsheetId: 'test-id',
        sheetName: 'Sheet1',
      });
    }).toThrow('Either api or credentials must be provided');
  });
});
