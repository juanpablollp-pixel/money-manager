import { createContext, useContext, useState, useCallback, useRef } from 'react';

const AppContext = createContext();

export function AppProvider({ children }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuClosing, setMenuClosing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const closeTimerRef = useRef(null);

  const triggerRefresh = useCallback(() => setRefreshKey(k => k + 1), []);

  const closeMenu = useCallback(() => {
    setMenuClosing(true);
    clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => {
      setMenuOpen(false);
      setMenuClosing(false);
    }, 220);
  }, []);

  return (
    <AppContext.Provider value={{ menuOpen, setMenuOpen, menuClosing, closeMenu, refreshKey, triggerRefresh }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
