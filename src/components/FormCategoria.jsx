import { useState } from 'react';
import { db } from '../db/database';

export default function FormCategoria({ initial = null, onSave, onClose }) {
  const [nombre, setNombre] = useState(initial?.nombre || '');
  const [tipo, setTipo] = useState(initial?.tipo || 'gastos');

  async function handleSave() {
    if (!nombre) return;
    if (initial?.id) await db.categorias.update(initial.id, { nombre, tipo });
    else await db.categorias.add({ nombre, tipo });
    onSave?.(); onClose?.();
  }

  return (
    <>
      <div className="modal-title">{initial ? 'Editar' : 'Nueva'} Categoría</div>
      <div className="form-card">
        <div className="form-section-title">Información General</div>
        <div className="form-group">
          <label className="form-label">Nombre de la Categoría</label>
          <input type="text" className="form-input" value={nombre} onChange={e => setNombre(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Tipo de Categoría</label>
          <div className="toggle-row">
            <button className={`toggle-btn${tipo === 'gastos' ? ' active-no' : ''}`} onClick={() => setTipo('gastos')}>Gastos</button>
            <button className={`toggle-btn${tipo === 'ingresos' ? ' active-si' : ''}`} onClick={() => setTipo('ingresos')}>Ingresos</button>
          </div>
        </div>
      </div>
      <div className="btn-row">
        <button className="btn-main gris-claro" onClick={onClose}>Cancelar</button>
        <button className="btn-main negro" onClick={handleSave}>Guardar</button>
      </div>
    </>
  );
}
