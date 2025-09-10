// Minimal notification and webhook stubs

export type TicketEvent = 'ticket.created' | 'ticket.updated' | 'ticket.commented';

export const sendTicketEmail = async (event: TicketEvent, payload: any) => {
  // TODO: integrate real email service; for now, log
  console.log(`[EMAIL] ${event}`, JSON.stringify(payload));
};

export const sendTicketWebhook = async (event: TicketEvent, payload: any) => {
  // TODO: read org-configured webhook target and POST
  console.log(`[WEBHOOK] ${event}`, JSON.stringify(payload));
};

// Outbound messaging helpers
export const sendOutboundMessage = async (
  provider: 'slack' | 'teams',
  channelOrWebhook: string,
  text: string,
  options?: any
) => {
  if (provider === 'slack') {
    const { WebClient } = await import('@slack/web-api');
    const token = options?.token || process.env.SLACK_BOT_TOKEN;
    if (!token) throw new Error('Missing Slack bot token');
    const client = new WebClient(token);
    await client.chat.postMessage({ channel: channelOrWebhook, text, mrkdwn: true, ...options });
    return;
  }
  if (provider === 'teams') {
    const fetch = (await import('node-fetch')).default as any;
    const webhookUrl = channelOrWebhook || options?.webhookUrl || process.env.TEAMS_WEBHOOK_URL;
    if (!webhookUrl) throw new Error('Missing Teams webhook URL');
    const payload = options?.payload || {
      type: 'message',
      attachments: [
        {
          contentType: 'application/vnd.microsoft.card.adaptive',
          contentUrl: null,
          content: options?.adaptiveCard || {
            type: 'AdaptiveCard',
            $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
            version: '1.4',
            body: [{ type: 'TextBlock', text, wrap: true }]
          }
        }
      ]
    };
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return;
  }
  throw new Error(`Unsupported provider: ${provider}`);
};


