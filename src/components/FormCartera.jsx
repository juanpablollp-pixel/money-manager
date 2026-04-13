import { useState } from 'react';
import { db } from '../db/database';

export default function FormCartera({ initial = null, onSave, onClose }) {
  const [nombre, setNombre] = useState(initial?.nombre || '');
  const [moneda, setMoneda] = useState(initial?.moneda || 'Pesos');
  const [importe, setImporte] = useState(initial?.importe || '');
  const [enBalance, setEnBalance] = useState(initial?.enBalance ?? true);
  const [tipo, setTipo] = useState(initial?.tipo || 'gastos');
  const [tipoCuenta, setTipoCuenta] = useState(initial?.tipoCuenta || 'Caja de Ahorros');

  async function handleSave() {
    if (!nombre) return;
    const data = { nombre, moneda, importe: parseFloat(importe) || 0, enBalance, tipo, tipoCuenta };
    if (initial?.id) await db.carteras.update(initial.id, data);
    else await db.carteras.add(data);
    onSave?.(); onClose?.();
  }

  return (
    <>
      <div className="modal-title">
        {initial ? 'Editar' : 'Nueva'} Cartera
      </div>
      <div className="form-card">
        <div className="form-section-title">Información General</div>
        <div className="form-group">
          <label className="form-label">Nombre de Cartera</label>
          <input type="text" className="form-input" value={nombre} onChange={e => setNombre(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Moneda / Divisa</label>
          <div className="moneda-toggle">
            {['Pesos', 'Dólares'].map(m => (
              <button key={m} className={`moneda-btn${moneda === m ? ' active' : ''}`} onClick={() => setMoneda(m)}>{m}</button>
            ))}
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Importe Actual</label>
          <input type="text" className="form-input" placeholder="0" value={importe} onChange={e => setImporte(e.target.value.replace(/[^0-9]/g, ''))} inputMode="numeric" />
        </div>
        <div className="form-group">
          <label className="form-label">Tipo de Cuenta</label>
          <select className="form-select" value={tipoCuenta} onChange={e => setTipoCuenta(e.target.value)}>
            <option>Caja de Ahorros</option>
            <option>Cuenta Corriente</option>
            <option>Cuenta Broker</option>
            <option>Efectivo</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Se Incluye en el Balance Total</label>
          <div className="toggle-row">
            <button className={`toggle-btn${enBalance ? ' active-si' : ''}`} onClick={() => setEnBalance(true)}>SÍ</button>
            <button className={`toggle-btn${!enBalance ? ' active-no' : ''}`} onClick={() => setEnBalance(false)}>NO</button>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Tipo de Cartera</label>
          <div className="toggle-row">
            <button className={`toggle-btn${tipo === 'gastos' ? ' active-no' : ''}`} onClick={() => setTipo('gastos')}>Gastos</button>
            <button className={`toggle-btn${tipo === 'ahorros' ? ' active-si' : ''}`} onClick={() => setTipo('ahorros')}>Ahorros</button>
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
