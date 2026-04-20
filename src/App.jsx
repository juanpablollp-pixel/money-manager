import { HashRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import BottomNav from './components/BottomNav';
import Inicio from './pages/Inicio';
import Carteras from './pages/Carteras';
import Presupuestos from './pages/Presupuestos';
import Facturacion from './pages/Facturacion';
import Ajustes from './pages/Ajustes';
import './index.css';

const ROUTE_LABELS = {
  '/carteras':     'Carteras',
  '/presupuestos': 'Presupuestos',
  '/facturacion':  'Facturación',
  '/ajustes':      'Ajustes',
};

function HomeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  );
}

function GearIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
    </svg>
  );
}

function Topbar() {
  const location = useLocation();
  const navigate  = useNavigate();
  const isHome    = location.pathname === '/';
  const label     = ROUTE_LABELS[location.pathname];

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <div className="topbar-brand">
          <div className="topbar-brand-line" />
          <span className="topbar-logo-text">MoneyManager</span>
        </div>

        {label && <span className="topbar-section-label">{label}</span>}

        <div className="topbar-actions">
          <button
            className={`topbar-action${isHome ? ' active' : ''}`}
            onClick={() => navigate('/')}
            aria-label="Inicio"
          >
            <HomeIcon />
          </button>
          <button
            className={`topbar-action${location.pathname === '/ajustes' ? ' active' : ''}`}
            onClick={() => navigate('/ajustes')}
            aria-label="Ajustes"
          >
            <GearIcon />
          </button>
        </div>
      </div>
    </header>
  );
}

export default function App() {
  return (
    <HashRouter>
      <AppProvider>
        <div className="app">
          <Topbar />
          <main className="main-content">
            <Routes>
              <Route path="/"             element={<Inicio />}      />
              <Route path="/carteras"     element={<Carteras />}    />
              <Route path="/presupuestos" element={<Presupuestos />}/>
              <Route path="/facturacion"  element={<Facturacion />} />
              <Route path="/ajustes"      element={<Ajustes />}     />
            </Routes>
          </main>
          <BottomNav />
        </div>
      </AppProvider>
    </HashRouter>
  );
}
