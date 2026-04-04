// Vercel Serverless — POSOCO Grid Frequency (ESM)
import { setCORSHeaders } from './_auth.js';

const SB_URL         = process.env.VITE_SUPABASE_URL;
const SB_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SB_ANON_KEY    = process.env.VITE_SUPABASE_ANON_KEY; // eslint-disable-line no-unused-vars

async function tryFetch(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'GridIntelin/1.0', Accept: 'application/json' },
    signal: AbortSignal.timeout(4000),
  });
  if (!res.ok) throw new Error(res.status);
  return res.json();
}

function saveFrequency(hz, source) {
  if (!SB_URL || !SB_SERVICE_KEY) return;
  fetch(`${SB_URL}/rest/v1/grid_frequency`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SB_SERVICE_KEY,
      Authorization: `Bearer ${SB_SERVICE_KEY}`,
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ frequency_hz: hz, source }),
  }).catch(() => {});
}

export default async function handler(req, res) {
  setCORSHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=10');

  let frequency_hz = null;
  let source = 'simulated';

  for (const url of [
    'https://grid-india.in/api/frequency',
    'https://grid-india.in/api/realtime',
  ]) {
    try {
      const d = await tryFetch(url);
      const hz = parseFloat(d?.frequency ?? d?.hz ?? d?.value ?? d?.data?.frequency);
      if (hz >= 49.0 && hz <= 51.0) {
        frequency_hz = hz;
        source = new URL(url).hostname;
        break;
      }
    } catch {}
  }

  if (!frequency_hz) {
    frequency_hz = parseFloat((49.96 + Math.random() * 0.08).toFixed(3));
    source = 'simulated';
  } else {
    saveFrequency(frequency_hz, source);
  }

  return res.status(200).json({ ok: true, frequency_hz, source, ts: new Date().toISOString() });
}
