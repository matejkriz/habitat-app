/**
 * Slack Notification Service for Habitat
 * Sends notifications to #omluvenky channel when new excuses are submitted
 */

export interface ExcuseNotificationData {
  childName: string;
  parentName: string;
  fromDate: Date;
  toDate: Date;
  reason: string | null;
  isOnTime: boolean; // true = "včas", false = "pozdní"
  automaticallyApproved?: boolean;
}

/**
 * Format a date to Czech locale format (d.M.yyyy)
 */
function formatDateCzech(date: Date): string {
  return date.toLocaleDateString("cs-CZ", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  });
}

/**
 * Build Slack message blocks for excuse notification
 */
function buildExcuseMessage(data: ExcuseNotificationData) {
  const {
    childName,
    parentName,
    fromDate,
    toDate,
    reason,
    isOnTime,
    automaticallyApproved,
  } = data;

  const statusEmoji = isOnTime || automaticallyApproved ? "✅" : "⚠️";
  const statusText = automaticallyApproved
    ? "automaticky schválená (bez obědů)"
    : isOnTime
      ? "včas"
      : "pozdní";

  const fromDateStr = formatDateCzech(fromDate);
  const toDateStr = formatDateCzech(toDate);
  const dateRange =
    fromDateStr === toDateStr ? fromDateStr : `${fromDateStr} – ${toDateStr}`;

  const blocks = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: "📝 Nová omluvenka",
        emoji: true,
      },
    },
    {
      type: "section",
      fields: [
        {
          type: "mrkdwn",
          text: `*Dítě:*\n${childName}`,
        },
        {
          type: "mrkdwn",
          text: `*Rodič:*\n${parentName}`,
        },
        {
          type: "mrkdwn",
          text: `*Období:*\n${dateRange}`,
        },
        {
          type: "mrkdwn",
          text: `*Stav:*\n${statusEmoji} ${statusText}`,
        },
      ],
    },
  ];

  // Add reason section if provided
  if (reason && reason.trim()) {
    blocks.push({
      type: "section",
      fields: [
        {
          type: "mrkdwn",
          text: `*Důvod:*\n${reason}`,
        },
      ],
    });
  }

  // Simple text fallback for notifications
  const text = `Nová omluvenka: ${childName} (${dateRange}) - ${statusText}`;

  return { blocks, text };
}

/**
 * Send excuse notification to Slack #omluvenky channel
 * Uses Incoming Webhook URL configured in environment
 */
export async function sendExcuseNotification(
  data: ExcuseNotificationData
): Promise<boolean> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;

  if (!webhookUrl) {
    console.warn(
      "SLACK_WEBHOOK_URL not configured - skipping Slack notification"
    );
    return false;
  }

  try {
    const message = buildExcuseMessage(data);

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Slack notification failed: ${response.status} - ${errorText}`);
      return false;
    }

    console.log("Slack notification sent successfully");
    return true;
  } catch (error) {
    console.error("Failed to send Slack notification:", error);
    return false;
  }
}
