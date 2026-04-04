import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import MapView from './components/MapView';
import InfoPanel from './components/InfoPanel';
import LiveTicker from './components/LiveTicker';
import Legend from './components/Legend';
import UpgradeModal from './components/UpgradeModal';
import { useMarketData, FREE_REGIONS } from './hooks/useMarketData';

const supabase =
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY
    ? createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY)
    : null;

export default function App() {
  const [sidebarOpen, setSidebarOpen]       = useState(true);
  const [selectedEntity, setSelectedEntity] = useState(null);
  const [gridData, setGridData]             = useState([]);
  const [userTier, setUserTier]             = useState('free'); // 'free' | 'pro' | 'enterprise'
  const [showUpgrade, setShowUpgrade]       = useState(false);
  const liveStats = useMarketData();

  const [filters, setFilters] = useState({
    voltages: ['765kv', '400kv', '220kv', '132kv'], // HVDC locked for free
    regions:  ['NR', 'WR'],                          // SR/ER/NER locked for free
    showSubstations: true,
    showLines: true,
  });

  // Check user tier from Supabase Auth
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getUser().then(({ data }) => {
      if (!data?.user) return;
      supabase.from('user_tiers').select('tier').eq('user_id', data.user.id).single()
        .then(({ data: t }) => { if (t?.tier) setUserTier(t.tier); });
    });
  }, []);

  // Fetch grid regions + real-time subscription
  useEffect(() => {
    if (!supabase) return;
    supabase.from('grid_regions').select('*').then(({ data }) => { if (data) setGridData(data); });

    const ch = supabase.channel('grid_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'grid_regions' }, p => {
        setGridData(prev => prev.map(r => r.id === p.new?.id ? p.new : r));
      }).subscribe();
    return () => supabase.removeChannel(ch);
  }, []);

  // Enforce free tier filter constraints
  useEffect(() => {
    if (userTier === 'free') {
      setFilters(f => ({
        ...f,
        regions:  f.regions.filter(r => FREE_REGIONS.has(r)),
        voltages: f.voltages.filter(v => v !== 'hvdc'),
      }));
    }
  }, [userTier]);

  const handleSelectEntity = (entity) => {
    // Gate Pro regions
    if (userTier === 'free' && !FREE_REGIONS.has(entity.region)) {
      setShowUpgrade(true);
      return;
    }
    setSelectedEntity(entity);
  };

  const toggleVoltage = (v) => {
    if (userTier === 'free' && v === 'hvdc') { setShowUpgrade(true); return; }
    setFilters(f => ({
      ...f,
      voltages: f.voltages.includes(v) ? f.voltages.filter(x => x !== v) : [...f.voltages, v],
    }));
  };

  const toggleRegion = (r) => {
    if (userTier === 'free' && !FREE_REGIONS.has(r)) { setShowUpgrade(true); return; }
    setFilters(f => ({
      ...f,
      regions: f.regions.includes(r) ? f.regions.filter(x => x !== r) : [...f.regions, r],
    }));
  };

  return (
    <div className="app">
      <Header
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen(o => !o)}
        liveStats={liveStats}
        userTier={userTier}
        onUpgrade={() => setShowUpgrade(true)}
      />

      <div className="main-content">
        <Sidebar
          open={sidebarOpen}
          filters={filters}
          setFilters={setFilters}
          gridData={gridData}
          liveStats={liveStats}
          userTier={userTier}
          onToggleRegion={toggleRegion}
          onToggleVoltage={toggleVoltage}
          onUpgrade={() => setShowUpgrade(true)}
        />

        <div className="map-container">
          <MapView
            filters={filters}
            gridData={gridData}
            onSelectEntity={handleSelectEntity}
            selectedEntity={selectedEntity}
            userTier={userTier}
          />
          <Legend filters={filters} onToggleVoltage={toggleVoltage} userTier={userTier} />
        </div>

        {selectedEntity && (
          <InfoPanel
            entity={selectedEntity}
            onClose={() => setSelectedEntity(null)}
            gridData={gridData}
            liveStats={liveStats}
          />
        )}
      </div>

      <LiveTicker liveStats={liveStats} gridData={gridData} userTier={userTier} />

      {showUpgrade && <UpgradeModal onClose={() => setShowUpgrade(false)} />}
    </div>
  );
}
