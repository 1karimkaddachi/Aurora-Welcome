import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, Route, Routes, Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Loader2, ServerCog } from 'lucide-react';
import { apiGet } from './api.js';
import { AppContext } from './context.js';
import AppShell from './components/AppShell.jsx';
import { Brand } from './components/Brand.jsx';
import { Button, Card, EmptyState } from './components/ui.jsx';
import Login from './pages/Login.jsx';
import Overview from './pages/Overview.jsx';
import WelcomeSettings from './pages/WelcomeSettings.jsx';
import MessageEditor from './pages/MessageEditor.jsx';
import Templates from './pages/Templates.jsx';
import Images from './pages/Images.jsx';
import Buttons from './pages/Buttons.jsx';
import AutoRoles from './pages/AutoRoles.jsx';
import DmSettings from './pages/DmSettings.jsx';
import InviteTracking from './pages/InviteTracking.jsx';
import LeaveSettings from './pages/LeaveSettings.jsx';
import Logs from './pages/Logs.jsx';
import Statistics from './pages/Statistics.jsx';
import Advanced from './pages/Advanced.jsx';

function Splash({ label = 'Preparing your workspace' }) {
  return (
    <div className="splash">
      <Brand />
      <div className="splash-loader">
        <Loader2 size={18} className="spin" />
        {label}
      </div>
    </div>
  );
}

function Fatal({ error, onRetry }) {
  return (
    <div className="splash">
      <Brand />
      <div className="fatal-card">
        <AlertTriangle size={20} />
        <div>
          <strong>Aurora could not start the dashboard session</strong>
          <span>{error?.message || 'The server returned an unexpected response.'}</span>
        </div>
      </div>
      <Button variant="primary" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}

function Onboarding({ me, config }) {
  const inviteUrl = config?.clientId
    ? `https://discord.com/oauth2/authorize?client_id=${config.clientId}&permissions=268520448&scope=bot%20applications.commands`
    : null;
  return (
    <div className="onboarding">
      <Brand />
      <Card title="Add Aurora to a community" subtitle="Aurora can only appear here for servers where you have Manage Server and the bot is present.">
        <div className="onboarding-steps">
          <div className="onboarding-step">
            <span>01</span>
            <div>
              <strong>Invite the bot</strong>
              <p>Use the invite link with the required permissions for welcome messages, roles and threads.</p>
              {inviteUrl ? (
                <a className="btn btn-primary" href={inviteUrl} target="_blank" rel="noreferrer">
                  Add to Discord <ArrowRight size={15} />
                </a>
              ) : (
                <p className="muted">Set DISCORD_CLIENT_ID to generate an invite link.</p>
              )}
            </div>
          </div>
          <div className="onboarding-step">
            <span>02</span>
            <div>
              <strong>Refresh access</strong>
              <p>Aurora detects new communities as soon as the bot joins and your permissions are verified.</p>
              <Button variant="secondary" onClick={() => window.location.reload()}>
                Refresh dashboard
              </Button>
            </div>
          </div>
          <div className="onboarding-step">
            <span>03</span>
            <div>
              <strong>Developer demo</strong>
              <p>Testing locally? Run <code>npm run seed:dev</code> and enable <code>ALLOW_DEV_AUTH</code>.</p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

function NotFound() {
  const navigate = useNavigate();
  return (
    <Card>
      <EmptyState
        icon={ServerCog}
        title="This page does not exist"
        description="The dashboard section you requested is not available."
        action={
          <Button variant="primary" onClick={() => navigate('/')}>
            Return to overview
          </Button>
        }
      />
    </Card>
  );
}

export default function App() {
  const [config, setConfig] = useState(null);
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const publicConfig = await apiGet('/config').catch(() => null);
        if (cancelled) return;
        setConfig(publicConfig);
        try {
          const session = await apiGet('/me');
          if (!cancelled) setMe(session);
        } catch (sessionError) {
          if (sessionError.status === 401) {
            if (!cancelled) setMe(null);
          } else {
            throw sessionError;
          }
        }
      } catch (loadError) {
        if (!cancelled) setError(loadError);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const refreshMe = useCallback(async () => {
    const session = await apiGet('/me');
    setMe(session);
    return session;
  }, []);

  const context = useMemo(() => ({ config, me, setMe, refreshMe }), [config, me, refreshMe]);

  if (loading) return <Splash />;
  if (error) return <Fatal error={error} onRetry={() => setAttempt((value) => value + 1)} />;

  if (!me) {
    return (
      <Routes>
        <Route path="/login" element={<Login config={config} />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  const firstGuild = me.guilds[0]?.id;

  return (
    <AppContext.Provider value={context}>
      <Routes>
        <Route path="/login" element={<Navigate to={firstGuild ? `/servers/${firstGuild}/overview` : '/onboarding'} replace />} />
        <Route path="/onboarding" element={firstGuild ? <Navigate to={`/servers/${firstGuild}/overview`} replace /> : <Onboarding me={me} config={config} />} />
        <Route path="/" element={<Navigate to={firstGuild ? `/servers/${firstGuild}/overview` : '/onboarding'} replace />} />
        <Route path="/servers/:guildId" element={<AppShell />}>
          <Route index element={<Navigate to="overview" replace />} />
          <Route path="overview" element={<Overview />} />
          <Route path="welcome" element={<WelcomeSettings />} />
          <Route path="editor" element={<MessageEditor />} />
          <Route path="templates" element={<Templates />} />
          <Route path="images" element={<Images />} />
          <Route path="buttons" element={<Buttons />} />
          <Route path="autoroles" element={<AutoRoles />} />
          <Route path="dm" element={<DmSettings />} />
          <Route path="leave" element={<LeaveSettings />} />
          <Route path="invites" element={<InviteTracking />} />
          <Route path="statistics" element={<Statistics />} />
          <Route path="logs" element={<Logs />} />
          <Route path="advanced" element={<Advanced />} />
          <Route path="*" element={<NotFound />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppContext.Provider>
  );
}
