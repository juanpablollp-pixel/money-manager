import { useEffect, useRef } from 'react';
import fitty from 'fitty';

export default function FitButton({ children, className, style, onClick, disabled, title }) {
  const textRef = useRef(null);

  useEffect(() => {
    if (!textRef.current) return;
    const fit = fitty(textRef.current, { minSize: 9, maxSize: 13, multiLine: false });
    return () => fit.unsubscribe();
  }, [children]);

  return (
    <button className={className} style={style} onClick={onClick} disabled={disabled} title={title}>
      <span ref={textRef} style={{ display: 'block', whiteSpace: 'nowrap' }}>
        {children}
      </span>
    </button>
  );
}
