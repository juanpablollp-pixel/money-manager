import { useState, useEffect } from 'react';
import { db } from '../db/database';
import { hoy } from '../utils/format';

export default function FormTransferencia({ initial = null, onSave, onClose }) {
  const [origen, setOrigen] = useState(initial?.cuentaOrigen || '');
  const [destino, setDestino] = useState(initial?.cuentaDestino || '');
  const [importe, setImporte] = useState(initial?.importe || '');
  const [moneda, setMoneda] = useState(initial?.moneda || 'Pesos');
  const [fecha, setFecha] = useState(initial?.fecha || hoy());
  const [comentarios, setComentarios] = useState(initial?.comentarios || '');
  const [carteras, setCarteras] = useState([]);

  useEffect(() => { db.carteras.toArray().then(setCarteras); }, []);

  async function handleSave() {
    if (!origen || !destino || !importe) return;
    const nuevoImporte = parseFloat(importe);
    const nuevoOrigen = Number(origen);
    const nuevoDestino = Number(destino);
    const data = { cuentaOrigen: nuevoOrigen, cuentaDestino: nuevoDestino, importe: nuevoImporte, moneda, fecha, comentarios, createdAt: Date.now() };

    if (initial?.id) {
      // Revertir efecto de la transferencia original
      await db.carteras.where('id').equals(initial.cuentaOrigen).modify(c => { c.importe += initial.importe; });
      await db.carteras.where('id').equals(initial.cuentaDestino).modify(c => { c.importe -= initial.importe; });
      // Aplicar efecto de la transferencia nueva
      await db.carteras.where('id').equals(nuevoOrigen).modify(c => { c.importe -= nuevoImporte; });
      await db.carteras.where('id').equals(nuevoDestino).modify(c => { c.importe += nuevoImporte; });
      await db.transferencias.update(initial.id, data);
    } else {
      await db.transferencias.add(data);
      await db.carteras.where('id').equals(nuevoOrigen).modify(c => { c.importe -= nuevoImporte; });
      await db.carteras.where('id').equals(nuevoDestino).modify(c => { c.importe += nuevoImporte; });
    }

    onSave?.(); onClose?.();
  }

  return (
    <>
      <div className="modal-title">Nueva Transferencia</div>
      <div className="form-card">
        <div className="form-section-title">Información General</div>
        <div className="form-group">
          <label className="form-label">Cuenta de Origen</label>
          <select className="form-select" value={origen} onChange={e => setOrigen(e.target.value)}>
            <option value="">Seleccionar...</option>
            {carteras.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Cuenta de Destino</label>
          <select className="form-select" value={destino} onChange={e => setDestino(e.target.value)}>
            <option value="">Seleccionar...</option>
            {carteras.filter(c => String(c.id) !== String(origen)).map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Importe</label>
          <input type="text" className="form-input" placeholder="0" value={importe} onChange={e => setImporte(e.target.value.replace(/[^0-9]/g, ''))} inputMode="numeric" />
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
          <label className="form-label">Fecha</label>
          <input type="date" className="form-input" value={fecha} onChange={e => setFecha(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Comentarios</label>
          <textarea className="form-input" style={{ resize: 'vertical', minHeight: 70 }} value={comentarios} onChange={e => setComentarios(e.target.value)} />
        </div>
      </div>
      <div className="btn-row">
        <button className="btn-main gris-claro" onClick={onClose}>Cancelar</button>
        <button className="btn-main negro" onClick={handleSave}>Guardar</button>
      </div>
    </>
  );
}
