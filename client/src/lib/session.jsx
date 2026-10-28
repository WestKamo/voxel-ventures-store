import { createContext, useContext, useEffect, useState } from 'react';
import { api, refreshSession } from './api';
const Context = createContext(null);
export function SessionProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    api('/auth/me')
      .catch(() => refreshSession())
      .then((u) => {
        if (active) setUser(u);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <Context.Provider
      value={{
        user,
        setUser,
        loading,
        async logout() {
          await api('/auth/logout', { method: 'POST' });
          setUser(null);
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}
export const useSession = () => useContext(Context);
