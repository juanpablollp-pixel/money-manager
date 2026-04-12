import { useApp } from '../context/AppContext';
import { useNavigate } from 'react-router-dom';

export default function Header({ title, showBack = false, backTo = '/' }) {
  const { menuOpen, setMenuOpen } = useApp();
  const navigate = useNavigate();

  return (
    <div className="header">
      <div className="header-left">
        <div className="header-line" />
        <span className="header-title">{title}</span>
      </div>
      {showBack ? (
        <button className="btn-back" onClick={() => navigate(backTo)}>←</button>
      ) : (
        <button
          className={`btn-menu${menuOpen ? ' open' : ''}`}
          onClick={() => setMenuOpen(o => !o)}
        >
          <span /><span /><span />
        </button>
      )}
    </div>
  );
}
