// Vercel Serverless — MERIT India Generation Mix
// Fetches current thermal/hydro/solar/wind generation from meritindia.in
// Cached: 5 minutes

const SB_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_KEY;

async function fetchMERITGeneration() {
  const res = await fetch(
    'https://meritindia.in/api/generation-mix',
    {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'GridIntelin/1.0',
        'Referer': 'https://meritindia.in/',
      },
      signal: AbortSignal.timeout(6000),
    }
  );
  if (!res.ok) throw new Error(`MERIT ${res.status}`);
  return res.json();
}

async function saveToSupabase(record) {
  if (!SB_URL || !SB_KEY) return;
  await fetch(`${SB_URL}/rest/v1/merit_generation`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SB_KEY,
      'Authorization': `Bearer ${SB_KEY}`,
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify(record),
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');

  let genData;
  let source = 'simulated';

  try {
    const raw = await fetchMERITGeneration();
    genData = {
      thermal_mw:  parseFloat(raw.thermal || raw.coal  || 0),
      hydro_mw:    parseFloat(raw.hydro   || raw.hydel || 0),
      nuclear_mw:  parseFloat(raw.nuclear || 0),
      wind_mw:     parseFloat(raw.wind    || 0),
      solar_mw:    parseFloat(raw.solar   || 0),
      other_re_mw: parseFloat(raw.other   || raw.otherRe || 0),
    };
    genData.total_mw = Object.values(genData).reduce((a, b) => a + b, 0);
    source = 'meritindia.in';
    await saveToSupabase(genData);
  } catch {
    // Realistic fallback based on typical Indian grid mix (Apr 2026)
    const total = 210000 + Math.round((Math.random() - 0.5) * 5000);
    genData = {
      thermal_mw:  Math.round(total * 0.58),
      hydro_mw:    Math.round(total * 0.10),
      nuclear_mw:  Math.round(total * 0.03),
      wind_mw:     Math.round(total * 0.14),
      solar_mw:    Math.round(total * 0.13),
      other_re_mw: Math.round(total * 0.02),
      total_mw:    total,
    };
  }

  const renewable_pct = Math.round(
    ((genData.wind_mw + genData.solar_mw + genData.hydro_mw + genData.other_re_mw) / genData.total_mw) * 100
  );

  return res.status(200).json({
    ok: true,
    data: { ...genData, renewable_pct },
    source,
    ts: new Date().toISOString(),
  });
}
