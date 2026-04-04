// Vercel Serverless — MERIT India Generation Mix (ESM)
import { setCORSHeaders } from './_auth.js';

const SB_URL         = process.env.VITE_SUPABASE_URL;
const SB_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SB_ANON_KEY    = process.env.VITE_SUPABASE_ANON_KEY; // eslint-disable-line no-unused-vars

function saveGeneration(record) {
  if (!SB_URL || !SB_SERVICE_KEY) return;
  fetch(`${SB_URL}/rest/v1/merit_generation`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SB_SERVICE_KEY,
      Authorization: `Bearer ${SB_SERVICE_KEY}`,
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(record),
  }).catch(() => {});
}

export default async function handler(req, res) {
  setCORSHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');

  let genData, source;

  try {
    const raw = await fetch('https://meritindia.in/api/current-generation', {
      headers: { 'User-Agent': 'GridIntelin/1.0', Accept: 'application/json' },
      signal: AbortSignal.timeout(6000),
    }).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); });

    genData = {
      thermal_mw:  parseFloat(raw.thermal  ?? raw.coal   ?? 0),
      hydro_mw:    parseFloat(raw.hydro    ?? raw.hydel  ?? 0),
      nuclear_mw:  parseFloat(raw.nuclear  ?? 0),
      wind_mw:     parseFloat(raw.wind     ?? 0),
      solar_mw:    parseFloat(raw.solar    ?? 0),
      other_re_mw: parseFloat(raw.other    ?? raw.otherRe ?? 0),
    };
    genData.total_mw = Object.values(genData).reduce((a, b) => a + b, 0);
    source = 'meritindia.in';
    saveGeneration(genData);
  } catch {
    const base = 210000 + Math.round((Math.random() - 0.5) * 8000);
    genData = {
      thermal_mw:  Math.round(base * 0.57),
      hydro_mw:    Math.round(base * 0.10),
      nuclear_mw:  Math.round(base * 0.03),
      wind_mw:     Math.round(base * 0.14),
      solar_mw:    Math.round(base * 0.13),
      other_re_mw: Math.round(base * 0.03),
      total_mw:    base,
    };
    source = 'simulated';
  }

  const renewable_pct = Math.round(
    ((genData.wind_mw + genData.solar_mw + genData.hydro_mw + genData.other_re_mw)
      / genData.total_mw) * 100
  );

  return res.status(200).json({
    ok: true,
    data: { ...genData, renewable_pct },
    source,
    ts: new Date().toISOString(),
  });
}
