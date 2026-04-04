import { REGION_CONFIG } from '../data/substations';
import { VOLTAGE_CONFIG } from '../data/transmissionLines';

const FREE_REGIONS  = new Set(['NR', 'WR']);
const FREE_VOLTAGES = new Set(['765kv', '400kv', '220kv', '132kv']);

export default function Sidebar({ open, filters, gridData, liveStats, userTier,
  onToggleRegion, onToggleVoltage, onUpgrade }) {

  const isPro = userTier === 'pro' || userTier === 'enterprise';

  // LMP: use IEX prices if available, else fallback
  const iexPrices = liveStats?.iexPrices ?? {};
  const fallback  = { NR: 4820, WR: 4215, SR: 5140, ER: 3980, NER: 4600 };
  const getLMP = r => iexPrices[r] ?? fallback[r];

  const statusMap = {};
  (gridData ?? []).forEach(r => { statusMap[r.id] = r.congestion_status ?? 'Normal'; });

  return (
    <aside className={`sidebar ${open ? 'open' : 'closed'}`}>

      {/* Grid Summary */}
      <section className="sidebar-section">
        <div className="section-title">🇮🇳 Grid Summary</div>
        <div className="summary-grid">
          <div className="summary-card">
            <div className="sc-val">{((liveStats?.totalGeneration ?? 210000)/1000).toFixed(1)}<span>GW</span></div>
            <div className="sc-label">Generation</div>
          </div>
          <div className="summary-card">
            <div className="sc-val">{((liveStats?.peakDemand ?? 225000)/1000).toFixed(1)}<span>GW</span></div>
            <div className="sc-label">Peak Demand</div>
          </div>
          <div className="summary-card green">
            <div className="sc-val">{liveStats?.renewableShare ?? 42}<span>%</span></div>
            <div className="sc-label">Renewable</div>
          </div>
          <div className="summary-card">
            <div className="sc-val" style={{ fontSize: 11, color: '#f97316' }}>
              {liveStats?.source === 'simulated' ? 'Sim' : 'IEX'}
            </div>
            <div className="sc-label">Data Source</div>
          </div>
        </div>
      </section>

      {/* Regional LMP */}
      <section className="sidebar-section">
        <div className="section-title">Regional LMP (₹/MWh) — IEX DAM</div>
        {Object.entries(REGION_CONFIG).map(([code, cfg]) => {
          const isFree   = FREE_REGIONS.has(code);
          const locked   = !isPro && !isFree;
          const active   = filters.regions.includes(code);

          return (
            <button
              key={code}
              className={`region-row ${active ? 'active' : 'inactive'} ${locked ? 'locked-row' : ''}`}
              onClick={() => locked ? onUpgrade() : onToggleRegion(code)}
            >
              <div className="region-dot" style={{ background: cfg.color }} />
              <div className="region-info">
                <div className="region-name">{cfg.label}</div>
                <div className="region-rto">{cfg.rto} · {cfg.hq}</div>
              </div>
              <div className="region-right">
                {locked ? (
                  <div className="lock-badge">🔒 Pro</div>
                ) : (
                  <>
                    <div className="region-lmp">₹{getLMP(code).toLocaleString()}</div>
                    <div className={`region-status ${statusMap[code] === 'High' ? 'congested' : 'normal'}`}>
                      {statusMap[code] ?? 'Normal'}
                    </div>
                  </>
                )}
              </div>
            </button>
          );
        })}
      </section>

      {/* Voltage Filters */}
      <section className="sidebar-section">
        <div className="section-title">Transmission Voltage</div>
        {Object.entries(VOLTAGE_CONFIG).map(([key, cfg]) => {
          const locked = !isPro && !FREE_VOLTAGES.has(key);
          const active = filters.voltages.includes(key);
          return (
            <button
              key={key}
              className={`voltage-row ${active ? 'active' : 'inactive'} ${locked ? 'locked-row' : ''}`}
              onClick={() => locked ? onUpgrade() : onToggleVoltage(key)}
            >
              <span className="v-swatch" style={{ background: locked ? '#334155' : cfg.color, boxShadow: (!locked && active) ? `0 0 8px ${cfg.color}` : 'none' }} />
              <span className="v-label">{cfg.label}</span>
              {locked
                ? <span className="lock-badge">🔒 Pro</span>
                : <span className={`v-toggle ${active ? 'on' : 'off'}`}>{active ? 'ON' : 'OFF'}</span>
              }
            </button>
          );
        })}
      </section>

      {/* Tier Banner */}
      {!isPro && (
        <section className="sidebar-section">
          <button className="upgrade-banner" onClick={onUpgrade}>
            <span>🚀 Unlock all 5 regions + HVDC</span>
            <span className="upgrade-arrow">Upgrade →</span>
          </button>
        </section>
      )}

      <div className="sidebar-footer">
        <span>IEX · POSOCO · MERIT</span>
        <span className={`tier-pill ${userTier}`}>{userTier.toUpperCase()}</span>
      </div>
    </aside>
  );
}
