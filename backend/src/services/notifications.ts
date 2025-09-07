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


