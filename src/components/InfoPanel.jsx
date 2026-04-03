import { VOLTAGE_CONFIG } from '../data/transmissionLines';
import { REGION_CONFIG } from '../data/substations';

export default function InfoPanel({ entity, onClose, gridData }) {
  if (!entity) return null;

  const isLine = entity._type === 'line';
  const isSubstation = entity._type === 'substation';

  const voltCfg = VOLTAGE_CONFIG[entity.voltage] || VOLTAGE_CONFIG['400kv'];
  const regionCfg = REGION_CONFIG[entity.region] || {};

  // Find live LMP for region
  const liveRegion = gridData?.find(r =>
    r.region_name?.toLowerCase().includes(entity.region?.toLowerCase()) ||
    r.region_code === entity.region
  );

  return (
    <div className="info-panel">
      {/* Header */}
      <div className="ip-header">
        <div className="ip-type-badge" style={{ background: voltCfg.color + '22', color: voltCfg.color, borderColor: voltCfg.color + '44' }}>
          {isLine ? '⚡ TRANSMISSION LINE' : '🔷 SUBSTATION'}
        </div>
        <button className="ip-close" onClick={onClose}>✕</button>
      </div>

      {/* Name */}
      <div className="ip-name">{entity.name}</div>

      {/* Status pill */}
      <div className="ip-status-row">
        <span className={`ip-status ${entity.status === 'operational' ? 'op' : 'fault'}`}>
          <span className="status-dot" />
          {entity.status?.toUpperCase() ?? 'OPERATIONAL'}
        </span>
        <span className="ip-region" style={{ color: regionCfg.color }}>
          {regionCfg.label ?? entity.region}
        </span>
      </div>

      {/* Metrics Grid */}
      <div className="ip-metrics">
        {isLine && (
          <>
            <div className="ip-metric">
              <div className="ipm-val" style={{ color: voltCfg.color }}>{entity.voltageKV} kV</div>
              <div className="ipm-label">Voltage</div>
            </div>
            <div className="ip-metric">
              <div className="ipm-val">{entity.length?.toLocaleString()} km</div>
              <div className="ipm-label">Length</div>
            </div>
            <div className="ip-metric">
              <div className="ipm-val">{entity.capacity?.toLocaleString()} MW</div>
              <div className="ipm-label">Capacity</div>
            </div>
            <div className="ip-metric">
              <div className="ipm-val">{entity.type}</div>
              <div className="ipm-label">Type</div>
            </div>
          </>
        )}
        {isSubstation && (
          <>
            <div className="ip-metric">
              <div className="ipm-val" style={{ color: voltCfg.color }}>{entity.voltage} kV</div>
              <div className="ipm-label">Voltage Class</div>
            </div>
            <div className="ip-metric">
              <div className="ipm-val">{entity.lat?.toFixed(4)}°N</div>
              <div className="ipm-label">Latitude</div>
            </div>
            <div className="ip-metric">
              <div className="ipm-val">{entity.lng?.toFixed(4)}°E</div>
              <div className="ipm-label">Longitude</div>
            </div>
            <div className="ip-metric">
              <div className="ipm-val">{entity.lmpZone}</div>
              <div className="ipm-label">LMP Zone</div>
            </div>
          </>
        )}
      </div>

      {/* LMP Section */}
      <div className="ip-lmp-box">
        <div className="lmp-label">Market Clearing Price</div>
        <div className="lmp-val">
          ₹{(liveRegion?.current_lmp ?? getDefaultLMP(entity.region)).toLocaleString()}
          <span>/MWh</span>
        </div>
        <div className={`lmp-status ${(liveRegion?.congestion_status ?? 'Normal') === 'High' ? 'high' : 'normal'}`}>
          Congestion: {liveRegion?.congestion_status ?? 'Normal'}
        </div>
      </div>

      {/* Details */}
      <div className="ip-details">
        <div className="ipd-row">
          <span className="ipd-key">Operator</span>
          <span className="ipd-val">{entity.operator ?? 'PGCIL'}</span>
        </div>
        <div className="ipd-row">
          <span className="ipd-key">Region</span>
          <span className="ipd-val">{regionCfg.label ?? entity.region}</span>
        </div>
        <div className="ipd-row">
          <span className="ipd-key">RTO</span>
          <span className="ipd-val">{regionCfg.rto ?? '–'}</span>
        </div>
        {isLine && (
          <div className="ipd-row">
            <span className="ipd-key">Coordinates</span>
            <span className="ipd-val">{entity.coordinates?.length} waypoints</span>
          </div>
        )}
      </div>

      <div className="ip-footer">
        <span>Source: PGCIL / POSOCO</span>
        <span className="live-dot-sm" /> <span>Live</span>
      </div>
    </div>
  );
}

function getDefaultLMP(region) {
  const defaults = { NR: 4820, WR: 4215, SR: 5140, ER: 3980, NER: 4600 };
  return defaults[region] ?? 4500;
}
