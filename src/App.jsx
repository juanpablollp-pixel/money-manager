import { HashRouter, Routes, Route } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import BottomNav from './components/BottomNav';
import Inicio from './pages/Inicio';
import Carteras from './pages/Carteras';
import Presupuestos from './pages/Presupuestos';
import Facturacion from './pages/Facturacion';
import Ajustes from './pages/Ajustes';
import './index.css';

export default function App() {
  return (
    <HashRouter>
      <AppProvider>
        <div className="app-shell">
          <div className="app-content">
            <Routes>
              <Route path="/" element={<Inicio />} />
              <Route path="/carteras" element={<Carteras />} />
              <Route path="/presupuestos" element={<Presupuestos />} />
              <Route path="/facturacion" element={<Facturacion />} />
              <Route path="/ajustes" element={<Ajustes />} />
            </Routes>
          </div>
          <BottomNav />
        </div>
      </AppProvider>
    </HashRouter>
  );
}
