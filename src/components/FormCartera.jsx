import { useState, useEffect } from 'react';
import { db } from '../db/database';

export default function FormCartera({ initial = null, onSave, onClose }) {
  const [nombre, setNombre] = useState(initial?.nombre || '');
  const [moneda, setMoneda] = useState(initial?.moneda || 'Pesos');
  const [importe, setImporte] = useState(initial?.importe || '');
  const [enBalance, setEnBalance] = useState(initial?.enBalance ?? true);
  const [tipo, setTipo] = useState(initial?.tipo || 'gastos');
  const [tipoCuenta, setTipoCuenta] = useState(initial?.tipoCuenta || 'Caja de Ahorros');
  const [tieneHistorial, setTieneHistorial] = useState(false);

  useEffect(() => {
    if (!initial?.id) { setTieneHistorial(false); return; }
    async function check() {
      const movs = await db.movimientos.where('carteraId').equals(initial.id).count();
      const trans = await db.transferencias
        .filter(t => t.cuentaOrigen === initial.id || t.cuentaDestino === initial.id)
        .count();
      setTieneHistorial(movs > 0 || trans > 0);
    }
    check();
  }, [initial?.id]);

  async function handleSave() {
    if (!nombre) return;
    if (initial?.id && tieneHistorial && moneda !== initial.moneda) {
      alert('No podés cambiar la moneda de una cartera con movimientos o transferencias asociadas. Primero eliminá esos registros o creá una cartera nueva.');
      return;
    }
    const data = { nombre, moneda, importe: parseFloat(String(importe).replace(',', '.')) || 0, enBalance, tipo, tipoCuenta };
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
          <select
            className="form-select"
            value={moneda}
            onChange={e => setMoneda(e.target.value)}
            disabled={tieneHistorial}
            title={tieneHistorial ? 'No se puede cambiar la moneda de una cartera con historial' : undefined}
          >
            <option value="Pesos">Pesos</option>
            <option value="Dólares">Dólares</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Importe Actual</label>
          <input type="text" className="form-input" placeholder="0,00" value={importe} onChange={e => setImporte(e.target.value.replace(/[^0-9.,]/g, ''))} inputMode="decimal" />
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
          <select className="form-select" value={enBalance ? 'si' : 'no'} onChange={e => setEnBalance(e.target.value === 'si')}>
            <option value="si">Sí</option>
            <option value="no">No</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Tipo de Cartera</label>
          <select className="form-select" value={tipo} onChange={e => setTipo(e.target.value)}>
            <option value="gastos">Gastos</option>
            <option value="ahorros">Ahorros</option>
          </select>
        </div>
      </div>
      <div className="btn-row">
        <button className="btn-main gris-claro" onClick={onClose}>Cancelar</button>
        <button className="btn-main negro" onClick={handleSave}>Guardar</button>
      </div>
    </>
  );
}
