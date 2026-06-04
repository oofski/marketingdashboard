import { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, CheckSquare, Settings as SettingsIcon,
  UserCog, ListChecks, KeyRound, HardDrive, LogOut, Moon, Sun, RefreshCw,
} from 'lucide-react';
import { useAuth, isAdmin } from '../contexts/AuthContext.jsx';
import { useTheme } from '../contexts/ThemeContext.jsx';
import { hasExternalUpdate, Settings as S } from '../services/db.js';

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [localData, setLocalData] = useState(false);
  const admin = isAdmin(user);

  const company = S.get('company_name') || 'Neroli';
  const subtitle = S.get('company_subtitle') || 'Onboarding';

  // When the shared database file is changed by another computer, prompt a
  // refresh so everyone is looking at current data.
  useEffect(() => {
    let active = true;
    async function check() {
      const changed = await hasExternalUpdate();
      if (active && changed) setUpdateAvailable(true);
    }
    window.addEventListener('focus', check);
    const interval = setInterval(check, 30000);
    return () => {
      active = false;
      window.removeEventListener('focus', check);
      clearInterval(interval);
    };
  }, []);

  // Detect whether this computer is on its own local database (not shared),
  // which is the usual reason new employees "don't show up" on other PCs.
  useEffect(() => {
    if (typeof window !== 'undefined' && window.electronAPI?.isElectron) {
      window.electronAPI.dbInfo().then((info) => setLocalData(info && !info.isCustom));
    }
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
            <NavLink to="/settings" className={navClass}>
              <SettingsIcon size={16} /> <span>Settings</span>
            </NavLink>
          </>
        )}

        <div className="sidebar-user">
          <div className="sidebar-user-name">{user.full_name}</div>
          <div className="sidebar-user-role">{user.role}</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-sm" onClick={toggle} title="Toggle light / dark">
              {theme === 'light' ? <Moon size={14} /> : <Sun size={14} />}
            </button>
            <button className="btn btn-sm" onClick={handleLogout} title="Sign out">
              <LogOut size={14} /> Sign out
            </button>
          </div>
        </div>
      </aside>

      <main className="main">
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
        {admin && localData && (
          <div className="update-banner warn">
            <span>
              <HardDrive size={14} /> This computer is using its own local data, so employees you add
              here won't appear on other computers. Point everyone at one shared folder to fix this.
            </span>
            <button className="btn btn-sm btn-primary" onClick={() => navigate('/settings')}>
              Set shared folder
            </button>
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
