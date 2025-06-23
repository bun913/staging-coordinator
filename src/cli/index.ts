#!/usr/bin/env node

import { parseArgs } from 'node:util';
import { checkRelease, type ReleaseCheckConfig } from '../services/release-checker';
import { createSheetsClient } from '../lib/sheets';
import { createSlackClient } from '../lib/slack';
import { logger } from '../utils/logger';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { config as dotenvConfig } from 'dotenv';

interface CliConfig {
  productName: string;
  environmentName: string;
  requesterUserId?: string;
  slackChannelId: string;
  sheetsCredentialsPath: string;
  slackToken: string;
  spreadsheetId: string;
  sheetName?: string;
  waitMinutes?: number;
  approveReaction?: string;
  rejectReaction?: string;
  timezone?: string;
}

const parseCliArgs = (): CliConfig => {
  // Load environment variables from .env file
  dotenvConfig();

  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    options: {
      'requester-user-id': { type: 'string' },
      'slack-channel-id': { type: 'string' },
      'sheets-credentials': { type: 'string' },
      'slack-token': { type: 'string' },
      'spreadsheet-id': { type: 'string' },
      'sheet-name': { type: 'string' },
      'wait-minutes': { type: 'string' },
      'approve-reaction': { type: 'string' },
      'reject-reaction': { type: 'string' },
      timezone: { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
    allowPositionals: true,
  });

  if (values.help) {
    console.log(`
Usage: staging-coordinator <product-name> <environment-name> [options]

Arguments:
  product-name                Product name to check (e.g., my-app)
  environment-name           Environment name to check (e.g., staging)

Options:
  --requester-user-id        Slack user ID of the requester (optional, for self-approval prevention)
                             Environment: REQUESTER_USER_ID
  --slack-channel-id         Slack channel ID to post messages
                             Environment: SLACK_CHANNEL_ID
  --sheets-credentials       Path to Google Sheets service account JSON
                             Environment: SHEETS_CREDENTIALS_PATH
  --slack-token             Slack bot token
                             Environment: SLACK_TOKEN
  --spreadsheet-id          Google Sheets spreadsheet ID
                             Environment: SPREADSHEET_ID
  --sheet-name              Sheet name (default: シート1)
                             Environment: SHEET_NAME
  --wait-minutes            Wait time in minutes (default: 20)
                             Environment: WAIT_MINUTES
  --approve-reaction        Approval reaction emoji (default: ok)
                             Environment: APPROVE_REACTION
  --reject-reaction         Rejection reaction emoji (default: -1)
                             Environment: REJECT_REACTION
  --timezone                Timezone (default: Asia/Tokyo)
                             Environment: TIMEZONE
  -h, --help                Show this help message

Note: All options can be set via environment variables or .env file.
`);
    process.exit(0);
  }

  if (positionals.length < 2) {
    console.error('Error: Product name and environment name are required');
    console.error('Usage: staging-coordinator <product-name> <environment-name>');
    process.exit(1);
  }

  const [productName, environmentName] = positionals;

  // Required options with environment variable fallback
  const slackChannelId = values['slack-channel-id'] || process.env.SLACK_CHANNEL_ID;
  const sheetsCredentialsPath =
    values['sheets-credentials'] ||
    process.env.SHEETS_CREDENTIALS_PATH ||
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const slackToken =
    values['slack-token'] || process.env.SLACK_TOKEN || process.env.SLACK_BOT_TOKEN;
  const spreadsheetId =
    values['spreadsheet-id'] || process.env.SPREADSHEET_ID || process.env.GOOGLE_SPREADSHEET_ID;

  if (!slackChannelId || !sheetsCredentialsPath || !slackToken || !spreadsheetId) {
    console.error('Error: Missing required options');
    console.error(
      'Required: --slack-channel-id (or SLACK_CHANNEL_ID), --sheets-credentials (or SHEETS_CREDENTIALS_PATH/GOOGLE_SERVICE_ACCOUNT_JSON), --slack-token (or SLACK_TOKEN/SLACK_BOT_TOKEN), --spreadsheet-id (or SPREADSHEET_ID/GOOGLE_SPREADSHEET_ID)'
    );
    process.exit(1);
  }

  // Optional requester user ID
  const requesterUserId = values['requester-user-id'] || process.env.REQUESTER_USER_ID;

  return {
    productName,
    environmentName,
    requesterUserId,
    slackChannelId: slackChannelId as string,
    sheetsCredentialsPath: sheetsCredentialsPath as string,
    slackToken: slackToken as string,
    spreadsheetId: spreadsheetId as string,
    sheetName:
      values['sheet-name'] || process.env.SHEET_NAME || process.env.GOOGLE_SHEET_NAME || 'シート1',
    waitMinutes: values['wait-minutes']
      ? Number.parseInt(values['wait-minutes'])
      : process.env.WAIT_MINUTES
        ? Number.parseInt(process.env.WAIT_MINUTES)
        : 20,
    approveReaction: values['approve-reaction'] || process.env.APPROVE_REACTION || 'ok',
    rejectReaction: values['reject-reaction'] || process.env.REJECT_REACTION || '-1',
    timezone: values.timezone || process.env.TIMEZONE || 'Asia/Tokyo',
  };
};

const loadCredentials = (credentialsPath: string): object => {
  // Check if it's a JSON string directly (from environment variable)
  if (credentialsPath.startsWith('{')) {
    try {
      return JSON.parse(credentialsPath);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Error parsing credentials JSON: ${message}`);
      process.exit(1);
    }
  }

  // Otherwise, treat as file path
  try {
    const fullPath = resolve(credentialsPath);
    const credentialsContent = readFileSync(fullPath, 'utf-8');
    return JSON.parse(credentialsContent);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Error loading credentials from ${credentialsPath}: ${message}`);
    process.exit(1);
  }
};

const main = async (): Promise<void> => {
  try {
    const config = parseCliArgs();

    logger.info('Starting staging coordinator', {
      productName: config.productName,
      environmentName: config.environmentName,
      requesterUserId: config.requesterUserId,
    });

    // Load credentials
    const sheetsCredentials = loadCredentials(config.sheetsCredentialsPath);

    // Create services
    const sheetsClient = createSheetsClient({
      credentials: sheetsCredentials,
      spreadsheetId: config.spreadsheetId,
      sheetName: config.sheetName,
    });

    const slackClient = createSlackClient({
      token: config.slackToken,
    });

    // Prepare release check config
    const releaseConfig: ReleaseCheckConfig = {
      productName: config.productName,
      environmentName: config.environmentName,
      requesterUserId: config.requesterUserId,
      waitMinutes: config.waitMinutes,
      approveReaction: config.approveReaction,
      rejectReaction: config.rejectReaction,
      timezone: config.timezone,
    };

    // Execute release check
    const result = await checkRelease(
      releaseConfig,
      { sheets: sheetsClient, slack: slackClient },
      config.slackChannelId
    );

    if (!result.ok) {
      console.error(`Release check failed: ${result.error.message}`);
      process.exit(1);
    }

    // Display result
    const { status, message, approvers, schedules } = result.value;

    console.log('\n=== Release Check Result ===');
    console.log(`Status: ${status.toUpperCase()}`);
    console.log(`Message: ${message}`);

    if (approvers && approvers.length > 0) {
      console.log(`Approvers: ${approvers.join(', ')}`);
    }

    if (schedules && schedules.length > 0) {
      console.log('\nActive Schedules:');
      for (const schedule of schedules) {
        console.log(
          `- ${schedule.productName} (${schedule.personInChargeName}): ${schedule.startDateTime.toISOString()} - ${schedule.endDateTime.toISOString()}`
        );
      }
    }

    // Exit with appropriate code
    const exitCode = status === 'approved' || status === 'no_schedule' ? 0 : 1;
    process.exit(exitCode);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error(`Unexpected error: ${message}`);
    logger.error('CLI execution failed', { error: message });
    process.exit(1);
  }
};

// Execute main function
main().catch((error) => {
  const message = error instanceof Error ? error.message : 'Unknown error occurred';
  console.error(`Fatal error: ${message}`);
  process.exit(1);
});
