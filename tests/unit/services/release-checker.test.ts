import { describe, it, expect, vi } from 'vitest';
import type { SheetsClient } from '../../../src/lib/sheets';
import type { SlackClient } from '../../../src/lib/slack';
import type { Schedule } from '../../../src/lib/types';
import {
  checkRelease,
  findRelevantSchedules,
  requestApproval,
  waitForApproval,
  type ReleaseCheckConfig,
  type Services,
} from '../../../src/services/release-checker';

describe('Release Checker Service', () => {
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

  const createMockServices = (): Services => ({
    sheets: {
      fetchSchedules: vi.fn(),
    } as unknown as SheetsClient,
    slack: {
      postMessage: vi.fn(),
      getReactions: vi.fn(),
      postThreadMessage: vi.fn(),
      getUserInfo: vi.fn(),
    } as unknown as SlackClient,
  });

  describe('findRelevantSchedules', () => {
    it('findRelevantSchedules - when schedules match product, environment and time - returns relevant schedules', () => {
      const schedules: Schedule[] = [
        createSchedule('app1', 'staging', '2024-01-15T10:00:00Z', '2024-01-15T12:00:00Z', 'U123'),
        createSchedule('app2', 'staging', '2024-01-15T11:00:00Z', '2024-01-15T13:00:00Z', 'U456'),
        createSchedule(
          'app1',
          'production',
          '2024-01-15T10:30:00Z',
          '2024-01-15T14:00:00Z',
          'U789'
        ),
      ];
      const currentTime = new Date('2024-01-15T11:00:00Z');

      const result = findRelevantSchedules(schedules, 'app1', 'staging', currentTime);

      expect(result).toHaveLength(1);
      expect(result[0].productName).toBe('app1');
      expect(result[0].environmentName).toBe('staging');
      expect(result[0].personInChargeId).toBe('U123');
    });

    it('findRelevantSchedules - when no matching schedules - returns empty array', () => {
      const schedules: Schedule[] = [
        createSchedule('app1', 'production', '2024-01-15T10:00:00Z', '2024-01-15T12:00:00Z'),
        createSchedule('app2', 'staging', '2024-01-15T14:00:00Z', '2024-01-15T16:00:00Z'),
      ];
      const currentTime = new Date('2024-01-15T13:00:00Z');

      const result = findRelevantSchedules(schedules, 'app1', 'staging', currentTime);

      expect(result).toHaveLength(0);
    });

    describe('Time boundary tests for 12:00-13:00 schedule', () => {
      const schedules: Schedule[] = [
        createSchedule('my-app', 'staging', '2024-01-15T12:00:00Z', '2024-01-15T13:00:00Z', 'U123'),
      ];

      it('findRelevantSchedules - at 11:59 (before start) - returns empty array', () => {
        const currentTime = new Date('2024-01-15T11:59:00Z');
        const result = findRelevantSchedules(schedules, 'my-app', 'staging', currentTime);
        expect(result).toHaveLength(0);
      });

      it('findRelevantSchedules - at 12:00 (start time) - returns schedule', () => {
        const currentTime = new Date('2024-01-15T12:00:00Z');
        const result = findRelevantSchedules(schedules, 'my-app', 'staging', currentTime);
        expect(result).toHaveLength(1);
        expect(result[0].productName).toBe('my-app');
      });

      it('findRelevantSchedules - at 12:30 (during schedule) - returns schedule', () => {
        const currentTime = new Date('2024-01-15T12:30:00Z');
        const result = findRelevantSchedules(schedules, 'my-app', 'staging', currentTime);
        expect(result).toHaveLength(1);
        expect(result[0].productName).toBe('my-app');
      });

      it('findRelevantSchedules - at 13:00 (end time) - returns empty array', () => {
        const currentTime = new Date('2024-01-15T13:00:00Z');
        const result = findRelevantSchedules(schedules, 'my-app', 'staging', currentTime);
        expect(result).toHaveLength(0);
      });

      it('findRelevantSchedules - at 13:01 (after end) - returns empty array', () => {
        const currentTime = new Date('2024-01-15T13:01:00Z');
        const result = findRelevantSchedules(schedules, 'my-app', 'staging', currentTime);
        expect(result).toHaveLength(0);
      });
    });
  });

  describe('requestApproval', () => {
    it('requestApproval - when schedules exist - posts message with mentions', async () => {
      const schedules: Schedule[] = [
        createSchedule(
          'app1',
          'staging',
          '2024-01-15T10:00:00Z',
          '2024-01-15T12:00:00Z',
          'U123',
          'John'
        ),
        createSchedule(
          'app2',
          'staging',
          '2024-01-15T11:00:00Z',
          '2024-01-15T13:00:00Z',
          'U456',
          'Jane'
        ),
      ];
      const config: ReleaseCheckConfig = {
        productName: 'my-app',
        environmentName: 'staging',
        requesterUserId: 'U999',
        waitMinutes: 20,
      };

      const mockSlack = {
        postMessage: vi.fn().mockResolvedValue({
          ok: true,
          value: { channel: 'C123', timestamp: '1234567890.123' },
        }),
        getReactions: vi.fn(),
        postThreadMessage: vi.fn(),
        getUserInfo: vi.fn(),
      } as unknown as SlackClient;

      const result = await requestApproval(schedules, config, mockSlack, 'C123');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.channel).toBe('C123');
        expect(result.value.timestamp).toBe('1234567890.123');
      }

      expect(mockSlack.postMessage).toHaveBeenCalledWith(
        'C123',
        expect.stringContaining('🚀 *Release Request*'),
        ['U123', 'U456']
      );
    });

    it('requestApproval - when slack fails - returns error result', async () => {
      const schedules: Schedule[] = [
        createSchedule('app1', 'staging', '2024-01-15T10:00:00Z', '2024-01-15T12:00:00Z', 'U123'),
      ];
      const config: ReleaseCheckConfig = {
        productName: 'my-app',
        environmentName: 'staging',
        requesterUserId: 'U999',
      };

      const mockSlack = {
        postMessage: vi.fn().mockResolvedValue({
          ok: false,
          error: new Error('Slack API error'),
        }),
        getReactions: vi.fn(),
        postThreadMessage: vi.fn(),
        getUserInfo: vi.fn(),
      } as unknown as SlackClient;

      const result = await requestApproval(schedules, config, mockSlack, 'C123');

      expect(result.ok).toBe(false);
    });
  });

  describe('waitForApproval', () => {
    it('waitForApproval - when approval reaction found - returns approved result', async () => {
      const mockSlack = {
        postMessage: vi.fn(),
        getReactions: vi.fn().mockResolvedValue({
          ok: true,
          value: [{ name: 'ok', count: 1, users: ['U123'] }],
        }),
        postThreadMessage: vi.fn().mockResolvedValue({
          ok: true,
          value: { channel: 'C123', timestamp: '1234567890.124' },
        }),
        getUserInfo: vi.fn().mockResolvedValue({
          ok: true,
          value: { id: 'U123', name: 'Test User' },
        }),
      } as unknown as SlackClient;

      const result = await waitForApproval(
        mockSlack,
        'C123',
        '1234567890.123',
        ['U999'], // exclude requester
        'ok',
        '-1',
        0.1 // 0.1 minutes for fast test
      );

      expect(result.status).toBe('approved');
      expect(result.approvers).toContain('U123');
    });

    it('waitForApproval - when no exclusions and approval found - returns approved result', async () => {
      const mockSlack = {
        postMessage: vi.fn(),
        getReactions: vi.fn().mockResolvedValue({
          ok: true,
          value: [{ name: 'ok', count: 1, users: ['U123'] }],
        }),
        postThreadMessage: vi.fn().mockResolvedValue({
          ok: true,
          value: { channel: 'C123', timestamp: '1234567890.124' },
        }),
        getUserInfo: vi.fn().mockResolvedValue({
          ok: true,
          value: { id: 'U123', name: 'Test User' },
        }),
      } as unknown as SlackClient;

      const result = await waitForApproval(
        mockSlack,
        'C123',
        '1234567890.123',
        [], // no exclusions
        'ok',
        '-1',
        0.1 // 0.1 minutes for fast test
      );

      expect(result.status).toBe('approved');
      expect(result.approvers).toContain('U123');
    });

    it('waitForApproval - when rejection reaction found - returns rejected result', async () => {
      const mockSlack = {
        postMessage: vi.fn(),
        getReactions: vi.fn().mockResolvedValue({
          ok: true,
          value: [{ name: '-1', count: 1, users: ['U123'] }],
        }),
        postThreadMessage: vi.fn().mockResolvedValue({
          ok: true,
          value: { channel: 'C123', timestamp: '1234567890.124' },
        }),
        getUserInfo: vi.fn().mockResolvedValue({
          ok: true,
          value: { id: 'U123', name: 'Test User' },
        }),
      } as unknown as SlackClient;

      const result = await waitForApproval(
        mockSlack,
        'C123',
        '1234567890.123',
        ['U999'],
        'ok',
        '-1',
        0.1
      );

      expect(result.status).toBe('rejected');
      expect(result.approvers).toContain('U123');
    });

    it('waitForApproval - when timeout occurs - returns timeout result', async () => {
      const mockSlack = {
        postMessage: vi.fn(),
        getReactions: vi.fn().mockResolvedValue({
          ok: true,
          value: [],
        }),
        postThreadMessage: vi.fn(),
        getUserInfo: vi.fn(),
      } as unknown as SlackClient;

      const result = await waitForApproval(
        mockSlack,
        'C123',
        '1234567890.123',
        ['U999'],
        'ok',
        '-1',
        0.001, // Very short timeout (0.06 seconds)
        10 // Very short poll interval (10ms) for fast test
      );

      expect(result.status).toBe('timeout');
    });

    it('waitForApproval - when approval reaction found - posts thread message with approver name', async () => {
      const mockSlack = {
        postMessage: vi.fn(),
        getReactions: vi.fn().mockResolvedValue({
          ok: true,
          value: [{ name: 'ok', count: 1, users: ['U123'] }],
        }),
        postThreadMessage: vi.fn().mockResolvedValue({
          ok: true,
          value: { channel: 'C123', timestamp: '1234567890.124' },
        }),
        getUserInfo: vi.fn().mockResolvedValue({
          ok: true,
          value: { id: 'U123', name: 'Test User' },
        }),
      } as unknown as SlackClient;

      const result = await waitForApproval(
        mockSlack,
        'C123',
        '1234567890.123',
        ['U999'], // exclude requester
        'ok',
        '-1',
        0.1,
        10
      );

      expect(result.status).toBe('approved');

      // Verify getUserInfo was called with correct user ID
      expect(mockSlack.getUserInfo).toHaveBeenCalledWith('U123');

      // Verify postThreadMessage was called with correct parameters
      expect(mockSlack.postThreadMessage).toHaveBeenCalledWith(
        'C123',
        '1234567890.123',
        expect.stringMatching(/✅.*<@U123>.*承認しました/)
      );
    });

    it('waitForApproval - when rejection reaction found - posts thread message with rejector name', async () => {
      const mockSlack = {
        postMessage: vi.fn(),
        getReactions: vi.fn().mockResolvedValue({
          ok: true,
          value: [{ name: '-1', count: 1, users: ['U456'] }],
        }),
        postThreadMessage: vi.fn().mockResolvedValue({
          ok: true,
          value: { channel: 'C123', timestamp: '1234567890.124' },
        }),
        getUserInfo: vi.fn().mockResolvedValue({
          ok: true,
          value: { id: 'U456', name: 'Another User' },
        }),
      } as unknown as SlackClient;

      const result = await waitForApproval(
        mockSlack,
        'C123',
        '1234567890.123',
        ['U999'],
        'ok',
        '-1',
        0.1,
        10
      );

      expect(result.status).toBe('rejected');

      // Verify getUserInfo was called with correct user ID
      expect(mockSlack.getUserInfo).toHaveBeenCalledWith('U456');

      // Verify postThreadMessage was called with correct parameters
      expect(mockSlack.postThreadMessage).toHaveBeenCalledWith(
        'C123',
        '1234567890.123',
        expect.stringMatching(/❌.*<@U456>.*拒否しました/)
      );
    });
  });

  describe('checkRelease', () => {
    it('checkRelease - when no relevant schedules - returns immediate approval', async () => {
      const config: ReleaseCheckConfig = {
        productName: 'my-app',
        environmentName: 'staging',
        requesterUserId: 'U999',
      };

      const services = createMockServices();
      vi.mocked(services.sheets.fetchSchedules).mockResolvedValue({
        ok: true,
        value: [
          createSchedule('other-app', 'staging', '2024-01-15T10:00:00Z', '2024-01-15T12:00:00Z'),
        ],
      });

      const result = await checkRelease(config, services, 'C123');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.status).toBe('no_schedule');
        expect(result.value.message).toContain('No active schedules found');
      }
    });

    it('checkRelease - when sheets fetch fails - returns default approval with error notification', async () => {
      const config: ReleaseCheckConfig = {
        productName: 'my-app',
        environmentName: 'staging',
        requesterUserId: 'U999',
      };

      const services = createMockServices();
      vi.mocked(services.sheets.fetchSchedules).mockResolvedValue({
        ok: false,
        error: new Error('Sheets API error'),
      });
      vi.mocked(services.slack.postMessage).mockResolvedValue({
        ok: true,
        value: { channel: 'C123', timestamp: '123' },
      });

      const result = await checkRelease(config, services, 'C123');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.status).toBe('approved');
        expect(result.value.message).toContain('proceeding due to error');
      }

      // Should notify about the error
      expect(services.slack.postMessage).toHaveBeenCalledWith(
        'C123',
        expect.stringContaining('⚠️ Error occurred'),
        []
      );
    });

    it('checkRelease - when schedules found - initiates approval process', async () => {
      const config: ReleaseCheckConfig = {
        productName: 'my-app',
        environmentName: 'staging',
        requesterUserId: 'U999',
        waitMinutes: 0.01, // Very short for test
      };

      const services = createMockServices();
      vi.mocked(services.sheets.fetchSchedules).mockResolvedValue({
        ok: true,
        value: [
          createSchedule(
            'my-app',
            'staging',
            '2024-01-15T10:00:00Z',
            '2024-01-15T12:00:00Z',
            'U123'
          ),
        ],
      });
      vi.mocked(services.slack.postMessage).mockResolvedValue({
        ok: true,
        value: { channel: 'C123', timestamp: '1234567890.123' },
      });
      vi.mocked(services.slack.getReactions).mockResolvedValue({
        ok: true,
        value: [{ name: 'ok', count: 1, users: ['U123'] }],
      });
      vi.mocked(services.slack.getUserInfo).mockResolvedValue({
        ok: true,
        value: { id: 'U123', name: 'Test User' },
      });
      vi.mocked(services.slack.postThreadMessage).mockResolvedValue({
        ok: true,
        value: { channel: 'C123', timestamp: '1234567890.124' },
      });

      // Mock current time to be within schedule
      const originalDate = Date;
      global.Date = class extends originalDate {
        constructor() {
          super('2024-01-15T11:00:00Z');
        }
        static now() {
          return new originalDate('2024-01-15T11:00:00Z').getTime();
        }
      } as DateConstructor;

      const result = await checkRelease(config, services, 'C123');

      // Restore Date
      global.Date = originalDate;

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.status).toBe('approved');
        expect(result.value.schedules).toHaveLength(1);
      }
    });

    it('checkRelease - when no requester user ID provided - allows anyone to approve', async () => {
      const config: ReleaseCheckConfig = {
        productName: 'my-app',
        environmentName: 'staging',
        // No requesterUserId provided
        waitMinutes: 0.01, // Very short for test
      };

      const services = createMockServices();
      vi.mocked(services.sheets.fetchSchedules).mockResolvedValue({
        ok: true,
        value: [
          createSchedule(
            'my-app',
            'staging',
            '2024-01-15T10:00:00Z',
            '2024-01-15T12:00:00Z',
            'U123'
          ),
        ],
      });
      vi.mocked(services.slack.postMessage).mockResolvedValue({
        ok: true,
        value: { channel: 'C123', timestamp: '1234567890.123' },
      });
      vi.mocked(services.slack.getReactions).mockResolvedValue({
        ok: true,
        value: [{ name: 'ok', count: 1, users: ['U123'] }],
      });
      vi.mocked(services.slack.getUserInfo).mockResolvedValue({
        ok: true,
        value: { id: 'U123', name: 'Test User' },
      });
      vi.mocked(services.slack.postThreadMessage).mockResolvedValue({
        ok: true,
        value: { channel: 'C123', timestamp: '1234567890.124' },
      });

      // Mock current time to be within schedule
      const originalDate = Date;
      global.Date = class extends originalDate {
        constructor() {
          super('2024-01-15T11:00:00Z');
        }
        static now() {
          return new originalDate('2024-01-15T11:00:00Z').getTime();
        }
      } as DateConstructor;

      const result = await checkRelease(config, services, 'C123');

      // Restore Date
      global.Date = originalDate;

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.status).toBe('approved');
        expect(result.value.schedules).toHaveLength(1);
      }
    });
  });
});
