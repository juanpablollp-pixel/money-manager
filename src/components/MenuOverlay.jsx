import { useApp } from '../context/AppContext';
import { useNavigate } from 'react-router-dom';
import Header from './Header';

const items = [
  { label: 'Carteras', to: '/carteras' },
  { label: 'Presupuestos', to: '/presupuestos' },
  { label: 'Categorías', to: '/categorias' },
  { label: 'Ajustes', to: '/ajustes' },
];

export default function MenuOverlay() {
  const { menuOpen, setMenuOpen } = useApp();
  const navigate = useNavigate();

  if (!menuOpen) return null;

  const go = (to) => { setMenuOpen(false); navigate(to); };

  return (
    <div className="menu-overlay">
      <Header title="Menú Principal" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
        {items.map(i => (
          <button key={i.to} className="menu-item" onClick={() => go(i.to)}>
            {i.label}
          </button>
        ))}
      </div>
    </div>
  );
}
