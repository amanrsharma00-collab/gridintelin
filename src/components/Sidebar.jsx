import { REGION_CONFIG } from '../data/substations';
import { VOLTAGE_CONFIG } from '../data/transmissionLines';

export default function Sidebar({ open, filters, setFilters, gridData, liveStats }) {
  const toggleVoltage = (v) => {
    setFilters(f => ({
      ...f,
      voltages: f.voltages.includes(v) ? f.voltages.filter(x => x !== v) : [...f.voltages, v],
    }));
  };

  const toggleRegion = (r) => {
    setFilters(f => ({
      ...f,
      regions: f.regions.includes(r) ? f.regions.filter(x => x !== r) : [...f.regions, r],
    }));
  };

  const regionStats = {
    NR:  { lmp: 4820, demand: 68500, status: 'Normal' },
    WR:  { lmp: 4215, demand: 72000, status: 'Normal' },
    SR:  { lmp: 5140, demand: 58000, status: 'Congested' },
    ER:  { lmp: 3980, demand: 32000, status: 'Normal' },
    NER: { lmp: 4600, demand: 4200,  status: 'Normal' },
  };

  // Merge with live Supabase data if available
  if (gridData?.length) {
    gridData.forEach(r => {
      const key = r.region_code || r.region_name?.slice(0, 2).toUpperCase();
      if (key && regionStats[key]) {
        regionStats[key].lmp = r.current_lmp ?? regionStats[key].lmp;
        regionStats[key].status = r.congestion_status ?? regionStats[key].status;
      }
    });
  }

  return (
    <aside className={`sidebar ${open ? 'open' : 'closed'}`}>
      {/* Grid Summary */}
      <section className="sidebar-section">
        <div className="section-title">🇮🇳 Grid Summary</div>
        <div className="summary-grid">
          <div className="summary-card">
            <div className="sc-val">{((liveStats?.totalGeneration ?? 210000) / 1000).toFixed(1)}<span>GW</span></div>
            <div className="sc-label">Total Generation</div>
          </div>
          <div className="summary-card">
            <div className="sc-val">{((liveStats?.peakDemand ?? 225000) / 1000).toFixed(1)}<span>GW</span></div>
            <div className="sc-label">Peak Demand</div>
          </div>
          <div className="summary-card green">
            <div className="sc-val">{liveStats?.renewableShare ?? 42}<span>%</span></div>
            <div className="sc-label">Renewable</div>
          </div>
          <div className="summary-card">
            <div className="sc-val">5<span>R</span></div>
            <div className="sc-label">Grid Regions</div>
          </div>
        </div>
      </section>

      {/* Regional LMP */}
      <section className="sidebar-section">
        <div className="section-title">Regional LMP (₹/MWh)</div>
        {Object.entries(REGION_CONFIG).map(([code, cfg]) => {
          const active = filters.regions.includes(code);
          const stats = regionStats[code];
          return (
            <button
              key={code}
              className={`region-row ${active ? 'active' : 'inactive'}`}
              onClick={() => toggleRegion(code)}
            >
              <div className="region-dot" style={{ background: cfg.color }} />
              <div className="region-info">
                <div className="region-name">{cfg.label}</div>
                <div className="region-rto">{cfg.rto} · {cfg.hq}</div>
              </div>
              <div className="region-right">
                <div className="region-lmp">₹{stats.lmp.toLocaleString()}</div>
                <div className={`region-status ${stats.status === 'Congested' ? 'congested' : 'normal'}`}>
                  {stats.status}
                </div>
              </div>
            </button>
          );
        })}
      </section>

      {/* Voltage Filters */}
      <section className="sidebar-section">
        <div className="section-title">Transmission Voltage</div>
        {Object.entries(VOLTAGE_CONFIG).map(([key, cfg]) => {
          const active = filters.voltages.includes(key);
          return (
            <button
              key={key}
              className={`voltage-row ${active ? 'active' : 'inactive'}`}
              onClick={() => toggleVoltage(key)}
            >
              <span className="v-swatch" style={{ background: cfg.color, boxShadow: active ? `0 0 8px ${cfg.color}` : 'none' }} />
              <span className="v-label">{cfg.label}</span>
              <span className={`v-toggle ${active ? 'on' : 'off'}`}>{active ? 'ON' : 'OFF'}</span>
            </button>
          );
        })}
      </section>

      {/* Layer Toggles */}
      <section className="sidebar-section">
        <div className="section-title">Map Layers</div>
        <button
          className={`layer-row ${filters.showSubstations ? 'active' : 'inactive'}`}
          onClick={() => setFilters(f => ({ ...f, showSubstations: !f.showSubstations }))}
        >
          <span className="layer-icon">🔷</span>
          <span className="layer-label">Substations</span>
          <span className={`v-toggle ${filters.showSubstations ? 'on' : 'off'}`}>{filters.showSubstations ? 'ON' : 'OFF'}</span>
        </button>
        <button
          className={`layer-row ${filters.showLines ? 'active' : 'inactive'}`}
          onClick={() => setFilters(f => ({ ...f, showLines: !f.showLines }))}
        >
          <span className="layer-icon">📡</span>
          <span className="layer-label">Transmission Lines</span>
          <span className={`v-toggle ${filters.showLines ? 'on' : 'off'}`}>{filters.showLines ? 'ON' : 'OFF'}</span>
        </button>
      </section>

      <div className="sidebar-footer">
        <span>Data: PGCIL / NLDC</span>
        <span>Updated: Live</span>
      </div>
    </aside>
  );
}
