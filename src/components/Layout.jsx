import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, FolderArchive, Settings as SettingsIcon,
  UserCog, LogOut, Moon, Sun,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useTheme } from '../contexts/ThemeContext.jsx';

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();

  const navClass = ({ isActive }) => 'nav-item' + (isActive ? ' active' : '');

  function handleLogout() {
    logout();
    navigate('/');
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-brand-icon">D</div>
          <div>
            <div className="sidebar-brand-name">Dental Clinic</div>
            <div className="sidebar-brand-sub">Manager</div>
          </div>
        </div>

        <NavLink to="/" end className={navClass}>
          <LayoutDashboard size={16} /> <span>Dashboard</span>
        </NavLink>
        <NavLink to="/patients" className={navClass}>
          <Users size={16} /> <span>Patients</span>
        </NavLink>
        <NavLink to="/archive" className={navClass}>
          <FolderArchive size={16} /> <span>Documents</span>
        </NavLink>

        <div className="nav-section">Admin</div>
        <NavLink to="/users" className={navClass}>
          <UserCog size={16} /> <span>Users</span>
        </NavLink>
        <NavLink to="/settings" className={navClass}>
          <SettingsIcon size={16} /> <span>Settings</span>
        </NavLink>

        <div className="sidebar-user">
          <div className="sidebar-user-name">{user.full_name}</div>
          <div className="sidebar-user-role">{user.role}</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-sm" onClick={toggle} title="Toggle theme">
              {theme === 'light' ? <Moon size={14} /> : <Sun size={14} />}
            </button>
            <button className="btn btn-sm" onClick={handleLogout} title="Sign out">
              <LogOut size={14} /> Sign out
            </button>
          </div>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
