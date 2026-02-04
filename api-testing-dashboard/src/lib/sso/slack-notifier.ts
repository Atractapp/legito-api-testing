/**
 * Slack Notification Helper for SSO Testing
 */

import type { SsoSlackNotification } from '@/types/sso';
import { getServerConfig } from './config';

/**
 * Send a Slack notification for SSO test result
 */
export async function sendSsoSlackNotification(
  notification: SsoSlackNotification
): Promise<boolean> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;

  if (!webhookUrl) {
    console.warn('[Slack] No webhook URL configured, skipping notification');
    return false;
  }

  const serverConfig = getServerConfig(notification.serverId);
  const isSuccess = notification.status === 'success';
  const emoji = isSuccess ? ':white_check_mark:' : ':x:';
  const statusText = isSuccess ? 'PASSED' : 'FAILED';
  const durationSec = (notification.durationMs / 1000).toFixed(1);
  const timestamp = notification.timestamp.toISOString().replace('T', ' ').split('.')[0];

  let text = `${emoji} SSO Test ${statusText}: ${serverConfig.name}\n`;
  text += `Server: ${serverConfig.name} | Duration: ${durationSec}s | Time: ${timestamp}`;

  if (notification.errorMessage) {
    text += `\nError: ${notification.errorMessage}`;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      console.error('[Slack] Failed to send notification:', response.status);
      return false;
    }

    console.log('[Slack] Notification sent successfully');
    return true;
  } catch (error) {
    console.error('[Slack] Error sending notification:', error);
    return false;
  }
}

/**
 * Format a detailed Slack message with blocks (for richer formatting)
 */
export function formatSlackBlocks(notification: SsoSlackNotification) {
  const serverConfig = getServerConfig(notification.serverId);
  const isSuccess = notification.status === 'success';
  const emoji = isSuccess ? ':white_check_mark:' : ':x:';
  const color = isSuccess ? '#36a64f' : '#ff0000';
  const durationSec = (notification.durationMs / 1000).toFixed(1);

  const blocks = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${emoji} *SSO Test ${isSuccess ? 'PASSED' : 'FAILED'}*: ${serverConfig.name}`,
      },
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Server:*\n${serverConfig.name}`,
        },
        {
          type: 'mrkdwn',
          text: `*Duration:*\n${durationSec}s`,
        },
        {
          type: 'mrkdwn',
          text: `*URL:*\n${serverConfig.url}`,
        },
        {
          type: 'mrkdwn',
          text: `*Time:*\n<!date^${Math.floor(notification.timestamp.getTime() / 1000)}^{date_short_pretty} {time}|${notification.timestamp.toISOString()}>`,
        },
      ],
    },
  ];

  if (notification.errorMessage) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Error:*\n\`\`\`${notification.errorMessage}\`\`\``,
      },
    });
  }

  return {
    attachments: [
      {
        color,
        blocks,
      },
    ],
  };
}
