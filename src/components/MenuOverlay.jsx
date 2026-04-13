import { useApp } from '../context/AppContext';
import { useNavigate } from 'react-router-dom';
import Header from './Header';

function IconHome() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
    </svg>
  );
}

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
            <IconHome /> Inicio
          </span>
        </button>
      </div>
    </div>
  );
}
