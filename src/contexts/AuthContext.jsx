import { createContext, useContext, useEffect, useState } from 'react';
import { login as cloudLogin, reloadMirror, clearMirror, Audit } from '../services/db.js';
import { setToken, getToken } from '../services/api.js';

const AuthContext = createContext(null);
const SESSION_KEY = 'onboarding_tracker_session';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loaded, setLoaded] = useState(false);

  // On launch, if we still have a saved session + token, load this session's
  // data from the server. If the token is expired/invalid, fall back to login.
  useEffect(() => {
    let active = true;
    (async () => {
      const stored = sessionStorage.getItem(SESSION_KEY);
      const token = getToken();
      if (stored && token) {
        try {
          await reloadMirror();
          if (active) setUser(JSON.parse(stored));
        } catch {
          setToken(null);
          sessionStorage.removeItem(SESSION_KEY);
        }
      }
      if (active) setLoaded(true);
    })();
    return () => { active = false; };
  }, []);

  async function login(username, password) {
    try {
      const u = await cloudLogin(username, password);
      setUser(u);
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(u));
      Audit.log({ user_id: u.id, username: u.username, action: 'login' });
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message || 'Invalid username or password' };
    }
  }

  function logout() {
    if (user) Audit.log({ user_id: user.id, username: user.username, action: 'logout' });
    clearMirror();
    setToken(null);
    sessionStorage.removeItem(SESSION_KEY);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, loaded }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export function canManageEmployees(user) {
  return user && (user.role === 'admin' || user.role === 'manager');
}

export function isAdmin(user) {
  return user && user.role === 'admin';
}
