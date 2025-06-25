import type { Result } from '../utils/result';
import { ok, err } from '../utils/result';
import type { Schedule } from '../lib/types';
import type { SheetsClient } from '../lib/sheets';
import type { SlackClient, MessageInfo } from '../lib/slack';
import { getCurrentDateTime, findActiveSchedules } from '../utils/date';
import { NetworkError } from '../utils/errors';
import { logger } from '../utils/logger';

export interface ReleaseCheckConfig {
  productName: string;
  environmentName: string;
  requesterUserId?: string;
  waitMinutes?: number;
  approveReaction?: string;
  rejectReaction?: string;
  timezone?: string;
}

export interface ReleaseCheckResult {
  status: 'approved' | 'rejected' | 'timeout' | 'no_schedule';
  message: string;
  approvers?: string[];
  schedules?: Schedule[];
}

export interface Services {
  sheets: SheetsClient;
  slack: SlackClient;
}

export interface ApprovalResult {
  status: 'approved' | 'rejected' | 'timeout';
  approvers?: string[];
}

/**
 * Find schedules relevant to the release request
 */
export const findRelevantSchedules = (
  schedules: Schedule[],
  productName: string,
  environmentName: string,
  currentTime: Date
): Schedule[] => {
  // Filter by product and environment first
  const relevantSchedules = schedules.filter(
    (schedule) =>
      schedule.productName === productName && schedule.environmentName === environmentName
  );

  // Then filter by current time
  return findActiveSchedules(relevantSchedules, currentTime);
};

/**
 * Request approval via Slack message
 */
export const requestApproval = async (
  schedules: Schedule[],
  config: ReleaseCheckConfig,
  slack: SlackClient,
  channelId: string
): Promise<Result<MessageInfo>> => {
  // Extract unique person IDs from schedules
  const personIds = [...new Set(schedules.map((s) => s.personInChargeId))];

  // Create approval message
  const scheduleList = schedules
    .map((s) => `• ${s.productName} (${s.personInChargeName})`)
    .join('\n');

  const requesterLine = config.requesterUserId
    ? `👤 *Requested by:* <@${config.requesterUserId}>\n`
    : '';

  const message = `🚀 *Release Request*

📦 *Product:* ${config.productName}
🌍 *Environment:* ${config.environmentName}
${requesterLine}
📅 *Active Schedules:*
${scheduleList}

━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ React with :${config.approveReaction || 'ok'}: to *approve*
❌ React with :${config.rejectReaction || '-1'}: to *reject*
⏰ Timeout: ${config.waitMinutes || 20} minutes`;

  logger.info('Requesting approval via Slack', {
    productName: config.productName,
    environmentName: config.environmentName,
    scheduleCount: schedules.length,
    personIds,
  });

  return await slack.postMessage(channelId, message, personIds);
};

/**
 * Wait for approval/rejection reactions
 */
export const waitForApproval = async (
  slack: SlackClient,
  channelId: string,
  messageTimestamp: string,
  excludeUserIds: string[],
  approveReaction: string,
  rejectReaction: string,
  waitMinutes: number,
  pollIntervalMs: number = 15 * 1000 // 15 seconds, but can be overridden for testing
): Promise<ApprovalResult> => {
  const timeoutMs = waitMinutes * 60 * 1000;
  const startTime = Date.now();

  logger.info('Starting approval polling', {
    waitMinutes,
    approveReaction,
    rejectReaction,
    excludeUserIds,
  });

  while (Date.now() - startTime < timeoutMs) {
    const reactionsResult = await slack.getReactions(channelId, messageTimestamp);

    if (!reactionsResult.ok) {
      logger.warn('Failed to get reactions, continuing polling', {
        error: reactionsResult.error.message,
      });
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
      continue;
    }

    const reactions = reactionsResult.value;

    // Check for rejections first (higher priority)
    const rejections = reactions.filter((r) => r.name === rejectReaction);
    if (rejections.length > 0) {
      const rejectors = rejections
        .flatMap((r) => r.users)
        .filter((userId) => !excludeUserIds.includes(userId));

      if (rejectors.length > 0) {
        logger.info('Release rejected', { rejectors });

        // Post thread message with rejector info
        const firstRejector = rejectors[0];
        const userInfoResult = await slack.getUserInfo(firstRejector);
        const userName = userInfoResult.ok ? userInfoResult.value.name : 'Unknown User';

        await slack.postThreadMessage(
          channelId,
          messageTimestamp,
          `❌ <@${firstRejector}> (${userName}) が拒否しました`
        );

        return { status: 'rejected', approvers: rejectors };
      }
    }

    // Check for approvals
    const approvals = reactions.filter((r) => r.name === approveReaction);
    if (approvals.length > 0) {
      const approvers = approvals
        .flatMap((r) => r.users)
        .filter((userId) => !excludeUserIds.includes(userId));

      if (approvers.length > 0) {
        logger.info('Release approved', { approvers });

        // Post thread message with approver info
        const firstApprover = approvers[0];
        const userInfoResult = await slack.getUserInfo(firstApprover);
        const userName = userInfoResult.ok ? userInfoResult.value.name : 'Unknown User';

        await slack.postThreadMessage(
          channelId,
          messageTimestamp,
          `✅ <@${firstApprover}> (${userName}) が承認しました`
        );

        return { status: 'approved', approvers };
      }
    }

    // Wait before next poll
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  logger.info('Approval polling timed out');
  return { status: 'timeout' };
};

/**
 * Main release check function
 */
export const checkRelease = async (
  config: ReleaseCheckConfig,
  services: Services,
  channelId: string
): Promise<Result<ReleaseCheckResult>> => {
  const timezone = config.timezone || 'Asia/Tokyo';
  const waitMinutes = config.waitMinutes || 20;
  const approveReaction = config.approveReaction || 'ok';
  const rejectReaction = config.rejectReaction || '-1';

  logger.info('Starting release check', {
    productName: config.productName,
    environmentName: config.environmentName,
    requesterUserId: config.requesterUserId,
    timezone,
  });

  try {
    // Get current time
    const currentTimeResult = getCurrentDateTime(timezone);
    if (!currentTimeResult.ok) {
      return err(currentTimeResult.error);
    }
    const currentTime = currentTimeResult.value;

    // Fetch schedules from Google Sheets
    const schedulesResult = await services.sheets.fetchSchedules();
    if (!schedulesResult.ok) {
      // On sheets error, notify and proceed (availability-first)
      logger.error('Failed to fetch schedules, proceeding with release', {
        error: schedulesResult.error.message,
      });

      await services.slack.postMessage(
        channelId,
        `⚠️ Error occurred while checking schedules: ${schedulesResult.error.message}\nProceeding with release for availability.`,
        []
      );

      return ok({
        status: 'approved',
        message: 'Release approved - proceeding due to error (availability-first policy)',
      });
    }

    // Find relevant schedules
    const relevantSchedules = findRelevantSchedules(
      schedulesResult.value,
      config.productName,
      config.environmentName,
      currentTime
    );

    // If no relevant schedules, approve immediately
    if (relevantSchedules.length === 0) {
      logger.info('No active schedules found for product and environment', {
        productName: config.productName,
        environmentName: config.environmentName,
        totalSchedules: schedulesResult.value.length,
      });

      return ok({
        status: 'no_schedule',
        message: `No active schedules found for ${config.productName} in ${config.environmentName} environment. Release approved.`,
        schedules: [],
      });
    }

    // Request approval via Slack
    const messageResult = await requestApproval(
      relevantSchedules,
      config,
      services.slack,
      channelId
    );
    if (!messageResult.ok) {
      return err(
        new NetworkError('Failed to post approval request to Slack', {
          cause: messageResult.error,
        })
      );
    }

    // Wait for approval
    const excludeUserIds = config.requesterUserId ? [config.requesterUserId] : [];
    const approvalResult = await waitForApproval(
      services.slack,
      channelId,
      messageResult.value.timestamp,
      excludeUserIds, // Exclude requester from voting (if provided)
      approveReaction,
      rejectReaction,
      waitMinutes
    );

    const resultMessage = {
      approved: `Release approved by: ${approvalResult.approvers?.join(', ') || 'unknown'}`,
      rejected: `Release rejected by: ${approvalResult.approvers?.join(', ') || 'unknown'}`,
      timeout: `Release request timed out after ${waitMinutes} minutes. No response received.`,
    };

    return ok({
      status: approvalResult.status,
      message: resultMessage[approvalResult.status],
      approvers: approvalResult.approvers,
      schedules: relevantSchedules,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    logger.error('Unexpected error in release check', { error: message });
    return err(new Error(`Release check failed: ${message}`));
  }
};
