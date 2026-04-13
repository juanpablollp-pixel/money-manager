import { useApp } from '../context/AppContext';
import { useNavigate } from 'react-router-dom';
import { Home } from 'lucide-react';
import Header from './Header';

const items = [
  { label: 'Carteras', to: '/carteras' },
  { label: 'Presupuestos', to: '/presupuestos' },
  { label: 'Facturación', to: '/facturacion' },
  { label: 'Categorías', to: '/categorias' },
  { label: 'Ajustes', to: '/ajustes' },
];

export default function MenuOverlay() {
  const { menuOpen, menuClosing, closeMenu } = useApp();
  const navigate = useNavigate();

  if (!menuOpen && !menuClosing) return null;

  const go = (to) => {
    closeMenu();
    setTimeout(() => navigate(to), 220);
  };

  return (
    <div className={`menu-overlay${menuClosing ? ' closing' : ''}`}>
      <Header title="Menú Principal" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
        {items.map(i => (
          <button key={i.to} className="menu-item" onClick={() => go(i.to)}>
            {i.label}
          </button>
        ))}
      </div>
      <div style={{ marginTop: 'auto', paddingTop: 24 }}>
        <button className="btn-main negro full" onClick={() => go('/')}>
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Home size={18} /> Inicio
          </span>
        </button>
      </div>
    </div>
  );
}
