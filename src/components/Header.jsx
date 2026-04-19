import { useNavigate } from 'react-router-dom';
import { Settings, ArrowLeft } from 'lucide-react';

export default function Header({ title, showBack = false }) {
  const navigate = useNavigate();

  return (
    <div className="header">
      <div className="header-left">
        {showBack && (
          <button className="btn-back" onClick={() => navigate(-1)}>
            <ArrowLeft size={20} />
          </button>
        )}
        <div className="header-line" />
        <span className="header-title">{title}</span>
      </div>
      {!showBack && (
        <button className="btn-settings" onClick={() => navigate('/ajustes')}>
          <Settings size={20} />
        </button>
      )}
    </div>
  );
}
