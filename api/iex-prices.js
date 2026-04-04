// Vercel Serverless Function — IEX India DAM Area Prices
// CommonJS format for maximum Vercel compatibility
// Polls IEX public market data, stores in Supabase, returns latest prices

const SB_URL = process.env.VITE_SUPABASE_URL;
const SB_KEY = process.env.VITE_SUPABASE_ANON_KEY;

const IEX_AREAS = [
  'Northern Region', 'Western Region', 'Southern Region',
  'Eastern Region', 'NE Region'
];

async function fetchIEXPrices() {
  const res = await fetch('https://www.iexindia.com/api/areaprice', {
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'GridIntelin/1.0',
      'Referer': 'https://www.iexindia.com/marketdata/areaprice.aspx',
    },
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) throw new Error(`IEX ${res.status}`);
  return res.json();
}

async function getFromSupabase() {
  if (!SB_URL || !SB_KEY) return null;
  const res = await fetch(`${SB_URL}/rest/v1/iex_market_data?order=fetched_at.desc&limit=10`, {
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
  });
  return res.ok ? res.json() : null;
}

async function saveToSupabase(records) {
  if (!SB_URL || !SB_KEY || !records.length) return;
  fetch(`${SB_URL}/rest/v1/iex_market_data`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SB_KEY,
      Authorization: `Bearer ${SB_KEY}`,
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(records),
  }).catch(() => {});
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=60');

  let data, source;

  try {
    const raw = await fetchIEXPrices();
    const records = Array.isArray(raw)
      ? raw.map(d => ({
          area: d.area || d.Area || d.name,
          area_price: parseFloat(d.areaPrice || d.AreaPrice || d.price || 0),
          market_type: 'DAM',
          block_no: d.blockNo || null,
        })).filter(r => r.area && r.area_price > 0)
      : [];

    if (records.length) {
      saveToSupabase(records);
      data = records;
      source = 'IEX Live';
    } else {
      throw new Error('empty');
    }
  } catch {
    // Try Supabase cache
    try {
      const cached = await getFromSupabase();
      if (cached && cached.length) { data = cached; source = 'Supabase Cache'; }
    } catch {}
  }

  // Realistic fallback — Indian DAM clearing prices
  if (!data || !data.length) {
    data = [
      { area: 'Northern Region', area_price: 4820 + Math.round(Math.random() * 200 - 100), market_type: 'DAM' },
      { area: 'Western Region',  area_price: 4215 + Math.round(Math.random() * 200 - 100), market_type: 'DAM' },
      { area: 'Southern Region', area_price: 5140 + Math.round(Math.random() * 300 - 150), market_type: 'DAM' },
      { area: 'Eastern Region',  area_price: 3980 + Math.round(Math.random() * 200 - 100), market_type: 'DAM' },
      { area: 'NE Region',       area_price: 4600 + Math.round(Math.random() * 150 - 75),  market_type: 'DAM' },
    ];
    source = 'Simulated';
  }

  return res.status(200).json({ ok: true, data, source, ts: new Date().toISOString() });
};
