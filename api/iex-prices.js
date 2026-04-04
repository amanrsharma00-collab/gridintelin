// Vercel Serverless — IEX India DAM Area Prices (ESM)
// V1 FIX: SR/ER/NER gated behind Pro tier — free users get NR+WR only
import { setCORSHeaders, verifyToken, getUserTier, extractToken } from './_auth.js';

const SB_URL         = process.env.VITE_SUPABASE_URL;
const SB_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

// Areas accessible without a subscription
const FREE_AREAS = new Set(['Northern Region', 'Western Region']);

async function fetchIEXPrices() {
  const res = await fetch('https://www.iexindia.com/api/areaprice', {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'GridIntelin/1.0',
      Referer: 'https://www.iexindia.com/marketdata/areaprice.aspx',
    },
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) throw new Error(`IEX ${res.status}`);
  return res.json();
}

async function getFromSupabase(isPro) {
  if (!SB_URL || !SB_SERVICE_KEY) return null;
  // Free users: only NR+WR cached rows; Pro: all
  const filter = isPro
    ? 'order=fetched_at.desc&limit=10'
    : 'order=fetched_at.desc&limit=10&area=in.(Northern Region,Western Region)';
  const res = await fetch(`${SB_URL}/rest/v1/iex_market_data?${filter}`, {
    headers: { apikey: SB_SERVICE_KEY, Authorization: `Bearer ${SB_SERVICE_KEY}` },
  });
  return res.ok ? res.json() : null;
}

function saveToSupabase(records) {
  if (!SB_URL || !SB_SERVICE_KEY || !records.length) return;
  fetch(`${SB_URL}/rest/v1/iex_market_data`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SB_SERVICE_KEY,
      Authorization: `Bearer ${SB_SERVICE_KEY}`,
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(records),
  }).catch(() => {});
}

export default async function handler(req, res) {
  setCORSHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  // ── Tier resolution ─────────────────────────────────────────
  // Try JWT if present; fall back to free. Never block — free users get NR+WR.
  const token = extractToken(req);
  let userTier = 'free';
  if (token) {
    try {
      const user = await verifyToken(token);
      if (user?.id) userTier = await getUserTier(user.id);
    } catch {}
  }
  const isPro = ['pro', 'enterprise'].includes(userTier);

  res.setHeader('Cache-Control', isPro
    ? 'private, s-maxage=300, stale-while-revalidate=60'
    : 's-maxage=900, stale-while-revalidate=60');

  let data, source;

  try {
    const raw = await fetchIEXPrices();
    const records = Array.isArray(raw)
      ? raw.map(d => ({
          area:        d.area || d.Area || d.name,
          area_price:  parseFloat(d.areaPrice || d.AreaPrice || d.price || 0),
          market_type: 'DAM',
          block_no:    d.blockNo || null,
        })).filter(r => r.area && r.area_price > 0)
      : [];

    if (records.length) {
      saveToSupabase(records); // always save all 5 regions server-side
      data   = records;
      source = 'IEX Live';
    } else throw new Error('empty response');
  } catch {
    try {
      const cached = await getFromSupabase(isPro);
      if (cached?.length) { data = cached; source = 'Supabase Cache'; }
    } catch {}
  }

  if (!data?.length) {
    const rand = (n, v) => n + Math.round(Math.random() * v * 2 - v);
    // Always generate all 5 internally; gate at the response layer
    data = [
      { area: 'Northern Region', area_price: rand(4820, 100), market_type: 'DAM' },
      { area: 'Western Region',  area_price: rand(4215, 100), market_type: 'DAM' },
      { area: 'Southern Region', area_price: rand(5140, 150), market_type: 'DAM' },
      { area: 'Eastern Region',  area_price: rand(3980, 100), market_type: 'DAM' },
      { area: 'NE Region',       area_price: rand(4600,  75), market_type: 'DAM' },
    ];
    source = 'Simulated';
  }

  // ── TIER GATE — the critical business rule ───────────────────
  if (!isPro) {
    data = data.filter(r => FREE_AREAS.has(r.area));
  }

  return res.status(200).json({
    ok: true, data, source,
    tier: userTier,           // let frontend know what tier was used
    ts:   new Date().toISOString(),
  });
}
