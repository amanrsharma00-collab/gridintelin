import { useEffect, useRef } from 'react';
import {
  MapContainer, TileLayer, Polyline, CircleMarker,
  Tooltip, useMap,
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { transmissionLines, VOLTAGE_CONFIG } from '../data/transmissionLines';
import { substations } from '../data/substations';

// ── Fix default icon path for Vite ──────────────────────────
import L from 'leaflet';
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Map centre on India
const INDIA_CENTER = [22.5, 82.0];
const INDIA_ZOOM   = 5;

// Substation radius by voltage
function subRadius(type) {
  switch (type) {
    case 'hvdc':  return 9;
    case '765kv': return 7;
    case '400kv': return 5;
    case '220kv': return 4;
    default:      return 3;
  }
}

function subColor(type) {
  switch (type) {
    case 'hvdc':  return '#e879f9';
    case '765kv': return '#f97316';
    case '400kv': return '#facc15';
    case '220kv': return '#4ade80';
    default:      return '#60a5fa';
  }
}

// Fit India bounds helper
function FitIndia() {
  const map = useMap();
  useEffect(() => {
    map.fitBounds([[6.5, 68.0], [37.0, 97.5]], { padding: [20, 20] });
  }, [map]);
  return null;
}

export default function MapView({ filters, gridData, onSelectEntity, selectedEntity }) {
  const congestionLookup = {};
  (gridData ?? []).forEach(r => {
    congestionLookup[r.region_code ?? r.region_name?.slice(0, 2).toUpperCase()] = r.congestion_status;
  });

  // Filter lines
  const visibleLines = (filters.showLines ? transmissionLines : []).filter(l =>
    filters.voltages.includes(l.voltage) && filters.regions.includes(l.region)
  );

  // Filter substations
  const visibleSubs = (filters.showSubstations ? substations : []).filter(s =>
    filters.regions.includes(s.region) &&
    filters.voltages.includes(s.type)
  );

  return (
    <div className="map-wrapper">
      <MapContainer
        center={INDIA_CENTER}
        zoom={INDIA_ZOOM}
        className="leaflet-map"
        zoomControl={false}
        attributionControl={false}
      >
        {/* Dark base tiles — CartoDB Dark Matter (free, no API key) */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          subdomains="abcd"
          maxZoom={19}
        />

        <FitIndia />

        {/* ── Transmission Lines ── */}
        {visibleLines.map(line => {
          const cfg  = VOLTAGE_CONFIG[line.voltage];
          const isCongested = congestionLookup[line.region] === 'High';
          const isSelected  = selectedEntity?.id === line.id;
          const color = isCongested ? '#f87171' : cfg.color;
          const weight = cfg.weight + (isSelected ? 2 : 0);
          const opacity = isSelected ? 1 : 0.82;

          return (
            <Polyline
              key={line.id}
              positions={line.coordinates}
              pathOptions={{
                color,
                weight,
                opacity,
                dashArray: line.type === 'HVDC' ? '8 4' : undefined,
                lineCap: 'round',
                lineJoin: 'round',
              }}
              eventHandlers={{
                click: () => onSelectEntity({ ...line, _type: 'line' }),
                mouseover: e => { e.target.setStyle({ weight: weight + 1, opacity: 1 }); },
                mouseout:  e => { e.target.setStyle({ weight, opacity }); },
              }}
            >
              <Tooltip sticky className="line-tooltip">
                <div className="tt-name">{line.name}</div>
                <div className="tt-meta">
                  <span style={{ color: cfg.color }}>{line.voltageKV} kV {line.type}</span>
                  <span>· {line.length} km · {line.capacity?.toLocaleString()} MW</span>
                </div>
              </Tooltip>
            </Polyline>
          );
        })}

        {/* ── Substations ── */}
        {visibleSubs.map(sub => {
          const color = subColor(sub.type);
          const radius = subRadius(sub.type);
          const isSelected = selectedEntity?.id === sub.id;

          return (
            <CircleMarker
              key={sub.id}
              center={[sub.lat, sub.lng]}
              radius={isSelected ? radius + 3 : radius}
              pathOptions={{
                color,
                fillColor: color,
                fillOpacity: 0.9,
                weight: isSelected ? 2.5 : 1.5,
                opacity: 1,
              }}
              eventHandlers={{
                click: () => onSelectEntity({ ...sub, _type: 'substation' }),
              }}
            >
              <Tooltip className="sub-tooltip">
                <div className="tt-name">{sub.name}</div>
                <div className="tt-meta">
                  <span style={{ color }}>{sub.voltage} kV · {sub.type.toUpperCase()}</span>
                  <span> · {sub.region}</span>
                </div>
              </Tooltip>
            </CircleMarker>
          );
        })}
      </MapContainer>

      {/* Custom zoom controls */}
      <div className="map-controls">
        <button className="map-btn" onClick={() => document.querySelector('.leaflet-map')._leaflet_map?.zoomIn()}>+</button>
        <button className="map-btn" onClick={() => document.querySelector('.leaflet-map')._leaflet_map?.zoomOut()}>−</button>
        <button
          className="map-btn"
          title="Reset view"
          onClick={() => {
            const el = document.querySelector('.leaflet-map');
            el?._leaflet_map?.fitBounds([[6.5, 68.0], [37.0, 97.5]], { padding: [20, 20] });
          }}
        >⌖</button>
      </div>

      {/* Stats overlay */}
      <div className="map-stats-overlay">
        <div className="mso-item">
          <span className="mso-val">{visibleLines.length}</span>
          <span className="mso-label">Lines</span>
        </div>
        <div className="mso-sep" />
        <div className="mso-item">
          <span className="mso-val">{visibleSubs.length}</span>
          <span className="mso-label">Substations</span>
        </div>
        <div className="mso-sep" />
        <div className="mso-item">
          <span className="mso-val" style={{ color: '#4ade80' }}>LIVE</span>
          <span className="mso-label">Status</span>
        </div>
      </div>
    </div>
  );
}
