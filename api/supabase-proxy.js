// /api/supabase-proxy.js — Server-side Supabase proxy (ESM)
// V2 FIX: PRO-only tables now require auth + tier check; unauthenticated
//         requests to paid tables return 401, not forwarded with service key.
// V5 FIX: CORS uses same ALLOWED_ORIGINS allowlist as _auth.js (not VERCEL_URL).

import { setCORSHeaders, verifyToken, getUserTier, extractToken } from './_auth.js';

const SB_URL         = process.env.VITE_SUPABASE_URL;
const SB_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

// ── Table classification ────────────────────────────────────────────────────
// Public: no auth needed
const PUBLIC_TABLES = new Set([
  'grid_regions', 'grid_frequency', 'merit_generation',
  'contingency_events', 'grid_alerts',
]);

// Free with row filter: auth optional, but rows filtered to NR+WR
const FREE_FILTERED_TABLES = new Set([
  'grid_buses', 'iex_market_data', 'transmission_lines',
]);

// Pro-only: 401 if no valid Pro/Enterprise token
const PRO_ONLY_TABLES = new Set([
  'lmp_snapshots', 'crr_positions', 'line_flow_snapshots',
]);

const ALLOWED_TABLES = new Set([
  ...PUBLIC_TABLES, ...FREE_FILTERED_TABLES, ...PRO_ONLY_TABLES,
]);

export default async function handler(req, res) {
  // V5 FIX: use shared setCORSHeaders (allowlist pattern, not VERCEL_URL)
  setCORSHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET')    return res.status(405).json({ error: 'Method not allowed' });
  if (!SB_URL || !SB_SERVICE_KEY) return res.status(503).json({ error: 'DB not configured' });

  const { table, filter } = req.query;
  if (!table || !ALLOWED_TABLES.has(table)) {
    return res.status(400).json({ error: 'Invalid or missing table' });
  }

  const isPublic      = PUBLIC_TABLES.has(table);
  const isFreeFiltered = FREE_FILTERED_TABLES.has(table);
  const isProOnly     = PRO_ONLY_TABLES.has(table);

  let userTier = 'free';
  let userId   = null;

  // Resolve auth for any non-public table
  if (!isPublic) {
    const token = extractToken(req);
    if (token) {
      const user = await verifyToken(token);
      if (user?.id) {
        userId   = user.id;
        userTier = await getUserTier(user.id);
      }
    }

    // V2 FIX: PRO-only tables require authenticated Pro/Enterprise user
    if (isProOnly && !['pro', 'enterprise'].includes(userTier)) {
      return res.status(401).json({
        error:   'Authentication required for this data',
        code:    'PRO_REQUIRED',
        upgrade: 'https://gridintelin.vercel.app/?upgrade=1',
      });
    }
  }

  const isPro = ['pro', 'enterprise'].includes(userTier);

  // Build query string — apply free-tier row filters defence-in-depth
  let qs = filter ? decodeURIComponent(filter) : '';

  if (!isPro && isFreeFiltered) {
    if (table === 'grid_buses') {
      qs += (qs ? '&' : '') + 'region_id=in.(NR,WR)';
    }
    if (table === 'iex_market_data') {
      qs += (qs ? '&' : '') + 'area=in.(Northern Region,Western Region)';
    }
    if (table === 'transmission_lines') {
      // Only 400kV+ lines in NR/WR — join not possible in REST; filter voltage
      qs += (qs ? '&' : '') + 'voltage_kv=gte.400';
    }
  }

  const upstreamURL = `${SB_URL}/rest/v1/${table}${qs ? '?' + qs : ''}`;

  try {
    const upstream = await fetch(upstreamURL, {
      headers: {
        apikey:        SB_SERVICE_KEY,
        Authorization: `Bearer ${SB_SERVICE_KEY}`,
        Accept:        'application/json',
      },
      signal: AbortSignal.timeout(8000),
    });

    const data = await upstream.json();

    res.setHeader('Cache-Control', isPublic
      ? 's-maxage=60, stale-while-revalidate=30'
      : 'private, no-store');

    return res.status(upstream.status).json(data);
  } catch (err) {
    return res.status(502).json({ error: 'Upstream DB error', detail: err.message });
  }
}
