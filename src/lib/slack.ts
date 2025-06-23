import type { Result } from '../utils/result';
import { ok, err } from '../utils/result';
import { WebClient } from '@slack/web-api';

export interface MessageInfo {
  channel: string;
  timestamp: string;
}

export interface Reaction {
  name: string;
  count: number;
  users: string[];
}

export interface SlackClient {
  postMessage(channel: string, text: string, mentions: string[]): Promise<Result<MessageInfo>>;
  getReactions(channel: string, timestamp: string): Promise<Result<Reaction[]>>;
}

// Slack API wrapper interface for dependency injection
export interface SlackApi {
  postMessage(params: { channel: string; text: string }): Promise<{
    ok: boolean;
    channel?: string;
    ts?: string;
    error?: string;
  }>;
  getReactions(params: { channel: string; timestamp: string }): Promise<{
    ok: boolean;
    message?: {
      reactions?: Array<{
        name: string;
        count: number;
        users: string[];
      }>;
    };
    error?: string;
  }>;
}

// Default Slack API implementation
class SlackApiImpl implements SlackApi {
  private client: WebClient;

  constructor(token: string) {
    this.client = new WebClient(token);
  }

  async postMessage(params: { channel: string; text: string }) {
    const response = await this.client.chat.postMessage({
      channel: params.channel,
      text: params.text,
    });

    return {
      ok: response.ok || false,
      channel: response.channel as string,
      ts: response.ts as string,
      error: response.error,
    };
  }

  async getReactions(params: { channel: string; timestamp: string }) {
    const response = await this.client.reactions.get({
      channel: params.channel,
      timestamp: params.timestamp,
    });

    return {
      ok: response.ok || false,
      message: response.message as {
        reactions?: Array<{
          name: string;
          count: number;
          users: string[];
        }>;
      },
      error: response.error,
    };
  }
}

export class SlackWebClient implements SlackClient {
  constructor(private readonly api: SlackApi) {}

  async postMessage(
    channel: string,
    text: string,
    mentions: string[]
  ): Promise<Result<MessageInfo>> {
    try {
      // Add mentions to text if provided
      const textWithMentions =
        mentions.length > 0 ? `${mentions.map((id) => `<@${id}>`).join(' ')} ${text}` : text;

      const response = await this.api.postMessage({
        channel,
        text: textWithMentions,
      });

      if (!response.ok || !response.channel || !response.ts) {
        return err(new Error(`Failed to post message: ${response.error || 'Unknown error'}`));
      }

      return ok({
        channel: response.channel,
        timestamp: response.ts,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error occurred';
      return err(new Error(`Failed to post message to Slack: ${message}`));
    }
  }

  async getReactions(channel: string, timestamp: string): Promise<Result<Reaction[]>> {
    try {
      const response = await this.api.getReactions({ channel, timestamp });

      if (!response.ok) {
        return err(new Error(`Failed to get reactions: ${response.error || 'Unknown error'}`));
      }

      const reactions = response.message?.reactions || [];
      return ok(reactions);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error occurred';
      return err(new Error(`Failed to get reactions from Slack: ${message}`));
    }
  }
}

// Factory function for easy usage
interface SlackClientConfig {
  token?: string;
  api?: SlackApi;
}

export const createSlackClient = (config: SlackClientConfig): SlackClient => {
  if (!config.api && !config.token) {
    throw new Error('Either api or token must be provided');
  }

  const api = config.api || new SlackApiImpl(config.token as string);
  return new SlackWebClient(api);
};
