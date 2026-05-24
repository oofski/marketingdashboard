import { createContext, useContext, useEffect, useState } from 'react';
import { Users, Audit, hashPassword } from '../services/db.js';

const AuthContext = createContext(null);

const SESSION_KEY = 'dental_clinic_session';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setUser(parsed);
      } catch {
        sessionStorage.removeItem(SESSION_KEY);
      }
    }
    setLoaded(true);
  }, []);

  async function login(username, password) {
    const record = Users.findByUsername(username);
    if (!record) {
      return { ok: false, error: 'Invalid username or password' };
    }
    const hash = await hashPassword(password);
    if (hash !== record.password_hash) {
      Audit.log({ username, action: 'login_failed' });
      return { ok: false, error: 'Invalid username or password' };
    }
    const userObj = {
      id: record.id,
      username: record.username,
      full_name: record.full_name,
      role: record.role,
    };
    setUser(userObj);
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(userObj));
    Audit.log({ user_id: userObj.id, username: userObj.username, action: 'login' });
    return { ok: true };
  }

  function logout() {
    if (user) {
      Audit.log({ user_id: user.id, username: user.username, action: 'logout' });
    }
    setUser(null);
    sessionStorage.removeItem(SESSION_KEY);
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
