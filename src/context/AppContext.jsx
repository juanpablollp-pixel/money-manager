import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { estadoBackup } from '../db/database';

const AppContext = createContext();

export function AppProvider({ children }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuClosing, setMenuClosing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [avisoBackup, setAvisoBackup] = useState({ mostrar: false, cambios: 0, diasSinBackup: null, ultimoBackup: null });
  const closeTimerRef = useRef(null);

  useEffect(() => {
    estadoBackup().then(setAvisoBackup);
  }, [refreshKey]);

  const now = new Date();
  const [periodo, setPeriodo] = useState({ mes: now.getMonth() + 1, anio: now.getFullYear() });

  const triggerRefresh = useCallback(() => setRefreshKey(k => k + 1), []);

  const closeMenu = useCallback(() => {
    setMenuClosing(true);
    clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => {
      setMenuOpen(false);
      setMenuClosing(false);
    }, 220);
  }, []);

  function periodoAnterior() {
    setPeriodo(p => p.mes === 1 ? { mes: 12, anio: p.anio - 1 } : { mes: p.mes - 1, anio: p.anio });
  }

  function periodoSiguiente() {
    const n = new Date();
    const mesHoy = n.getMonth() + 1;
    const anioHoy = n.getFullYear();
    setPeriodo(p => {
      if (p.anio > anioHoy || (p.anio === anioHoy && p.mes >= mesHoy)) return p;
      return p.mes === 12 ? { mes: 1, anio: p.anio + 1 } : { mes: p.mes + 1, anio: p.anio };
    });
  }

  const n2 = new Date();
  const esPeriodoActual = periodo.mes === n2.getMonth() + 1 && periodo.anio === n2.getFullYear();

  return (
    <AppContext.Provider value={{ menuOpen, setMenuOpen, menuClosing, closeMenu, refreshKey, triggerRefresh, periodo, periodoAnterior, periodoSiguiente, esPeriodoActual, avisoBackup }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
