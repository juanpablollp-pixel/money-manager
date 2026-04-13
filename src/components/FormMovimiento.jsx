import { useState, useEffect } from 'react';
import { db } from '../db/database';
import { hoy } from '../utils/format';

export default function FormMovimiento({ tipo = 'gasto', initial = null, onSave, onClose }) {
  const [fecha, setFecha] = useState(initial?.fecha || hoy());
  const [empresa, setEmpresa] = useState(initial?.empresa || '');
  const [categoriaId, setCategoriaId] = useState(initial?.categoriaId || '');
  const [carteraId, setCarteraId] = useState(initial?.carteraId || '');
  const [importe, setImporte] = useState(initial?.importe || '');
  const [moneda, setMoneda] = useState(initial?.moneda || 'Pesos');
  const [categorias, setCategorias] = useState([]);
  const [carteras, setCarteras] = useState([]);

  useEffect(() => {
    db.categorias.toArray().then(setCategorias);
    db.carteras.toArray().then(setCarteras);
  }, []);

  async function handleSave() {
    if (!empresa || !importe) return;
    const nuevoImporte = parseFloat(String(importe).replace(',', '.'));
    const nuevaCarteraId = Number(carteraId);
    const data = { tipo, fecha, empresa, categoriaId: Number(categoriaId), carteraId: nuevaCarteraId, importe: nuevoImporte, moneda, createdAt: Date.now() };

    if (initial?.id) {
      // Revertir efecto del movimiento original sobre su cartera
      const oldDelta = initial.tipo === 'ingreso' ? -initial.importe : initial.importe;
      if (initial.carteraId) {
        await db.carteras.where('id').equals(initial.carteraId).modify(c => { c.importe += oldDelta; });
      }
      // Aplicar efecto del movimiento nuevo sobre su cartera
      const newDelta = tipo === 'ingreso' ? nuevoImporte : -nuevoImporte;
      if (nuevaCarteraId) {
        await db.carteras.where('id').equals(nuevaCarteraId).modify(c => { c.importe += newDelta; });
      }
      await db.movimientos.update(initial.id, data);
    } else {
      await db.movimientos.add(data);
      const delta = tipo === 'ingreso' ? nuevoImporte : -nuevoImporte;
      if (nuevaCarteraId) {
        await db.carteras.where('id').equals(nuevaCarteraId).modify(c => { c.importe += delta; });
      }
    }

    onSave?.();
    onClose?.();
  }

  const isGasto = tipo === 'gasto';
  const accentColor = isGasto ? 'var(--rojo)' : 'var(--verde)';

  return (
    <>
      <div className="modal-title" style={{ color: accentColor }}>
        {initial ? 'Editar' : 'Nuevo'} {isGasto ? 'Gasto' : 'Ingreso'}
      </div>
      <div className="form-card">
        <div className="form-section-title">Información General</div>
        <div className="form-group">
          <label className="form-label">Fecha</label>
          <input type="date" className="form-input" value={fecha} onChange={e => setFecha(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Empresa</label>
          <input type="text" className="form-input" placeholder="Nombre de empresa" value={empresa} onChange={e => setEmpresa(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Categoría</label>
          <select className="form-select" value={categoriaId} onChange={e => setCategoriaId(e.target.value)}>
            <option value="">Seleccionar...</option>
            {categorias.filter(c => isGasto ? c.tipo === 'gastos' : c.tipo === 'ingresos').map(c => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Cartera</label>
          <select className="form-select" value={carteraId} onChange={e => setCarteraId(e.target.value)}>
            <option value="">Seleccionar...</option>
            {carteras.map(c => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Importe</label>
          <input type="text" className="form-input" placeholder="0,00" value={importe} onChange={e => setImporte(e.target.value.replace(/[^0-9.,]/g, ''))} inputMode="decimal" />
        </div>
        <div className="form-group">
          <label className="form-label">Moneda</label>
          <div className="moneda-toggle">
            {['Pesos', 'Dólares'].map(m => (
              <button key={m} className={`moneda-btn${moneda === m ? ' active' : ''}`} onClick={() => setMoneda(m)}>{m}</button>
            ))}
          </div>
        </div>
      </div>
      <div className="btn-row">
        <button className="btn-main gris-claro" onClick={onClose}>Cancelar</button>
        <button className="btn-main" style={{ background: accentColor }} onClick={handleSave}>Guardar</button>
      </div>
    </>
  );
}
