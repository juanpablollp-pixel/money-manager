import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Wallet, PieChart, FileText, Plus } from 'lucide-react';
import { useState } from 'react';
import Modal from './Modal';
import FormMovimiento from './FormMovimiento';
import { useApp } from '../context/AppContext';

const navItems = [
  { label: 'Home',      to: '/',              icon: LayoutDashboard },
  { label: 'Carteras',  to: '/carteras',      icon: Wallet },
  { isFab: true },
  { label: 'Presup.',   to: '/presupuestos',  icon: PieChart },
  { label: 'Factura.',  to: '/facturacion',   icon: FileText },
];

export default function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { triggerRefresh } = useApp();
  const [modalOpen, setModalOpen] = useState(false);

  const activeIndex = navItems.findIndex(item => !item.isFab && item.to === location.pathname);
  const showIndicator = activeIndex !== -1;

  return (
    <>
      <div className="pill-nav">
        <div className="pill-nav-track">
          {showIndicator && (
            <div
              className="pill-nav-indicator"
              style={{ transform: `translateX(${activeIndex * 100}%)` }}
            />
          )}

          {navItems.map((item, index) => {
            if (item.isFab) {
              return (
                <div key="fab" className="pill-nav-fab-wrap">
                  <button className="pill-nav-fab" onClick={() => setModalOpen(true)}>
                    <Plus size={20} />
                  </button>
                </div>
              );
            }

            const Icon = item.icon;
            const isActive = location.pathname === item.to;

            return (
              <button
                key={item.to}
                className={`pill-nav-item${isActive ? ' active' : ''}`}
                onClick={() => navigate(item.to)}
              >
                <Icon size={19} />
                <span className="pill-nav-label">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {modalOpen && (
        <Modal onClose={() => setModalOpen(false)}>
          <FormMovimiento
            onSave={triggerRefresh}
            onClose={() => setModalOpen(false)}
          />
        </Modal>
      )}
    </>
  );
}
