// Vercel Serverless — IEX India DAM Area Prices (ESM)
// package.json has "type":"module" so must use export default

const SB_URL         = process.env.VITE_SUPABASE_URL;
// Service key is NEVER sent to the browser — safe for server-side writes
const SB_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SB_ANON_KEY    = process.env.VITE_SUPABASE_ANON_KEY;

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

async function getFromSupabase() {
  if (!SB_URL || !SB_SERVICE_KEY) return null;
  const res = await fetch(
    `${SB_URL}/rest/v1/iex_market_data?order=fetched_at.desc&limit=10`,
    { headers: { apikey: SB_SERVICE_KEY, Authorization: `Bearer ${SB_SERVICE_KEY}` } }
  );
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
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=60');

  let data, source;

  try {
    const raw = await fetchIEXPrices();
    const records = Array.isArray(raw)
      ? raw
          .map(d => ({
            area: d.area || d.Area || d.name,
            area_price: parseFloat(d.areaPrice || d.AreaPrice || d.price || 0),
            market_type: 'DAM',
            block_no: d.blockNo || null,
          }))
          .filter(r => r.area && r.area_price > 0)
      : [];

    if (records.length) {
      saveToSupabase(records);
      data = records;
      source = 'IEX Live';
    } else throw new Error('empty response');
  } catch {
    try {
      const cached = await getFromSupabase();
      if (cached?.length) { data = cached; source = 'Supabase Cache'; }
    } catch {}
  }

  if (!data?.length) {
    const rand = (n, v) => n + Math.round(Math.random() * v * 2 - v);
    data = [
      { area: 'Northern Region', area_price: rand(4820, 100), market_type: 'DAM' },
      { area: 'Western Region',  area_price: rand(4215, 100), market_type: 'DAM' },
      { area: 'Southern Region', area_price: rand(5140, 150), market_type: 'DAM' },
      { area: 'Eastern Region',  area_price: rand(3980, 100), market_type: 'DAM' },
      { area: 'NE Region',       area_price: rand(4600,  75), market_type: 'DAM' },
    ];
    source = 'Simulated';
  }

  return res.status(200).json({ ok: true, data, source, ts: new Date().toISOString() });
}
