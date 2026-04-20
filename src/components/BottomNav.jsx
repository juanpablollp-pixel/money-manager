import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Wallet, PieChart, FileText, Plus } from 'lucide-react';
import { useState } from 'react';
import Modal from './Modal';
import FormMovimiento from './FormMovimiento';
import { useApp } from '../context/AppContext';

const navItems = [
  { to: '/',             icon: LayoutDashboard, label: 'Inicio'      },
  { to: '/carteras',     icon: Wallet,           label: 'Carteras'    },
  { isFab: true },
  { to: '/presupuestos', icon: PieChart,         label: 'Presupuesto' },
  { to: '/facturacion',  icon: FileText,         label: 'Facturas'    },
];

export default function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { triggerRefresh } = useApp();
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <nav className="bottom-nav">
        {navItems.map((item, i) => {
          if (item.isFab) {
            return (
              <button key="fab" className="bottom-nav-fab" onClick={() => setModalOpen(true)}>
                <Plus size={22} />
              </button>
            );
          }

          const Icon = item.icon;
          const isActive = location.pathname === item.to;

          return (
            <button
              key={item.to}
              className={`bottom-nav-item${isActive ? ' active' : ''}`}
              onClick={() => navigate(item.to)}
            >
              <div className="bottom-nav-icon"><Icon size={22} /></div>
              <span className="bottom-nav-label">{item.label}</span>
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
