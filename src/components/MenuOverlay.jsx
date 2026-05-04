import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useNavigate } from 'react-router-dom';
import { X, LayoutDashboard, Wallet, PieChart, FileText, Tag, Settings, FileDown } from 'lucide-react';
import ModalEstadoCuenta from './ModalEstadoCuenta';

const items = [
  { label: 'Inicio', to: '/', icon: LayoutDashboard, iconBg: '#eff6ff', iconColor: '#3b82f6' },
  { label: 'Carteras', to: '/carteras', icon: Wallet, iconBg: '#eef2ff', iconColor: '#6366f1' },
  { label: 'Presupuestos', to: '/presupuestos', icon: PieChart, iconBg: '#fff7ed', iconColor: '#f97316' },
  { label: 'Facturación', to: '/facturacion', icon: FileText, iconBg: '#f0fdf4', iconColor: '#22c55e' },
  { label: 'Categorías', to: '/categorias', icon: Tag, iconBg: '#fdf4ff', iconColor: '#a855f7' },
];

export default function MenuOverlay() {
  const { menuOpen, menuClosing, closeMenu } = useApp();
  const navigate = useNavigate();
  const [estadoCuentaOpen, setEstadoCuentaOpen] = useState(false);

  if (!menuOpen && !menuClosing && !estadoCuentaOpen) return null;

  const go = (to) => {
    closeMenu();
    setTimeout(() => navigate(to), 220);
  };

  const abrirEstadoCuenta = () => {
    closeMenu();
    setTimeout(() => setEstadoCuentaOpen(true), 220);
  };

  return (
    <>
      {(menuOpen || menuClosing) && (
        <div className="menu-overlay">
          <div
            className={`menu-backdrop${menuClosing ? ' closing' : ''}`}
            onClick={closeMenu}
          />
          <div className={`menu-drawer${menuClosing ? ' closing' : ''}`}>
            <div className="menu-drawer-header">
              <span className="menu-drawer-title">Menú</span>
              <button className="menu-close-btn" onClick={closeMenu}>
                <X size={18} />
              </button>
            </div>

            <nav className="menu-nav">
              {items.map(({ label, to, icon: Icon, iconBg, iconColor }) => (
                <button key={to} className="menu-item" onClick={() => go(to)}>
                  <div className="menu-item-icon" style={{ background: iconBg, color: iconColor }}>
                    <Icon size={18} />
                  </div>
                  {label}
                </button>
              ))}
              <button className="menu-item" onClick={abrirEstadoCuenta}>
                <div className="menu-item-icon" style={{ background: '#f0fdf4', color: '#16a34a' }}>
                  <FileDown size={18} />
                </div>
                Estado de Cuenta
              </button>
            </nav>

            <div className="menu-footer">
              <button className="menu-item" onClick={() => go('/ajustes')}>
                <div className="menu-item-icon" style={{ background: '#f1f5f9', color: '#64748b' }}>
                  <Settings size={18} />
                </div>
                Ajustes
              </button>
            </div>
          </div>
        </div>
      )}

      {estadoCuentaOpen && (
        <ModalEstadoCuenta onClose={() => setEstadoCuentaOpen(false)} />
      )}
    </>
  );
}
