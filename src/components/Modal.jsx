import { useEffect } from 'react';
import { createPortal } from 'react-dom';

export default function Modal({ children, onClose }) {
  useEffect(() => {
    const content = document.querySelector('.app-content');
    if (content) content.style.overflow = 'hidden';
    return () => {
      if (content) content.style.overflow = '';
    };
  }, []);

  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>,
    document.body
  );
}
