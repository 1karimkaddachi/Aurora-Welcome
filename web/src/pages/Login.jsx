import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Image as ImageIcon, Layers, Link2, Loader2, ShieldCheck, Sparkles } from 'lucide-react';
import { devLogin } from '../api.js';
import { Brand } from '../components/Brand.jsx';

const FEATURES = [
  { icon: Layers, title: 'Components V2 native', text: 'Containers, sections, galleries and buttons — no embeds.' },
  { icon: Sparkles, title: 'Live visual editor', text: 'Every change renders in a real Discord preview instantly.' },
  { icon: ImageIcon, title: 'Canvas banners', text: 'Dynamic welcome images generated in a worker pool per join.' },
  { icon: Link2, title: 'Invite intelligence', text: 'Attribution, leaderboards and abuse heuristics.' },
];

export default function Login({ config }) {
  const [params] = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const oauthError = params.get('error');

  const handleDev = async () => {
    setBusy(true);
    setError(null);
    try {
      await devLogin();
      window.location.reload();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-orb orb-one" />
      <div className="login-orb orb-two" />
      <section className="login-hero">
        <Brand />
        <div className="login-headline">
          <span className="page-eyebrow">Premium onboarding for Discord</span>
          <h1>
            Every arrival,
            <br />
            <span>unforgettable.</span>
          </h1>
          <p>
            Aurora Welcome is a complete onboarding studio: Components V2 messages, live previews, generated banners,
            invite attribution and audit-grade logs — in one connected system.
          </p>
        </div>
        <div className="login-features">
          {FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <div key={feature.title} className="login-feature">
                <span className="login-feature-icon">
                  <Icon size={18} />
                </span>
                <div>
                  <strong>{feature.title}</strong>
                  <span>{feature.text}</span>
                </div>
              </div>
            );
          })}
        </div>
        <div className="login-trust">
          <ShieldCheck size={15} /> OAuth2 with Manage Server verification
          <span className="dot-sep" />
          <CheckCircle2 size={15} /> No message content access
        </div>
      </section>

      <section className="login-panel">
        <div className="login-card">
          <div className="login-card-head">
            <span className="login-badge">Welcome back</span>
            <h2>Sign in to Aurora</h2>
            <p>Connect the Discord account that manages your community.</p>
          </div>

          {oauthError ? (
            <div className="login-alert">
              {oauthError === 'oauth_not_configured'
                ? 'Discord OAuth is not configured yet. Add DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET to .env.'
                : `Discord sign-in failed: ${decodeURIComponent(oauthError)}`}
            </div>
          ) : null}
          {error ? <div className="login-alert">{error}</div> : null}

          {config?.oauthConfigured ? (
            <a className="btn btn-discord btn-lg login-cta" href="/auth/login">
              <DiscordGlyph /> Continue with Discord <ArrowRight size={16} />
            </a>
          ) : (
            <div className="login-setup">
              <strong>OAuth2 setup required</strong>
              <span>
                Set <code>DISCORD_CLIENT_ID</code>, <code>DISCORD_CLIENT_SECRET</code> and the redirect
                <code> {config?.dashboardUrl || 'http://localhost:3000'}/auth/callback</code> in the Discord Developer
                Portal.
              </span>
            </div>
          )}

          {config?.devAuth ? (
            <>
              <div className="login-divider">
                <span>Local development</span>
              </div>
              <button type="button" className="btn btn-secondary btn-lg login-cta" onClick={handleDev} disabled={busy}>
                {busy ? <Loader2 size={16} className="spin" /> : <Sparkles size={16} />}
                {busy ? 'Opening developer session…' : 'Enter with developer access'}
              </button>
              <p className="login-note">Developer sign-in is enabled in this environment and can only access seeded communities.</p>
            </>
          ) : null}

          <div className="login-foot">
            <span className="status-dot online" /> Aurora is ready
            <span className="dot-sep" />
            v{config?.version || '1.0.0'}
          </div>
        </div>
        <p className="login-legal">By signing in you agree to the server’s onboarding configuration and Discord’s API terms.</p>
      </section>
    </div>
  );
}

function DiscordGlyph() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.056 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 5.994-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  );
}
