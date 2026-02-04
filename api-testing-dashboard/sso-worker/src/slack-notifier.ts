/**
 * Slack Notification Helper for SSO Worker
 */

export interface SlackNotification {
  serverId: string;
  serverName: string;
  status: 'success' | 'failure';
  durationMs: number;
  timestamp: Date;
  errorMessage?: string;
}

/**
 * Send a Slack notification for SSO test result
 */
export async function sendSlackNotification(
  notification: SlackNotification
): Promise<boolean> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;

  if (!webhookUrl) {
    console.warn('[Slack] No webhook URL configured, skipping notification');
    return false;
  }

  const isSuccess = notification.status === 'success';
  const emoji = isSuccess ? ':white_check_mark:' : ':x:';
  const statusText = isSuccess ? 'PASSED' : 'FAILED';
  const durationSec = (notification.durationMs / 1000).toFixed(1);
  const timestamp = notification.timestamp.toISOString().replace('T', ' ').split('.')[0];

  let text = `${emoji} SSO Test ${statusText}: ${notification.serverName}\n`;
  text += `Server: ${notification.serverName} | Duration: ${durationSec}s | Time: ${timestamp}`;

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
