// api/_auth.js — Shared auth middleware for paid API routes (ESM)
// Usage: import { requireAuth, requirePro } from './_auth.js'

const SB_URL         = process.env.VITE_SUPABASE_URL;
const SB_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const ALLOWED_ORIGINS = new Set([
  'https://gridintelin.vercel.app',
  'https://gridintelin-git-main-amanrsharma00-4036s-projects.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
]);

/** Verify JWT with Supabase and return user object (or null) */
export async function verifyToken(token) {
  if (!token || !SB_URL || !SB_SERVICE_KEY) return null;
  try {
    const res = await fetch(`${SB_URL}/auth/v1/user`, {
      headers: {
        apikey:        SB_SERVICE_KEY,
        Authorization: `Bearer ${token}`,
      },
      signal: AbortSignal.timeout(4000),
    });
    return res.ok ? res.json() : null;
  } catch {
    return null;
  }
}

/** Get user's tier from user_tiers table */
export async function getUserTier(userId) {
  if (!userId || !SB_URL || !SB_SERVICE_KEY) return 'free';
  try {
    const res = await fetch(
      `${SB_URL}/rest/v1/user_tiers?user_id=eq.${userId}&select=tier,expires_at&limit=1`,
      {
        headers: {
          apikey:        SB_SERVICE_KEY,
          Authorization: `Bearer ${SB_SERVICE_KEY}`,
        },
      }
    );
    if (!res.ok) return 'free';
    const rows = await res.json();
    const row  = rows?.[0];
    if (!row) return 'free';
    // Check expiry
    if (row.expires_at && new Date(row.expires_at) < new Date()) return 'free';
    return row.tier ?? 'free';
  } catch {
    return 'free';
  }
}

/** Extract Bearer token from request */
export function extractToken(req) {
  const auth = req.headers['authorization'] ?? req.headers['Authorization'] ?? '';
  return auth.replace(/^Bearer\s+/i, '').trim() || null;
}

/** Set CORS headers — restrict to known origins */
export function setCORSHeaders(req, res) {
  const origin = req.headers['origin'];
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  } else if (!origin) {
    // Same-origin request — no CORS header needed
  } else {
    // Unknown origin — block
    res.setHeader('Access-Control-Allow-Origin', 'https://gridintelin.vercel.app');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
}

/**
 * Middleware: require authenticated user.
 * Returns { user, tier } on success, or sends 401 and returns null.
 */
export async function requireAuth(req, res) {
  setCORSHeaders(req, res);
  if (req.method === 'OPTIONS') { res.status(204).end(); return null; }

  const token = extractToken(req);
  const user  = await verifyToken(token);

  if (!user?.id) {
    res.status(401).json({ error: 'Authentication required', code: 'AUTH_REQUIRED' });
    return null;
  }

  const tier = await getUserTier(user.id);
  return { user, tier };
}

/**
 * Middleware: require Pro or Enterprise tier.
 * Returns { user, tier } on success, or sends 403 and returns null.
 */
export async function requirePro(req, res) {
  const auth = await requireAuth(req, res);
  if (!auth) return null; // 401 already sent

  if (!['pro', 'enterprise'].includes(auth.tier)) {
    res.status(403).json({
      error:   'Pro subscription required',
      code:    'TIER_INSUFFICIENT',
      upgrade: 'https://gridintelin.vercel.app/?upgrade=1',
    });
    return null;
  }

  return auth;
}

/** Log auth event to Supabase (fire-and-forget) */
export function logAuthEvent(eventData) {
  if (!SB_URL || !SB_SERVICE_KEY) return;
  fetch(`${SB_URL}/rest/v1/auth_events`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey:          SB_SERVICE_KEY,
      Authorization:   `Bearer ${SB_SERVICE_KEY}`,
      Prefer:          'return=minimal',
    },
    body: JSON.stringify({
      ...eventData,
      created_at: new Date().toISOString(),
    }),
  }).catch(() => {}); // fire-and-forget
}
