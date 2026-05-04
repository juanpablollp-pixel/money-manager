import { useApp } from '../context/AppContext';
import { useNavigate } from 'react-router-dom';
import { Home, ArrowLeft } from 'lucide-react';

export default function Header({ title, showBack = false }) {
  const { menuOpen, setMenuOpen, closeMenu, avisoBackup } = useApp();
  const navigate = useNavigate();
  const mostrarAlerta = !!avisoBackup?.mostrar;

  return (
    <div className="header">
      <div className="header-left">
        <div className="header-line" />
        <span className="header-title">{title}</span>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {showBack && (
          <>
            <button className="btn-home" onClick={() => navigate('/')} title="Inicio">
              <Home size={18} />
            </button>
            <button
              className={`btn-back${mostrarAlerta ? ' has-alert' : ''}`}
              onClick={() => setMenuOpen(true)}
              aria-label={mostrarAlerta ? 'Menú (hay un aviso pendiente)' : 'Menú'}
            >
              <ArrowLeft size={22} />
            </button>
          </>
        )}
        {!showBack && (
          <button
            className={`btn-menu${menuOpen ? ' open' : ''}${mostrarAlerta ? ' has-alert' : ''}`}
            onClick={() => menuOpen ? closeMenu() : setMenuOpen(true)}
            aria-label={mostrarAlerta ? 'Menú (hay un aviso pendiente)' : 'Menú'}
          >
            <span /><span /><span />
          </button>
        )}
      </div>
    </div>
  );
}
