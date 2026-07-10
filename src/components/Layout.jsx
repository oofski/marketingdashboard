import { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, CheckSquare, Settings as SettingsIcon,
  UserCog, ListChecks, KeyRound, LogOut, Moon, Sun, RefreshCw, Download, Mail,
} from 'lucide-react';
import { useAuth, isAdmin } from '../contexts/AuthContext.jsx';
import { useTheme } from '../contexts/ThemeContext.jsx';
import { hasExternalUpdate, Settings as S } from '../services/db.js';
import { useUpdateStatus, useAppVersion } from '../services/updates.js';

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const admin = isAdmin(user);
  const version = useAppVersion();
  const { status: appUpdate, installUpdate } = useUpdateStatus();

  const company = S.get('company_name') || 'EBG';
  const subtitle = S.get('company_subtitle') || 'Onboarding';

  // When the shared database file is changed by another computer, prompt a
  // refresh so everyone is looking at current data.
  useEffect(() => {
    let active = true;
    async function check() {
      const changed = await hasExternalUpdate();
      if (active && changed) setUpdateAvailable(true);
    }
    // After the app auto-merges another computer's changes into ours, prompt a
    // refresh so the on-screen view reflects the combined result.
    const onMerged = () => { if (active) setUpdateAvailable(true); };
    window.addEventListener('focus', check);
    window.addEventListener('db-merged', onMerged);
    const interval = setInterval(check, 30000);
    return () => {
      active = false;
      window.removeEventListener('focus', check);
      window.removeEventListener('db-merged', onMerged);
      clearInterval(interval);
    };
  }, []);

  const navClass = ({ isActive }) => 'nav-item' + (isActive ? ' active' : '');

  function handleLogout() {
    logout();
    navigate('/');
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-brand-icon">{company.charAt(0).toUpperCase()}</div>
          <div>
            <div className="sidebar-brand-name">{company}</div>
            <div className="sidebar-brand-sub">{subtitle}</div>
          </div>
        </div>

        <NavLink to="/" end className={navClass}>
          <LayoutDashboard size={16} /> <span>Dashboard</span>
        </NavLink>
        <NavLink to="/my-tasks" className={navClass}>
          <CheckSquare size={16} /> <span>My Tasks</span>
        </NavLink>
        <NavLink to="/employees" className={navClass}>
          <Users size={16} /> <span>Employees</span>
        </NavLink>
        <NavLink to="/account" className={navClass}>
          <KeyRound size={16} /> <span>My Account</span>
        </NavLink>

        {admin && (
          <>
            <div className="nav-section">Admin</div>
            <NavLink to="/template" className={navClass}>
              <ListChecks size={16} /> <span>Checklist Template</span>
            </NavLink>
            <NavLink to="/staff" className={navClass}>
              <UserCog size={16} /> <span>Staff</span>
            </NavLink>
            <NavLink to="/notifications" className={navClass}>
              <Mail size={16} /> <span>Notifications</span>
            </NavLink>
            <NavLink to="/settings" className={navClass}>
              <SettingsIcon size={16} /> <span>Settings</span>
            </NavLink>
          </>
        )}

        <div className="sidebar-user">
          <div className="sidebar-user-name">{user.full_name}</div>
          <div className="sidebar-user-role">{user.role}</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-sm" onClick={() => window.location.reload()} title="Refresh data from the server">
              <RefreshCw size={14} />
            </button>
            <button className="btn btn-sm" onClick={toggle} title="Toggle light / dark">
              {theme === 'light' ? <Moon size={14} /> : <Sun size={14} />}
            </button>
            <button className="btn btn-sm" onClick={handleLogout} title="Sign out">
              <LogOut size={14} /> Sign out
            </button>
          </div>
          <div className="sidebar-version">
            <span>v{version}</span>
            {appUpdate.state === 'downloaded' && <span className="badge badge-accent">Update ready</span>}
            {appUpdate.state === 'downloading' && (
              <span>{appUpdate.percent ? `Updating ${appUpdate.percent}%` : 'Updating…'}</span>
            )}
          </div>
        </div>
      </aside>

      <main className="main">
        {appUpdate.state === 'downloaded' && (
          <div className="update-banner">
            <span>
              <Download size={14} /> A new version of the app is ready
              {appUpdate.newVersion ? ` (v${appUpdate.newVersion})` : ''}.
            </span>
            <button className="btn btn-sm btn-primary" onClick={installUpdate}>
              Restart to update
            </button>
          </div>
        )}
        {updateAvailable && (
          <div className="update-banner">
            <span>
              <RefreshCw size={14} /> Another computer updated the onboarding data.
            </span>
            <button className="btn btn-sm btn-primary" onClick={() => window.location.reload()}>
              Refresh now
            </button>
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
