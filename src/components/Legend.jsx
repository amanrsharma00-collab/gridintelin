import { VOLTAGE_CONFIG } from '../data/transmissionLines';

export default function Legend({ filters, onToggleVoltage }) {
  return (
    <div className="legend">
      <div className="legend-title">Voltage Levels</div>
      {Object.entries(VOLTAGE_CONFIG).map(([key, cfg]) => {
        const active = filters.voltages.includes(key);
        return (
          <button
            key={key}
            className={`legend-item ${active ? 'active' : 'dimmed'}`}
            onClick={() => onToggleVoltage(key)}
          >
            <span className="legend-line" style={{ background: cfg.color, boxShadow: active ? `0 0 6px ${cfg.color}` : 'none' }} />
            <span className="legend-label">{cfg.label}</span>
          </button>
        );
      })}
      <div className="legend-divider" />
      <div className="legend-title">Markers</div>
      <div className="legend-item active">
        <span className="legend-dot" style={{ background: '#f97316', boxShadow: '0 0 6px #f97316' }} />
        <span className="legend-label">Substation</span>
      </div>
      <div className="legend-item active">
        <span className="legend-dot" style={{ background: '#e879f9', boxShadow: '0 0 8px #e879f9' }} />
        <span className="legend-label">HVDC Terminal</span>
      </div>
    </div>
  );
}
