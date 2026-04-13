import { useState, useEffect } from 'react';
import { db } from '../db/database';

export default function FormPresupuesto({ initial = null, onSave, onClose }) {
  const [empresa, setEmpresa] = useState(initial?.empresa || '');
  const [categoriaId, setCategoriaId] = useState(initial?.categoriaId || '');
  const [importe, setImporte] = useState(initial?.importe || '');
  const [moneda, setMoneda] = useState(initial?.moneda || 'Pesos');
  const [categorias, setCategorias] = useState([]);

  useEffect(() => { db.categorias.toArray().then(setCategorias); }, []);

  async function handleSave() {
    if (!empresa || !importe) return;
    const data = { empresa, categoriaId: Number(categoriaId), importe: parseFloat(String(importe).replace(',', '.')), moneda };
    if (initial?.id) await db.presupuestos.update(initial.id, data);
    else await db.presupuestos.add(data);
    onSave?.(); onClose?.();
  }

  return (
    <>
      <div className="modal-title">{initial ? 'Editar' : 'Nuevo'} Presupuesto</div>
      <div className="form-card">
        <div className="form-section-title">Información General</div>
        <div className="form-group">
          <label className="form-label">Empresa</label>
          <input type="text" className="form-input" value={empresa} onChange={e => setEmpresa(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Categoría</label>
          <select className="form-select" value={categoriaId} onChange={e => setCategoriaId(e.target.value)}>
            <option value="">Seleccionar...</option>
            {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Moneda</label>
          <div className="moneda-toggle">
            {['Pesos', 'Dólares'].map(m => (
              <button key={m} className={`moneda-btn${moneda === m ? ' active' : ''}`} onClick={() => setMoneda(m)}>{m}</button>
            ))}
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Importe</label>
          <input type="text" className="form-input" placeholder="0,00" value={importe} onChange={e => setImporte(e.target.value.replace(/[^0-9.,]/g, ''))} inputMode="decimal" />
        </div>
      </div>
      <div className="btn-row">
        <button className="btn-main gris-claro" onClick={onClose}>Cancelar</button>
        <button className="btn-main negro" onClick={handleSave}>Guardar</button>
      </div>
    </>
  );
}
