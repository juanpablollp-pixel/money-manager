import { useApp } from '../context/AppContext';
import { useNavigate } from 'react-router-dom';

function IconHome() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
    </svg>
  );
}

export default function Header({ title, showBack = false }) {
  const { menuOpen, setMenuOpen, closeMenu } = useApp();
  const navigate = useNavigate();

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
              <IconHome />
            </button>
            <button className="btn-back" onClick={() => setMenuOpen(true)}>←</button>
          </>
        )}
        {!showBack && (
          <button
            className={`btn-menu${menuOpen ? ' open' : ''}`}
            onClick={() => menuOpen ? closeMenu() : setMenuOpen(true)}
          >
            <span /><span /><span />
          </button>
        )}
      </div>
    </div>
  );
}
