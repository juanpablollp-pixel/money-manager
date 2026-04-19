import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Wallet, PieChart, FileText, Plus } from 'lucide-react';
import { useState } from 'react';
import Modal from './Modal';
import FormMovimiento from './FormMovimiento';
import { useApp } from '../context/AppContext';

const navItems = [
  { to: '/',             icon: LayoutDashboard },
  { to: '/carteras',     icon: Wallet },
  { isFab: true },
  { to: '/presupuestos', icon: PieChart },
  { to: '/facturacion',  icon: FileText },
];

export default function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { triggerRefresh } = useApp();
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <nav className="tab-bar">
        {navItems.map((item, i) => {
          if (item.isFab) {
            return (
              <button key="fab" className="tab-bar-fab" onClick={() => setModalOpen(true)}>
                <Plus size={22} />
              </button>
            );
          }

          const Icon = item.icon;
          const isActive = location.pathname === item.to;

          return (
            <button
              key={item.to}
              className={`tab-bar-item${isActive ? ' active' : ''}`}
              onClick={() => navigate(item.to)}
            >
              <Icon size={24} />
              {isActive && <span className="tab-bar-dot" />}
            </button>
          );
        })}
      </nav>

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
