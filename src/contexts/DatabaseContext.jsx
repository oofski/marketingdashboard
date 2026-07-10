import { createContext, useContext } from 'react';

// The app now loads its data from the cloud after sign-in (see AuthContext),
// so there's no local database to open at startup. This stays as a thin
// provider so the rest of the app's structure is unchanged.
const DatabaseContext = createContext({ ready: true });

export function DatabaseProvider({ children }) {
  return (
    <DatabaseContext.Provider value={{ ready: true }}>
      {children}
    </DatabaseContext.Provider>
  );
}

export function useDatabase() {
  return useContext(DatabaseContext);
}
