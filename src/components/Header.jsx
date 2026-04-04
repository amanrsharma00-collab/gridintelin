import { useState } from 'react';
import { REGION_CONFIG } from '../data/substations';

export default function Header({ sidebarOpen, onToggleSidebar, onSearch, liveStats, userTier, currentUser, onUpgrade, onSignIn, onSignOut }) {
  const [query, setQuery] = useState('');

  const handleSearch = (e) => {
    e.preventDefault();
    if (onSearch) onSearch(query);
  };

  const freq = liveStats?.gridFrequency ?? 49.98;
  const freqColor = freq >= 49.95 && freq <= 50.05 ? '#4ade80' : freq < 49.85 ? '#f87171' : '#facc15';

  return (
    <header className="header">
      {/* Logo */}
      <div className="header-left">
        <button className="sidebar-toggle" onClick={onToggleSidebar} title="Toggle Panel">
          <span className={`hamburger ${sidebarOpen ? 'open' : ''}`}>
            <span /><span /><span />
          </span>
        </button>
        <div className="logo">
          <span className="logo-icon">⚡</span>
          <div className="logo-text">
            <span className="logo-main">GridIntelin</span>
            <span className="logo-sub">India Live Grid Intelligence</span>
          </div>
        </div>
      </div>

      {/* Search */}
      <form className="search-bar" onSubmit={handleSearch}>
        <span className="search-icon">🔍</span>
        <input
          type="text"
          placeholder="Search substations, lines, regions…"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        {query && (
          <button type="button" className="search-clear" onClick={() => { setQuery(''); if (onSearch) onSearch(''); }}>×</button>
        )}
      </form>

      {/* Live Status */}
      <div className="header-right">
        <div className="freq-badge" style={{ '--freq-color': freqColor }}>
          <span className="freq-dot" />
          <span className="freq-val">{freq.toFixed(2)} Hz</span>
          <span className="freq-label">GRID FREQ</span>
        </div>
        <div className="header-stat">
          <span className="stat-val">{((liveStats?.totalGeneration ?? 210000) / 1000).toFixed(1)} GW</span>
          <span className="stat-label">GENERATION</span>
        </div>
        <div className="header-stat">
          <span className="stat-val" style={{ color: '#4ade80' }}>{liveStats?.renewableShare ?? 42}%</span>
          <span className="stat-label">RENEWABLE</span>
        </div>
        <div className="live-badge">
          <span className="live-dot" />
          LIVE
        </div>

        {/* Auth controls */}
        {currentUser ? (
          <div className="header-user">
            <span className={`tier-pill-sm ${userTier}`}>{userTier.toUpperCase()}</span>
            <span className="header-email" title={currentUser.email}>
              {currentUser.email?.split('@')[0]}
            </span>
            <button className="header-signout" onClick={onSignOut} title="Sign out">↩</button>
          </div>
        ) : (
          <button className="header-signin-btn" onClick={onSignIn}>Sign In</button>
        )}
      </div>
    </header>
  );
}
