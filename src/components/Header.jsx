import { useApp } from '../context/AppContext';

export default function Header({ title, showBack = false }) {
  const { menuOpen, setMenuOpen, closeMenu } = useApp();

  return (
    <div className="header">
      <div className="header-left">
        <div className="header-line" />
        <span className="header-title">{title}</span>
      </div>
      {showBack ? (
        <button className="btn-back" onClick={() => setMenuOpen(true)}>←</button>
      ) : (
        <button
          className={`btn-menu${menuOpen ? ' open' : ''}`}
          onClick={() => menuOpen ? closeMenu() : setMenuOpen(true)}
        >
          <span /><span /><span />
        </button>
      )}
    </div>
  );
}
