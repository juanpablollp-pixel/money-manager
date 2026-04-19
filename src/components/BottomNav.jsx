import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Wallet, PieChart, FileText, Plus } from 'lucide-react';
import { useState } from 'react';
import Modal from './Modal';
import FormMovimiento from './FormMovimiento';
import { useApp } from '../context/AppContext';

const navLeft = [
  { label: 'Home', to: '/', icon: LayoutDashboard },
  { label: 'Carteras', to: '/carteras', icon: Wallet },
];

const navRight = [
  { label: 'Presupuestos', to: '/presupuestos', icon: PieChart },
  { label: 'Facturación', to: '/facturacion', icon: FileText },
];

export default function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { triggerRefresh } = useApp();
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <div className="bottom-nav">
        <div className="bottom-nav-bg" />
        <div className="bottom-nav-inner">
          {navLeft.map(({ label, to, icon: Icon }) => (
            <button
              key={to}
              className={`bottom-nav-item${location.pathname === to ? ' active' : ''}`}
              onClick={() => navigate(to)}
            >
              <Icon size={21} />
              <span>{label}</span>
            </button>
          ))}

          <div className="bottom-nav-spacer" />

          {navRight.map(({ label, to, icon: Icon }) => (
            <button
              key={to}
              className={`bottom-nav-item${location.pathname === to ? ' active' : ''}`}
              onClick={() => navigate(to)}
            >
              <Icon size={21} />
              <span>{label}</span>
            </button>
          ))}
        </div>

        <button className="bottom-nav-fab" onClick={() => setModalOpen(true)}>
          <Plus size={26} />
        </button>
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
