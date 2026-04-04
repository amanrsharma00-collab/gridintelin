// Vercel Serverless — POSOCO Grid Frequency + Regional Demand
// Fetches real-time data from grid-india.in public endpoints
// Cached: 30 seconds

const SB_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_KEY;

async function fetchGridIndiaFrequency() {
  // grid-india.in dashboard API (public, no auth)
  const res = await fetch(
    'https://grid-india.in/api/frequency',
    {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'GridIntelin/1.0',
        'Referer': 'https://grid-india.in/',
      },
      signal: AbortSignal.timeout(5000),
    }
  );
  if (!res.ok) throw new Error(`POSOCO ${res.status}`);
  return res.json();
}

async function fetchPOSOCOPublic() {
  // Alternative: POSOCO real-time generation report
  const res = await fetch(
    'https://posoco.in/reports/real-time-generation/',
    {
      headers: { 'User-Agent': 'GridIntelin/1.0' },
      signal: AbortSignal.timeout(5000),
    }
  );
  if (!res.ok) throw new Error(`POSOCO report ${res.status}`);
  // Parse HTML for frequency value (POSOCO shows frequency on dashboard)
  const html = await res.text();
  const match = html.match(/(\d{2}\.\d{2,3})\s*Hz/);
  return match ? parseFloat(match[1]) : null;
}

async function saveFrequency(hz) {
  if (!SB_URL || !SB_KEY || !hz) return;
  await fetch(`${SB_URL}/rest/v1/grid_frequency`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SB_KEY,
      'Authorization': `Bearer ${SB_KEY}`,
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify({ frequency_hz: hz, source: 'POSOCO' }),
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=10');

  let frequency_hz = null;
  let source = 'simulated';

  try {
    const data = await fetchGridIndiaFrequency();
    frequency_hz = parseFloat(data?.frequency || data?.hz || data?.value);
    if (frequency_hz) source = 'grid-india.in';
  } catch {
    try {
      frequency_hz = await fetchPOSOCOPublic();
      if (frequency_hz) source = 'posoco.in';
    } catch {
      // Simulate realistic frequency (49.95–50.05 Hz band)
      frequency_hz = parseFloat((49.96 + Math.random() * 0.08).toFixed(3));
      source = 'simulated';
    }
  }

  if (frequency_hz && source !== 'simulated') {
    await saveFrequency(frequency_hz);
  }

  return res.status(200).json({
    ok: true,
    frequency_hz,
    source,
    ts: new Date().toISOString(),
  });
}
