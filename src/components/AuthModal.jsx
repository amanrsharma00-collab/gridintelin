import { useState } from 'react';

async function logEvent(eventType, email, success, userId = null, error = null) {
  try {
    await fetch('/api/log-auth-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_type: eventType, email, success, user_id: userId, error }),
    });
  } catch {}
}

export default function AuthModal({ supabase, onClose, onAuth }) {
  const [mode, setMode]         = useState('signin');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!supabase) {
      setError('Auth not configured. Contact support.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'signin') {
        const { data, error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) {
          logEvent('failed_sign_in', email, false, null, err.message);
          setError(err.message);
        } else {
          logEvent('sign_in', email, true, data.user.id);
          onAuth?.(data.user);
          onClose();
        }
      } else {
        const { data, error: err } = await supabase.auth.signUp({ email, password });
        if (err) {
          logEvent('failed_sign_in', email, false, null, err.message);
          setError(err.message);
        } else if (data.user && !data.user.email_confirmed_at) {
          logEvent('sign_up', email, true, data.user.id);
          setSuccess('Account created! Check your email to confirm, then sign in.');
          setMode('signin');
        } else if (data.user) {
          // Auto-confirm is on — sign them in immediately
          logEvent('sign_up', email, true, data.user.id);
          onAuth?.(data.user);
          onClose();
        }
      }
    } catch {
      setError('Unexpected error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box auth-box" onClick={e => e.stopPropagation()}>

        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="modal-icon">⚡</span>
            <span style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 15 }}>
              {mode === 'signin' ? 'Sign In to GridIntelin' : 'Create Free Account'}
            </span>
          </div>
          <button className="ip-close" onClick={onClose}>✕</button>
        </div>

        <p className="modal-sub" style={{ marginTop: 4, marginBottom: 20 }}>
          {mode === 'signin'
            ? 'Enter your credentials to access your subscription.'
            : 'Free account gives you NR + WR regions and live data.'}
        </p>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="auth-field">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
              autoFocus
              autoComplete="email"
            />
          </div>
          <div className="auth-field">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              minLength={6}
              required
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            />
          </div>

          {error   && <div className="auth-error">{error}</div>}
          {success && <div className="auth-success">{success}</div>}

          <button type="submit" className="auth-submit-btn" disabled={loading || !supabase}>
            {loading ? 'Please wait…' : mode === 'signin' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div className="auth-switch">
          {mode === 'signin' ? (
            <>Don&apos;t have an account?{' '}
              <button onClick={() => { setMode('signup'); setError(''); setSuccess(''); }}>
                Sign up free
              </button>
            </>
          ) : (
            <>Already have an account?{' '}
              <button onClick={() => { setMode('signin'); setError(''); setSuccess(''); }}>
                Sign in
              </button>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
