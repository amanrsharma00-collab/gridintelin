// Fetches IEX prices, POSOCO frequency, MERIT generation
// Falls back gracefully if APIs are unreachable

import { useState, useEffect } from 'react';

const FREE_REGIONS = new Set(['NR', 'WR']);

export function useMarketData() {
  const [liveStats, setLiveStats] = useState({
    totalGeneration: 210000,
    gridFrequency:   49.98,
    renewableShare:  42,
    peakDemand:      225000,
    generationMix:   null,
    iexPrices:       {},
    source:          'initialising',
  });

  useEffect(() => {
    let cancelled = false;

    async function fetchAll() {
      try {
        const [freqRes, genRes, iexRes] = await Promise.allSettled([
          fetch('/api/posoco-frequency').then(r => r.json()),
          fetch('/api/merit-generation').then(r => r.json()),
          fetch('/api/iex-prices').then(r => r.json()),
        ]);

        if (cancelled) return;

        const freq = freqRes.status === 'fulfilled' ? freqRes.value : null;
        const gen  = genRes.status  === 'fulfilled' ? genRes.value  : null;
        const iex  = iexRes.status  === 'fulfilled' ? iexRes.value  : null;

        // Build IEX price map by region
        const iexPrices = {};
        if (iex?.ok && Array.isArray(iex.data)) {
          iex.data.forEach(d => {
            const area = (d.area || '').toLowerCase();
            if (area.includes('north'))  iexPrices['NR']  = d.area_price;
            if (area.includes('west'))   iexPrices['WR']  = d.area_price;
            if (area.includes('south'))  iexPrices['SR']  = d.area_price;
            if (area.includes('east') && !area.includes('north')) iexPrices['ER'] = d.area_price;
            if (area.includes('north') && area.includes('east'))  iexPrices['NER']= d.area_price;
          });
        }

        setLiveStats(prev => ({
          totalGeneration: gen?.data?.total_mw     ?? prev.totalGeneration,
          gridFrequency:   freq?.frequency_hz      ?? prev.gridFrequency,
          renewableShare:  gen?.data?.renewable_pct ?? prev.renewableShare,
          peakDemand:      prev.peakDemand,
          generationMix:   gen?.data              ?? prev.generationMix,
          iexPrices:       Object.keys(iexPrices).length ? iexPrices : prev.iexPrices,
          source:          freq?.source ?? 'api',
        }));
      } catch {
        // Silent — keep previous values
      }
    }

    fetchAll();
    const t = setInterval(fetchAll, 60_000); // refresh every 60s
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  return liveStats;
}

export { FREE_REGIONS };
