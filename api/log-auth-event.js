// /api/log-auth-event.js — Receives auth events from client, logs to Supabase (ESM)
// Called by AuthModal after every sign-in attempt (success or failure)

import { setCORSHeaders, logAuthEvent } from './_auth.js';

export default async function handler(req, res) {
  setCORSHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

    const event = {
      event_type:    body.event_type   ?? 'sign_in',
      email:         body.email        ?? null,
      success:       Boolean(body.success),
      user_id:       body.user_id      ?? null,
      error_message: body.error        ?? null,
      user_agent:    req.headers['user-agent'] ?? null,
      ip_address:    (req.headers['x-forwarded-for'] ?? req.socket?.remoteAddress ?? null)
                       ?.split(',')[0].trim() ?? null,
      metadata: {
        provider: body.provider ?? 'email',
        origin:   req.headers['origin'] ?? null,
      },
    };

    // Validate event_type
    const VALID_TYPES = ['sign_in','sign_up','sign_out','failed_sign_in','google_oauth','password_reset'];
    if (!VALID_TYPES.includes(event.event_type)) {
      return res.status(400).json({ error: 'Invalid event_type' });
    }

    logAuthEvent(event);

    return res.status(200).json({ ok: true });
  } catch {
    return res.status(400).json({ error: 'Invalid request body' });
  }
}
