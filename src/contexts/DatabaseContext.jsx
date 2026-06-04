import { createContext, useContext, useEffect, useState } from 'react';
import { initDatabase } from '../services/db.js';

const DatabaseContext = createContext({ ready: false, error: null });

export function DatabaseProvider({ children }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    initDatabase()
      .then(() => setReady(true))
      .catch((e) => {
        console.error('DB init failed', e);
        setError(e);
      });
  }, []);

  if (error) {
    return (
      <div style={{ padding: 40, fontFamily: 'sans-serif' }}>
        <h2>Database error</h2>
        <p>The onboarding database could not be opened. If you use a shared network
           folder, make sure the folder is reachable, then reopen the app.</p>
        <pre>{error.message}</pre>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="boot-screen">
        <div className="boot-spinner" />
        <div>Loading onboarding database…</div>
      </div>
    );
  }

  return (
    <DatabaseContext.Provider value={{ ready }}>
      {children}
    </DatabaseContext.Provider>
  );
}

export function useDatabase() {
  return useContext(DatabaseContext);
}
