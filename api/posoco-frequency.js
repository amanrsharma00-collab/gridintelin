// Vercel Serverless Function — POSOCO Grid Frequency
// CommonJS format

const SB_URL = process.env.VITE_SUPABASE_URL;
const SB_KEY = process.env.VITE_SUPABASE_ANON_KEY;

async function tryFetch(url, timeout = 4000) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'GridIntelin/1.0', 'Accept': 'application/json' },
    signal: AbortSignal.timeout(timeout),
  });
  if (!res.ok) throw new Error(res.status);
  return res.json();
}

async function saveFrequency(hz, source) {
  if (!SB_URL || !SB_KEY) return;
  fetch(`${SB_URL}/rest/v1/grid_frequency`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SB_KEY,
      Authorization: `Bearer ${SB_KEY}`,
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ frequency_hz: hz, source }),
  }).catch(() => {});
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=10');

  let frequency_hz = null;
  let source = 'simulated';

  // Try grid-india.in public API
  const endpoints = [
    'https://grid-india.in/api/frequency',
    'https://grid-india.in/api/realtime',
    'https://posoco.in/api/frequency',
  ];

  for (const url of endpoints) {
    try {
      const d = await tryFetch(url);
      const hz = parseFloat(d?.frequency || d?.hz || d?.value || d?.data?.frequency);
      if (hz >= 49.0 && hz <= 51.0) {
        frequency_hz = hz;
        source = new URL(url).hostname;
        break;
      }
    } catch {}
  }

  // Realistic simulation: Indian grid stays 49.95–50.05 Hz
  if (!frequency_hz) {
    frequency_hz = parseFloat((49.96 + Math.random() * 0.08).toFixed(3));
    source = 'simulated';
  }

  if (source !== 'simulated') {
    saveFrequency(frequency_hz, source);
  }

  return res.status(200).json({
    ok: true,
    frequency_hz,
    source,
    ts: new Date().toISOString(),
  });
};
