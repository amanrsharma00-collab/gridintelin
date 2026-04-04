// /api/admin-export.js — Export auth events as CSV or JSON (ESM)
// Protected: requires x-admin-key header matching ADMIN_SECRET env var
// Access: GET /api/admin-export?format=csv&days=30

const SB_URL         = process.env.VITE_SUPABASE_URL;
const SB_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const ADMIN_SECRET   = process.env.ADMIN_SECRET; // set in Vercel env vars

function toCSV(rows) {
  if (!rows.length) return 'id,event_type,email,success,user_id,ip_address,error_message,created_at\n';
  const headers = ['id','event_type','email','success','user_id','ip_address','error_message','created_at'];
  const escape  = v => v == null ? '' : `"${String(v).replace(/"/g,'""')}"`;
  return [
    headers.join(','),
    ...rows.map(r => headers.map(h => escape(r[h])).join(',')),
  ].join('\n');
}

export default async function handler(req, res) {
  // CORS: admin only — no browser CORS needed (curl / server-to-server)
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  // Auth: check admin key
  const key = req.headers['x-admin-key'] ?? req.query?.key;
  if (!ADMIN_SECRET || key !== ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!SB_URL || !SB_SERVICE_KEY) {
    return res.status(503).json({ error: 'DB not configured' });
  }

  const days   = Math.min(parseInt(req.query?.days  ?? '30', 10), 365);
  const format = (req.query?.format ?? 'json').toLowerCase();
  const limit  = Math.min(parseInt(req.query?.limit ?? '5000', 10), 10000);
  const type   = req.query?.type ?? ''; // filter by event_type

  let qs = `order=created_at.desc&limit=${limit}&created_at=gte.${new Date(Date.now() - days * 86400000).toISOString()}`;
  if (type) qs += `&event_type=eq.${encodeURIComponent(type)}`;

  try {
    const upstream = await fetch(
      `${SB_URL}/rest/v1/auth_events?${qs}`,
      {
        headers: {
          apikey:        SB_SERVICE_KEY,
          Authorization: `Bearer ${SB_SERVICE_KEY}`,
          Accept:        'application/json',
        },
      }
    );

    if (!upstream.ok) throw new Error(`DB ${upstream.status}`);
    const rows = await upstream.json();

    if (format === 'csv') {
      const today = new Date().toISOString().slice(0, 10);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="gridintelin-logins-${today}.csv"`);
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).send(toCSV(rows));
    }

    // Summary stats
    const stats = {
      total:      rows.length,
      success:    rows.filter(r => r.success).length,
      failed:     rows.filter(r => !r.success).length,
      sign_ups:   rows.filter(r => r.event_type === 'sign_up').length,
      google:     rows.filter(r => r.event_type === 'google_oauth').length,
      unique_ips: new Set(rows.map(r => r.ip_address).filter(Boolean)).size,
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ ok: true, period_days: days, stats, rows });
  } catch (err) {
    return res.status(500).json({ error: 'Export failed', detail: err.message });
  }
}
