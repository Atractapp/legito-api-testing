/**
 * Slack Notifier for SSO Test Results
 */

interface SlackNotificationPayload {
  serverId: string;
  serverName: string;
  status: 'success' | 'failure';
  durationMs: number;
  timestamp: Date;
  errorMessage?: string;
}

/**
 * Send SSO test result notification to Slack
 */
export async function sendSlackNotification(
  payload: SlackNotificationPayload
): Promise<boolean> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;

  if (!webhookUrl) {
    console.warn('[Slack] No webhook URL configured, skipping notification');
    return false;
  }

  const isSuccess = payload.status === 'success';
  const emoji = isSuccess ? ':white_check_mark:' : ':x:';
  const statusText = isSuccess ? 'PASSED' : 'FAILED';
  const durationSeconds = (payload.durationMs / 1000).toFixed(1);
  const timestamp = payload.timestamp.toISOString().replace('T', ' ').slice(0, 19);

  let message = `${emoji} SSO Test ${statusText}: ${payload.serverName}\n`;
  message += `Server: ${payload.serverName} | Duration: ${durationSeconds}s | Time: ${timestamp}`;

  if (payload.errorMessage && !isSuccess) {
    message += `\nError: ${payload.errorMessage}`;
  }

  const slackPayload = {
    text: message,
    username: 'SSO Test Bot',
    icon_emoji: isSuccess ? ':shield:' : ':warning:',
  };

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(slackPayload),
    });

    if (!response.ok) {
      console.error('[Slack] Failed to send notification:', response.status, response.statusText);
      return false;
    }

    console.log(`[Slack] Notification sent for ${payload.serverName}: ${statusText}`);
    return true;
  } catch (error) {
    console.error('[Slack] Error sending notification:', error);
    return false;
  }
}
