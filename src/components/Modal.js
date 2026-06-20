import { useEffect } from 'react';

export default function Modal({ titulo, onCerrar, children, ancho = 560 }) {
  useEffect(() => {
    const fn = e => { if (e.key === 'Escape') onCerrar(); };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [onCerrar]);

  return (
    <div className="modal-overlay" onClick={onCerrar}>
      <div className="modal" style={{ maxWidth: ancho }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{titulo}</h3>
          <button className="modal-cerrar" onClick={onCerrar} type="button">×</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
