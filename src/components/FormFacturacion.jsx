import { useState, useEffect } from 'react';
import { db, getAjuste, registrarCambio } from '../db/database';

export default function FormFacturacion({ initial = null, onSave, onClose }) {
  const now = new Date();
  const [empresa, setEmpresa] = useState(initial?.empresa || '');
  const [importe, setImporte] = useState(initial?.importe?.toString() || '');
  const [moneda, setMoneda] = useState(initial?.moneda || 'Pesos');
  const [dolarMep, setDolarMep] = useState(1000);
  const mes = initial?.mes || now.getMonth() + 1;
  const anio = initial?.anio || now.getFullYear();

  useEffect(() => {
    getAjuste('dolarMep').then(d => setDolarMep(parseFloat(d) || 1000));
  }, []);

  function handleImporte(e) {
    setImporte(e.target.value.replace(/[^0-9.,]/g, ''));
  }

  async function handleSave() {
    if (!importe) return;
    const data = { empresa, importe: parseFloat(String(importe).replace(',', '.')) || 0, moneda, mes, anio };
    if (moneda === 'Dólares') {
      data.dolarUsado = initial?.dolarUsado ?? dolarMep;
    }
    if (initial?.id) await db.facturacion.update(initial.id, data);
    else await db.facturacion.add(data);
    await registrarCambio();
    onSave?.();
    onClose?.();
  }

  return (
    <>
      <div className="modal-title">{initial ? 'Editar' : 'Nueva'} Facturación</div>
      <div className="form-card">
        <div className="form-section-title">Información General</div>
        <div className="form-group">
          <label className="form-label">Descripción (opcional)</label>
          <input
            type="text"
            className="form-input"
            placeholder="Nombre o descripción"
            value={empresa}
            onChange={e => setEmpresa(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Importe</label>
          <input
            type="text"
            className="form-input"
            placeholder="0,00"
            value={importe}
            onChange={handleImporte}
            inputMode="decimal"
          />
        </div>
        <div className="form-group">
          <label className="form-label">Moneda</label>
          <div className="moneda-toggle">
            {['Pesos', 'Dólares'].map(m => (
              <button
                key={m}
                className={`moneda-btn${moneda === m ? ' active' : ''}`}
                onClick={() => setMoneda(m)}
              >
                {m}
              </button>
            ))}
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
