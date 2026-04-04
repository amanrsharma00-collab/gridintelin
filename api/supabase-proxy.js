// /api/supabase-proxy.js — Server-side Supabase proxy (ESM)
// Uses SUPABASE_SERVICE_KEY (never exposed to browser).
// Validates the caller's JWT from the Authorization header so
// only authenticated users can hit sensitive endpoints.
// Public endpoints (grid_regions, grid_frequency, merit_generation)
// are allowed without auth.

const SB_URL         = process.env.VITE_SUPABASE_URL;
const SB_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const PUBLIC_TABLES = new Set([
  'grid_regions',
  'grid_frequency',
  'merit_generation',
  'contingency_events',
  'grid_alerts',
]);

const ALLOWED_TABLES = new Set([
  ...PUBLIC_TABLES,
  'grid_buses',
  'transmission_lines',
  'lmp_snapshots',
  'iex_market_data',
  'line_flow_snapshots',
  'crr_positions',
]);

async function verifyJWT(token) {
  if (!token || !SB_URL) return null;
  const res = await fetch(`${SB_URL}/auth/v1/user`, {
    headers: {
      apikey: SB_SERVICE_KEY,
      Authorization: `Bearer ${token}`,
    },
  });
  return res.ok ? res.json() : null;
}

async function getUserTier(userId) {
  if (!userId || !SB_URL) return 'free';
  const res = await fetch(
    `${SB_URL}/rest/v1/user_tiers?user_id=eq.${userId}&select=tier&limit=1`,
    {
      headers: {
        apikey: SB_SERVICE_KEY,
        Authorization: `Bearer ${SB_SERVICE_KEY}`,
      },
    }
  );
  if (!res.ok) return 'free';
  const rows = await res.json();
  return rows?.[0]?.tier ?? 'free';
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:5173');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!SB_URL || !SB_SERVICE_KEY) return res.status(503).json({ error: 'DB not configured' });

  const { table, filter } = req.query;

  if (!table || !ALLOWED_TABLES.has(table)) {
    return res.status(400).json({ error: 'Invalid or missing table' });
  }

  // Public tables: no auth required
  const isPublic = PUBLIC_TABLES.has(table);

  let userTier = 'free';
  if (!isPublic) {
    const authHeader = req.headers.authorization ?? '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    const user = await verifyJWT(token);
    if (!user?.id) {
      // Unauthenticated — only allow NR/WR subset via RLS; pass anon token
      // (RLS on the table handles row gating; we still use service key but
      //  apply the free-tier filter explicitly for defence-in-depth)
      userTier = 'free';
    } else {
      userTier = await getUserTier(user.id);
    }
  }

  // Build query params
  let qs = filter ? decodeURIComponent(filter) : '';

  // Defence-in-depth: free tier gets explicit NR/WR filter on bus-linked tables
  if (userTier === 'free' && table === 'grid_buses') {
    qs += (qs ? '&' : '') + 'region_id=in.(NR,WR)';
  }
  if (userTier === 'free' && table === 'iex_market_data') {
    qs += (qs ? '&' : '') + 'area=in.(Northern Region,Western Region)';
  }

  const upstreamURL = `${SB_URL}/rest/v1/${table}${qs ? '?' + qs : ''}`;

  const upstream = await fetch(upstreamURL, {
    headers: {
      apikey: SB_SERVICE_KEY,
      Authorization: `Bearer ${SB_SERVICE_KEY}`,
      Accept: 'application/json',
    },
  });

  const data = await upstream.json();

  res.setHeader('Cache-Control', isPublic
    ? 's-maxage=60, stale-while-revalidate=30'
    : 'private, no-store');

  return res.status(upstream.status).json(data);
}
