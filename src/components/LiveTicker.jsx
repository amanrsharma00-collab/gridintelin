import { useEffect, useRef, useState } from 'react';

const TICKER_INTERVAL = 3000;

export default function LiveTicker({ liveStats, gridData }) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), TICKER_INTERVAL);
    return () => clearInterval(t);
  }, []);

  const freq = liveStats?.gridFrequency ?? (49.95 + Math.random() * 0.1);
  const freqColor = freq >= 49.95 && freq <= 50.05 ? '#4ade80' : freq < 49.85 ? '#f87171' : '#facc15';

  const items = [
    { label: 'GRID FREQ',     value: `${freq.toFixed(2)} Hz`,            color: freqColor },
    { label: 'TOTAL GEN',     value: `${((liveStats?.totalGeneration ?? 210000) / 1000).toFixed(1)} GW`, color: '#f1f5f9' },
    { label: 'PEAK DEMAND',   value: `${((liveStats?.peakDemand ?? 225000) / 1000).toFixed(1)} GW`,      color: '#f1f5f9' },
    { label: 'RENEWABLE MIX', value: `${liveStats?.renewableShare ?? 42}%`,  color: '#4ade80' },
    { label: 'NR LMP',        value: `₹${getLMP(gridData, 'NR', 4820)}/MWh`, color: '#60a5fa' },
    { label: 'WR LMP',        value: `₹${getLMP(gridData, 'WR', 4215)}/MWh`, color: '#f97316' },
    { label: 'SR LMP',        value: `₹${getLMP(gridData, 'SR', 5140)}/MWh`, color: '#4ade80' },
    { label: 'ER LMP',        value: `₹${getLMP(gridData, 'ER', 3980)}/MWh`, color: '#facc15' },
    { label: 'NER LMP',       value: `₹${getLMP(gridData, 'NER', 4600)}/MWh`,color: '#e879f9' },
    { label: 'SOLAR GEN',     value: `${Math.round((liveStats?.totalGeneration ?? 210000) * 0.18 / 1000)} GW`, color: '#fbbf24' },
    { label: 'WIND GEN',      value: `${Math.round((liveStats?.totalGeneration ?? 210000) * 0.14 / 1000)} GW`, color: '#34d399' },
    { label: 'HYDRO GEN',     value: `${Math.round((liveStats?.totalGeneration ?? 210000) * 0.10 / 1000)} GW`, color: '#38bdf8' },
    { label: 'THERMAL GEN',   value: `${Math.round((liveStats?.totalGeneration ?? 210000) * 0.58 / 1000)} GW`, color: '#fb923c' },
    { label: 'LINES ACTIVE',  value: '70',    color: '#f1f5f9' },
    { label: 'SUBSTATIONS',   value: '57',    color: '#f1f5f9' },
    { label: 'HVDC LINKS',    value: '4',     color: '#e879f9' },
  ];

  return (
    <div className="live-ticker">
      <div className="ticker-badge">
        <span className="live-dot" />
        LIVE
      </div>
      <div className="ticker-track">
        <div className="ticker-inner" style={{ animationDuration: `${items.length * 4}s` }}>
          {[...items, ...items].map((item, i) => (
            <div key={i} className="ticker-item">
              <span className="ticker-label">{item.label}</span>
              <span className="ticker-value" style={{ color: item.color }}>{item.value}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="ticker-time">
        {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} IST
      </div>
    </div>
  );
}

function getLMP(gridData, regionCode, fallback) {
  const match = gridData?.find(r =>
    r.region_code === regionCode ||
    r.region_name?.toLowerCase().includes(regionCode.toLowerCase())
  );
  return (match?.current_lmp ?? fallback).toLocaleString();
}
