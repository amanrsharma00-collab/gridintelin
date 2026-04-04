import { useState } from 'react';

export default function AuthModal({ supabase, onClose, onAuth }) {
  const [mode, setMode]         = useState('signin'); // 'signin' | 'signup'
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      let result;
      if (mode === 'signin') {
        result = await supabase.auth.signInWithPassword({ email, password });
      } else {
        result = await supabase.auth.signUp({ email, password });
        if (!result.error && result.data?.user) {
          setSuccess('Check your email to confirm your account, then sign in.');
          setLoading(false);
          return;
        }
      }

      if (result.error) {
        setError(result.error.message);
      } else if (result.data?.user) {
        onAuth?.(result.data.user);
        onClose();
      }
    } catch (err) {
      setError('Unexpected error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError('');
    setLoading(true);
    const { error: oauthErr } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (oauthErr) {
      setError(oauthErr.message);
      setLoading(false);
    }
    // Google OAuth will redirect — no further action needed here
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box auth-box" onClick={e => e.stopPropagation()}>

        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="modal-icon">⚡</span>
            <span style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 15 }}>
              {mode === 'signin' ? 'Sign In' : 'Create Account'}
            </span>
          </div>
          <button className="ip-close" onClick={onClose}>✕</button>
        </div>

        <p className="modal-sub" style={{ marginTop: 4, marginBottom: 16 }}>
          {mode === 'signin'
            ? 'Sign in to access your GridIntelin subscription.'
            : 'Create a free account to get started.'}
        </p>

        {/* Google OAuth */}
        <button
          className="auth-google-btn"
          onClick={handleGoogle}
          disabled={loading}
        >
          <svg width="18" height="18" viewBox="0 0 48 48" style={{ marginRight: 8 }}>
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>
          Continue with Google
        </button>

        <div className="auth-divider"><span>or</span></div>

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
            />
          </div>
          <div className="auth-field">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              minLength={8}
              required
            />
          </div>

          {error   && <div className="auth-error">{error}</div>}
          {success && <div className="auth-success">{success}</div>}

          <button type="submit" className="auth-submit-btn" disabled={loading}>
            {loading ? 'Please wait…' : mode === 'signin' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div className="auth-switch">
          {mode === 'signin' ? (
            <>Don't have an account?{' '}
              <button onClick={() => { setMode('signup'); setError(''); setSuccess(''); }}>Sign up free</button>
            </>
          ) : (
            <>Already have an account?{' '}
              <button onClick={() => { setMode('signin'); setError(''); setSuccess(''); }}>Sign in</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
