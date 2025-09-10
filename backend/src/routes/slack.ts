import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import pool from '../database/config';

const router = Router();

const getRawBody = (req: Request): Buffer => {
  // @ts-ignore - body-parser.raw places buffer on req.body
  if (Buffer.isBuffer(req.body)) return req.body as unknown as Buffer;
  // Fallback if not raw
  return Buffer.from(typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {}));
};

const verifySlackSignature = (req: Request): boolean => {
  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  if (!signingSecret) return false;
  const timestamp = req.headers['x-slack-request-timestamp'] as string;
  const signature = req.headers['x-slack-signature'] as string;
  if (!timestamp || !signature) return false;
  // Prevent replay (5 minutes)
  const fiveMinutes = 60 * 5;
  const tsNum = parseInt(timestamp, 10);
  if (isFinite(tsNum)) {
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - tsNum) > fiveMinutes) return false;
  }
  const raw = getRawBody(req);
  const basestring = `v0:${timestamp}:${raw.toString('utf8')}`;
  const hmac = crypto.createHmac('sha256', signingSecret).update(basestring).digest('hex');
  const expected = `v0=${hmac}`;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
};

// Events endpoint (URL verification + event callbacks)
router.post('/events', async (req: Request, res: Response) => {
  try {
    if (!verifySlackSignature(req)) {
      return res.status(401).send('Invalid signature');
    }
    const raw = getRawBody(req).toString('utf8');
    const payload = JSON.parse(raw);
    if (payload.type === 'url_verification') {
      return res.status(200).send(payload.challenge);
    }
    if (payload.type === 'event_callback') {
      const event = payload.event || {};
      const organizationId =  payload.team_id ? null : null; // Unknown mapping here
      try {
        await pool.execute(
          'INSERT INTO integration_events (organization_id, provider, event_type, payload) VALUES (?, ?, ?, ?)',
          [organizationId, 'slack', event.type || 'unknown', JSON.stringify(payload)]
        );
      } catch {}
      // Acknowledge quickly
      return res.status(200).send('OK');
    }
    return res.status(200).send('OK');
  } catch (e) {
    return res.status(500).send('Server error');
  }
});

// Slash commands endpoint (application/x-www-form-urlencoded)
router.post('/commands', async (req: Request, res: Response) => {
  try {
    if (!verifySlackSignature(req)) {
      return res.status(401).send('Invalid signature');
    }
    const raw = getRawBody(req).toString('utf8');
    const params = new URLSearchParams(raw);
    const command = params.get('command');
    const text = params.get('text');
    const channelId = params.get('channel_id');
    // TODO: route command -> handlers
    console.log('Slack command:', command, text, channelId);
    return res.status(200).json({ response_type: 'ephemeral', text: `Received ${command} ${text || ''}`.trim() });
  } catch (e) {
    return res.status(500).send('Server error');
  }
});

// OAuth start: redirect to Slack
router.get('/oauth/start', (req: Request, res: Response) => {
  const clientId = process.env.SLACK_CLIENT_ID;
  const redirectUri = process.env.SLACK_OAUTH_REDIRECT_URL;
  const scopes = (process.env.SLACK_OAUTH_SCOPES || 'chat:write,commands,channels:read,groups:read').split(',').join('%2C');
  const url = `https://slack.com/oauth/v2/authorize?client_id=${encodeURIComponent(clientId || '')}&scope=${scopes}&user_scope=&redirect_uri=${encodeURIComponent(redirectUri || '')}`;
  res.redirect(url);
});

// OAuth callback: exchange code
router.get('/oauth/callback', async (req: Request, res: Response) => {
  try {
    const code = req.query.code as string;
    const clientId = process.env.SLACK_CLIENT_ID || '';
    const clientSecret = process.env.SLACK_CLIENT_SECRET || '';
    const redirectUri = process.env.SLACK_OAUTH_REDIRECT_URL || '';
    if (!code || !clientId || !clientSecret) return res.status(400).send('Missing OAuth config');
    const fetch = (await import('node-fetch')).default as any;
    const tokenRes = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri }).toString()
    });
    const data = await tokenRes.json();
    if (!data.ok) {
      return res.status(400).json(data);
    }
    // Persist connection (org association TBD)
    try {
      await pool.execute(
        `INSERT INTO integration_connections (organization_id, provider, access_token, refresh_token, settings)
         VALUES (?, 'slack', ?, NULL, ?) ON DUPLICATE KEY UPDATE access_token = VALUES(access_token), settings = VALUES(settings), updated_at = CURRENT_TIMESTAMP`,
        [null, data.access_token || data.bot_token || null, JSON.stringify(data)]
      );
    } catch {}
    res.send('Slack connected. You can close this window.');
  } catch (e) {
    res.status(500).send('OAuth error');
  }
});

export default router;


