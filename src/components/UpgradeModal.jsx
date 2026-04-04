export default function UpgradeModal({ onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-icon">⚡</span>
          <button className="ip-close" onClick={onClose}>✕</button>
        </div>

        <h2 className="modal-title">Unlock Full India Grid</h2>
        <p className="modal-sub">Free tier covers NR + WR regions, 400kV+ lines, 15-min IEX data.</p>

        <div className="modal-tiers">
          {/* Free */}
          <div className="tier-card current">
            <div className="tier-badge free">FREE</div>
            <div className="tier-price">₹0<span>/mo</span></div>
            <ul className="tier-features">
              <li>✓ Northern Region (NR)</li>
              <li>✓ Western Region (WR)</li>
              <li>✓ 400kV + 220kV + 132kV lines</li>
              <li>✓ IEX DAM prices (15-min)</li>
              <li>✓ POSOCO frequency</li>
              <li className="locked">✗ SR / ER / NER regions</li>
              <li className="locked">✗ HVDC corridors</li>
              <li className="locked">✗ Real-time &lt;5min refresh</li>
              <li className="locked">✗ LMP alerts & API access</li>
            </ul>
            <div className="tier-cta-current">Current Plan</div>
          </div>

          {/* Pro */}
          <div className="tier-card highlight">
            <div className="tier-badge pro">PRO</div>
            <div className="tier-price">₹25,999<span>/mo</span></div>
            <ul className="tier-features">
              <li>✓ All 5 PGCIL regions</li>
              <li>✓ All voltage levels incl. HVDC</li>
              <li>✓ 5-min IEX RTM prices</li>
              <li>✓ Real-time POSOCO frequency</li>
              <li>✓ N-1 contingency alerts</li>
              <li>✓ LMP email/webhook alerts</li>
              <li>✓ REST API access</li>
              <li>✓ Line flow % overlay</li>
            </ul>
            <a href="mailto:amanrsharma00@gmail.com?subject=GridIntelin Pro" className="tier-cta-pro" target="_blank">
              Get Pro Access →
            </a>
          </div>

          {/* Enterprise */}
          <div className="tier-card">
            <div className="tier-badge enterprise">ENTERPRISE</div>
            <div className="tier-price">Custom</div>
            <ul className="tier-features">
              <li>✓ Everything in Pro</li>
              <li>✓ White-label deployment</li>
              <li>✓ CRR position tracking</li>
              <li>✓ N-1 / N-2 analysis</li>
              <li>✓ SCADA integration</li>
              <li>✓ Dedicated SLA support</li>
              <li>✓ Custom region configuration</li>
            </ul>
            <a href="mailto:amanrsharma00@gmail.com?subject=GridIntelin Enterprise" className="tier-cta-pro" target="_blank">
              Contact Sales →
            </a>
          </div>
        </div>

        <p className="modal-note">
          First in India — real-time transmission map with IEX LMP + POSOCO data.
        </p>
      </div>
    </div>
  );
}
