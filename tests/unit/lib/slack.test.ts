import { describe, it, expect, vi } from 'vitest';
import type { SlackClient, SlackApi } from '../../../src/lib/slack';
import { SlackWebClient, createSlackClient } from '../../../src/lib/slack';

describe('SlackClient interface', () => {
  it('SlackClient - should have postMessage method', () => {
    const mockClient: SlackClient = {
      postMessage: async () => ({
        ok: true,
        value: { channel: 'C123', timestamp: '1234567890.123456' },
      }),
      getReactions: async () => ({
        ok: true,
        value: [{ name: '+1', count: 1, users: ['U123'] }],
      }),
      postThreadMessage: async () => ({
        ok: true,
        value: { channel: 'C123', timestamp: '1234567890.123457' },
      }),
      getUserInfo: async () => ({
        ok: true,
        value: { id: 'U123', name: 'Test User' },
      }),
    };

    expect(typeof mockClient.postMessage).toBe('function');
    expect(typeof mockClient.getReactions).toBe('function');
    expect(typeof mockClient.postThreadMessage).toBe('function');
    expect(typeof mockClient.getUserInfo).toBe('function');
  });

  it('SlackClient.postMessage - should return message info on success', async () => {
    const mockClient: SlackClient = {
      postMessage: async () => ({
        ok: true,
        value: { channel: 'C123', timestamp: '1234567890.123456' },
      }),
      getReactions: async () => ({ ok: true, value: [] }),
      postThreadMessage: async () => ({
        ok: true,
        value: { channel: 'C123', timestamp: '1234567890.123457' },
      }),
      getUserInfo: async () => ({
        ok: true,
        value: { id: 'U123', name: 'Test User' },
      }),
    };

    const result = await mockClient.postMessage('C123', 'Test message', ['U123']);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.channel).toBe('C123');
      expect(result.value.timestamp).toBe('1234567890.123456');
    }
  });

  it('SlackClient.getReactions - should return reactions array', async () => {
    const mockClient: SlackClient = {
      postMessage: async () => ({ ok: true, value: { channel: 'C123', timestamp: '123' } }),
      getReactions: async () => ({
        ok: true,
        value: [
          { name: '+1', count: 2, users: ['U123', 'U456'] },
          { name: '-1', count: 1, users: ['U789'] },
        ],
      }),
      postThreadMessage: async () => ({
        ok: true,
        value: { channel: 'C123', timestamp: '1234567890.123457' },
      }),
      getUserInfo: async () => ({
        ok: true,
        value: { id: 'U123', name: 'Test User' },
      }),
    };

    const result = await mockClient.getReactions('C123', '1234567890.123456');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(2);
      expect(result.value[0].name).toBe('+1');
      expect(result.value[0].count).toBe(2);
      expect(result.value[1].name).toBe('-1');
    }
  });

  it('SlackClient methods - should return error result when operation fails', async () => {
    const error = new Error('Slack API error');
    const mockClient: SlackClient = {
      postMessage: async () => ({ ok: false, error }),
      getReactions: async () => ({ ok: false, error }),
      postThreadMessage: async () => ({ ok: false, error }),
      getUserInfo: async () => ({ ok: false, error }),
    };

    const postResult = await mockClient.postMessage('C123', 'Test', []);
    const getResult = await mockClient.getReactions('C123', '123');

    expect(postResult.ok).toBe(false);
    expect(getResult.ok).toBe(false);
    if (!postResult.ok) expect(postResult.error).toBe(error);
    if (!getResult.ok) expect(getResult.error).toBe(error);
  });

  it('SlackClient.postThreadMessage - should post message to thread', async () => {
    const mockClient: SlackClient = {
      postMessage: async () => ({ ok: true, value: { channel: 'C123', timestamp: '123' } }),
      getReactions: async () => ({ ok: true, value: [] }),
      postThreadMessage: async (channel, threadTs, text) => {
        expect(channel).toBe('C123');
        expect(threadTs).toBe('1234567890.123456');
        expect(text).toBe('✅ <@U123> approved the release');
        return {
          ok: true,
          value: { channel: 'C123', timestamp: '1234567890.123457' },
        };
      },
      getUserInfo: async () => ({ ok: true, value: { id: 'U123', name: 'Test User' } }),
    };

    const result = await mockClient.postThreadMessage(
      'C123',
      '1234567890.123456',
      '✅ <@U123> approved the release'
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.timestamp).toBe('1234567890.123457');
    }
  });

  it('SlackClient.getUserInfo - should return user information', async () => {
    const mockClient: SlackClient = {
      postMessage: async () => ({ ok: true, value: { channel: 'C123', timestamp: '123' } }),
      getReactions: async () => ({ ok: true, value: [] }),
      postThreadMessage: async () => ({ ok: true, value: { channel: 'C123', timestamp: '123' } }),
      getUserInfo: async (userId) => {
        expect(userId).toBe('U123');
        return {
          ok: true,
          value: { id: 'U123', name: 'Test User' },
        };
      },
    };

    const result = await mockClient.getUserInfo('U123');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.id).toBe('U123');
      expect(result.value.name).toBe('Test User');
    }
  });
});

describe('SlackWebClient', () => {
  it('SlackWebClient.postMessage - when valid data - returns success with message info', async () => {
    const mockApi: SlackApi = {
      postMessage: vi.fn().mockResolvedValue({
        ok: true,
        channel: 'C123',
        ts: '1234567890.123456',
      }),
      getReactions: vi.fn(),
    };

    const client = new SlackWebClient(mockApi);
    const result = await client.postMessage('C123', 'Hello there!', ['U123']);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.channel).toBe('C123');
      expect(result.value.timestamp).toBe('1234567890.123456');
    }

    expect(mockApi.postMessage).toHaveBeenCalledWith({
      channel: 'C123',
      text: '<@U123> Hello there!',
    });
  });

  it('SlackWebClient.getReactions - when reactions exist - returns success with reactions', async () => {
    const mockApi: SlackApi = {
      postMessage: vi.fn(),
      getReactions: vi.fn().mockResolvedValue({
        ok: true,
        message: {
          reactions: [
            { name: '+1', count: 2, users: ['U123', 'U456'] },
            { name: '-1', count: 1, users: ['U789'] },
          ],
        },
      }),
    };

    const client = new SlackWebClient(mockApi);
    const result = await client.getReactions('C123', '1234567890.123456');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(2);
      expect(result.value[0].name).toBe('+1');
      expect(result.value[1].count).toBe(1);
    }

    expect(mockApi.getReactions).toHaveBeenCalledWith({
      channel: 'C123',
      timestamp: '1234567890.123456',
    });
  });

  it('SlackWebClient - when API fails - returns error result', async () => {
    const apiError = new Error('API connection failed');
    const mockApi: SlackApi = {
      postMessage: vi.fn().mockRejectedValue(apiError),
      getReactions: vi.fn().mockRejectedValue(apiError),
    };

    const client = new SlackWebClient(mockApi);
    const postResult = await client.postMessage('C123', 'Test', []);
    const getResult = await client.getReactions('C123', '123');

    expect(postResult.ok).toBe(false);
    expect(getResult.ok).toBe(false);
  });

  it('SlackWebClient.postThreadMessage - when posting to thread - should include thread_ts', async () => {
    const mockApi: SlackApi = {
      postMessage: vi.fn().mockResolvedValue({
        ok: true,
        channel: 'C123',
        ts: '1234567890.123457',
      }),
      getReactions: vi.fn(),
      postThreadMessage: vi.fn().mockResolvedValue({
        ok: true,
        channel: 'C123',
        ts: '1234567890.123457',
      }),
      getUserInfo: vi.fn().mockResolvedValue({
        ok: true,
        user: {
          id: 'U123',
          name: 'Test User',
        },
      }),
    };

    const client = new SlackWebClient(mockApi);
    const result = await client.postThreadMessage(
      'C123',
      '1234567890.123456',
      '✅ <@U123> approved the release'
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.timestamp).toBe('1234567890.123457');
    }

    expect(mockApi.postThreadMessage).toHaveBeenCalledWith({
      channel: 'C123',
      thread_ts: '1234567890.123456',
      text: '✅ <@U123> approved the release',
    });
  });

  it('SlackWebClient.getUserInfo - when fetching user info - should return user details', async () => {
    const mockApi: SlackApi = {
      postMessage: vi.fn(),
      getReactions: vi.fn(),
      postThreadMessage: vi.fn(),
      getUserInfo: vi.fn().mockResolvedValue({
        ok: true,
        user: {
          id: 'U123',
          name: 'Test User',
        },
      }),
    };

    const client = new SlackWebClient(mockApi);
    const result = await client.getUserInfo('U123');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.id).toBe('U123');
      expect(result.value.name).toBe('Test User');
    }

    expect(mockApi.getUserInfo).toHaveBeenCalledWith({ user: 'U123' });
  });
});

describe('createSlackClient', () => {
  it('createSlackClient - when api provided - should use injected api', () => {
    const mockApi: SlackApi = {
      postMessage: vi.fn(),
      getReactions: vi.fn(),
    };

    const client = createSlackClient({
      api: mockApi,
      token: 'test-token',
    });

    expect(client).toBeDefined();
    expect(typeof client.postMessage).toBe('function');
    expect(typeof client.getReactions).toBe('function');
  });

  it('createSlackClient - when token provided - should create default api', () => {
    const client = createSlackClient({
      token: 'xoxb-test-token',
    });

    expect(client).toBeDefined();
    expect(typeof client.postMessage).toBe('function');
    expect(typeof client.getReactions).toBe('function');
  });

  it('createSlackClient - when neither api nor token provided - should throw error', () => {
    expect(() => {
      createSlackClient({});
    }).toThrow('Either api or token must be provided');
  });
});
