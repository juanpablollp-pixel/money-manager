import { useEffect } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { congelarPresupuestosVencidos } from './db/database';
import MenuOverlay from './components/MenuOverlay';
import Inicio from './pages/Inicio';
import Carteras from './pages/Carteras';
import Presupuestos from './pages/Presupuestos';
import Facturacion from './pages/Facturacion';
import Categorias from './pages/Categorias';
import Ajustes from './pages/Ajustes';
import './index.css';

export default function App() {
  useEffect(() => {
    congelarPresupuestosVencidos();
  }, []);

  return (
    <HashRouter>
      <AppProvider>
        <MenuOverlay />
        <Routes>
          <Route path="/" element={<Inicio />} />
          <Route path="/carteras" element={<Carteras />} />
          <Route path="/presupuestos" element={<Presupuestos />} />
          <Route path="/facturacion" element={<Facturacion />} />
          <Route path="/categorias" element={<Categorias />} />
          <Route path="/ajustes" element={<Ajustes />} />
        </Routes>
      </AppProvider>
    </HashRouter>
  );
}
