import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  BarChart3,
  ChevronDown,
  Image as ImageIcon,
  LayoutDashboard,
  LayoutTemplate,
  Link2,
  LogOut,
  Mail,
  Menu,
  MousePointerClick,
  PenLine,
  ScrollText,
  Settings,
  ShieldPlus,
  Sparkles,
  UserMinus,
  X,
} from 'lucide-react';
import { logout } from '../api.js';
import { useApp } from '../context.js';
import { Brand } from './Brand.jsx';
import { Button } from './ui.jsx';

const NAV_GROUPS = [
  {
    label: 'Core',
    items: [
      { id: 'overview', label: 'Overview', icon: LayoutDashboard },
      { id: 'welcome', label: 'Welcome Settings', icon: Sparkles },
      { id: 'editor', label: 'Message Editor', icon: PenLine },
    ],
  },
  {
    label: 'Content',
    items: [
      { id: 'templates', label: 'Message Templates', icon: LayoutTemplate },
      { id: 'images', label: 'Welcome Images', icon: ImageIcon },
      { id: 'buttons', label: 'Button Manager', icon: MousePointerClick },
    ],
  },
  {
    label: 'Members',
    items: [
      { id: 'autoroles', label: 'Auto Roles', icon: ShieldPlus },
      { id: 'dm', label: 'DM Settings', icon: Mail },
      { id: 'leave', label: 'Leave Settings', icon: UserMinus },
    ],
  },
  {
    label: 'Growth',
    items: [
      { id: 'invites', label: 'Invite Tracking', icon: Link2 },
      { id: 'statistics', label: 'Statistics', icon: BarChart3 },
    ],
  },
  {
    label: 'System',
    items: [
      { id: 'logs', label: 'Logs', icon: ScrollText },
      { id: 'advanced', label: 'Advanced Settings', icon: Settings },
    ],
  },
];

const PAGE_TITLES = Object.fromEntries(NAV_GROUPS.flatMap((group) => group.items.map((item) => [item.id, item.label])));
const ALL_IDS = new Set(Object.keys(PAGE_TITLES));

function initials(value) {
  return String(value || 'A')
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export default function AppShell() {
  const { me, setMe } = useApp();
  const { guildId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [guildOpen, setGuildOpen] = useState(false);
  const guildRef = useRef(null);

  const guild = me.guilds.find((entry) => entry.id === guildId);
  const section = location.pathname.split('/')[3] || 'overview';

  useEffect(() => {
    const handle = (event) => {
      if (guildRef.current && !guildRef.current.contains(event.target)) setGuildOpen(false);
    };
    window.addEventListener('mousedown', handle);
    return () => window.removeEventListener('mousedown', handle);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  if (!guild) {
    return (
      <div className="no-access">
        <div className="no-access-card">
          <h1>Community not available</h1>
          <p>Your session can no longer manage this community. Choose another community or sign in again.</p>
          <div className="no-access-actions">
            <select
              className="input"
              defaultValue=""
              onChange={(event) => event.target.value && navigate(`/servers/${event.target.value}/overview`)}
            >
              <option value="">Select a community</option>
              {me.guilds.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name}
                </option>
              ))}
            </select>
            <Button
              variant="ghost"
              icon={LogOut}
              onClick={async () => {
                await logout();
                setMe(null);
              }}
            >
              Sign out
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const switchGuild = (id) => {
    const target = ALL_IDS.has(section) ? section : 'overview';
    navigate(`/servers/${id}/${target}`);
    setGuildOpen(false);
  };

  return (
    <div className="shell">
      <div className={menuOpen ? 'sidebar-backdrop visible' : 'sidebar-backdrop'} onClick={() => setMenuOpen(false)} />
      <aside className={menuOpen ? 'sidebar open' : 'sidebar'}>
        <div className="sidebar-top">
          <NavLink to={`/servers/${guildId}/overview`} className="sidebar-brand">
            <Brand />
          </NavLink>
          <button type="button" className="icon-btn sidebar-close" onClick={() => setMenuOpen(false)} aria-label="Close menu">
            <X size={18} />
          </button>
        </div>

        <div className="guild-switcher" ref={guildRef}>
          <button type="button" className={`guild-switch ${guildOpen ? 'open' : ''}`} onClick={() => setGuildOpen((value) => !value)}>
            <span className="guild-icon">
              {guild.icon ? <img src={guild.icon} alt="" /> : initials(guild.name)}
            </span>
            <span className="guild-meta">
              <span className="guild-name">{guild.name}</span>
              <span className="guild-count">{guild.memberCount?.toLocaleString() || 0} members</span>
            </span>
            <ChevronDown size={15} className="guild-caret" />
          </button>
          {guildOpen ? (
            <div className="guild-menu">
              <span className="guild-menu-label">Your communities</span>
              {me.guilds.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  className={entry.id === guildId ? 'guild-option active' : 'guild-option'}
                  onClick={() => switchGuild(entry.id)}
                >
                  <span className="guild-icon small">
                    {entry.icon ? <img src={entry.icon} alt="" /> : initials(entry.name)}
                  </span>
                  <span>{entry.name}</span>
                  <span className={`status-dot ${entry.botOnline ? 'online' : 'offline'}`} />
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <nav className="sidebar-nav">
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="nav-group">
              <span className="nav-label">{group.label}</span>
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.id}
                    to={`/servers/${guildId}/${item.id}`}
                    className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}
                  >
                    <Icon size={17} />
                    <span>{item.label}</span>
                    {item.id === 'welcome' && guild.botOnline === false ? <span className="nav-dot" title="Bot offline" /> : null}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className={`bot-card ${guild.botOnline ? 'online' : 'offline'}`}>
            <span className={`status-dot ${guild.botOnline ? 'online' : 'offline'}`} />
            <div>
              <strong>{guild.botOnline ? 'Aurora connected' : 'Aurora offline'}</strong>
              <span>{guild.botOnline ? 'Gateway live · changes apply instantly' : 'Dashboard-only mode · connect the bot token'}</span>
            </div>
          </div>
          <div className="sidebar-version">Aurora Welcome · v1.0</div>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="topbar-left">
            <button type="button" className="icon-btn menu-btn" onClick={() => setMenuOpen(true)} aria-label="Open menu">
              <Menu size={19} />
            </button>
            <div className="breadcrumb">
              <span>{guild.name}</span>
              <span className="crumb-sep">/</span>
              <strong>{PAGE_TITLES[section] || 'Overview'}</strong>
            </div>
          </div>
          <div className="topbar-right">
            <span className={`connection-pill ${guild.botOnline ? 'online' : 'offline'}`}>
              <span className={`status-dot ${guild.botOnline ? 'online' : 'offline'}`} />
              {guild.botOnline ? 'Connected' : 'Offline'}
            </span>
            <div className="user-chip">
              <span className="user-avatar">
                {me.user.avatarUrl ? <img src={me.user.avatarUrl} alt="" /> : initials(me.user.globalName || me.user.username)}
              </span>
              <span className="user-meta">
                <strong>{me.user.globalName || me.user.username}</strong>
                <span>{me.user.isDev ? 'Developer session' : 'Server manager'}</span>
              </span>
            </div>
            <button
              type="button"
              className="icon-btn"
              title="Sign out"
              onClick={async () => {
                await logout();
                setMe(null);
              }}
            >
              <LogOut size={17} />
            </button>
          </div>
        </header>
        <main className="page">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
