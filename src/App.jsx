import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import MapView from './components/MapView';
import InfoPanel from './components/InfoPanel';
import LiveTicker from './components/LiveTicker';
import Legend from './components/Legend';

// ── Supabase (graceful if env vars not set) ──────────────────
const supabase =
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY
    ? createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY)
    : null;

// ── Simulated live stats (updated every 5s) ──────────────────
function useSimLiveStats() {
  const [stats, setStats] = useState({
    totalGeneration: 212480,
    gridFrequency: 49.98,
    renewableShare: 42,
    peakDemand: 225600,
  });

  useEffect(() => {
    const t = setInterval(() => {
      setStats(s => ({
        totalGeneration: s.totalGeneration + Math.round((Math.random() - 0.5) * 200),
        gridFrequency:   parseFloat((49.97 + Math.random() * 0.06).toFixed(3)),
        renewableShare:  Math.max(35, Math.min(50, s.renewableShare + Math.round((Math.random() - 0.5) * 2))),
        peakDemand:      s.peakDemand + Math.round((Math.random() - 0.5) * 100),
      }));
    }, 5000);
    return () => clearInterval(t);
  }, []);

  return stats;
}

export default function App() {
  const [sidebarOpen, setSidebarOpen]       = useState(true);
  const [selectedEntity, setSelectedEntity] = useState(null);
  const [searchQuery, setSearchQuery]       = useState('');
  const [gridData, setGridData]             = useState([]);
  const liveStats = useSimLiveStats();

  const [filters, setFilters] = useState({
    voltages: ['hvdc', '765kv', '400kv', '220kv', '132kv'],
    regions:  ['NR', 'WR', 'SR', 'ER', 'NER'],
    showSubstations: true,
    showLines: true,
  });

  // ── Supabase: fetch + subscribe ──────────────────────────────
  useEffect(() => {
    if (!supabase) return;

    async function fetchGridData() {
      const { data, error } = await supabase.from('grid_regions').select('*');
      if (data) setGridData(data);
    }
    fetchGridData();

    const channel = supabase
      .channel('grid_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'grid_regions' }, payload => {
        setGridData(prev =>
          payload.eventType === 'DELETE'
            ? prev.filter(r => r.id !== payload.old.id)
            : prev.map(r => r.id === payload.new.id ? payload.new : r)
        );
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  const toggleVoltage = (v) => {
    setFilters(f => ({
      ...f,
      voltages: f.voltages.includes(v) ? f.voltages.filter(x => x !== v) : [...f.voltages, v],
    }));
  };

  return (
    <div className="app">
      <Header
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen(o => !o)}
        onSearch={setSearchQuery}
        liveStats={liveStats}
      />

      <div className="main-content">
        <Sidebar
          open={sidebarOpen}
          filters={filters}
          setFilters={setFilters}
          gridData={gridData}
          liveStats={liveStats}
        />

        <div className="map-container">
          <MapView
            filters={filters}
            gridData={gridData}
            onSelectEntity={setSelectedEntity}
            selectedEntity={selectedEntity}
            searchQuery={searchQuery}
          />

          <Legend filters={filters} onToggleVoltage={toggleVoltage} />
        </div>

        {selectedEntity && (
          <InfoPanel
            entity={selectedEntity}
            onClose={() => setSelectedEntity(null)}
            gridData={gridData}
          />
        )}
      </div>

      <LiveTicker liveStats={liveStats} gridData={gridData} />
    </div>
  );
}
