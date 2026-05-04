import { useState, useEffect } from 'react';
import { db, getAjuste } from '../db/database';
import { hoy } from '../utils/format';

export default function FormTransferencia({ initial = null, onSave, onClose }) {
  const [origen, setOrigen] = useState(initial?.cuentaOrigen || '');
  const [destino, setDestino] = useState(initial?.cuentaDestino || '');
  const [importe, setImporte] = useState(initial?.importe || '');
  const [moneda, setMoneda] = useState(initial?.moneda || 'Pesos');
  const [fecha, setFecha] = useState(initial?.fecha || hoy());
  const [comentarios, setComentarios] = useState(initial?.comentarios || '');
  const [carteras, setCarteras] = useState([]);
  const [dolarMep, setDolarMep] = useState(1000);

  useEffect(() => {
    Promise.all([db.carteras.toArray(), getAjuste('dolarMep')]).then(([carts, dolar]) => {
      setCarteras(carts);
      setDolarMep(parseFloat(dolar) || 1000);
    });
  }, []);

  function toNativa(imp, transferMoneda, cartera, tasa) {
    if (!cartera || transferMoneda === cartera.moneda) return imp;
    if (transferMoneda === 'Dólares' && cartera.moneda === 'Pesos') return imp * tasa;
    if (transferMoneda === 'Pesos' && cartera.moneda === 'Dólares') return imp / tasa;
    return imp;
  }

  async function handleSave() {
    if (!origen || !destino || !importe) return;
    const nuevoImporte = parseFloat(String(importe).replace(',', '.'));
    const nuevoOrigen = Number(origen);
    const nuevoDestino = Number(destino);
    // Al editar mantenemos el dolarUsado original; al crear lo congelamos al actual.
    const dolarUsadoNuevo = moneda === 'Dólares'
      ? (initial?.dolarUsado ?? dolarMep)
      : undefined;
    const data = { cuentaOrigen: nuevoOrigen, cuentaDestino: nuevoDestino, importe: nuevoImporte, moneda, fecha, comentarios, createdAt: Date.now() };
    if (dolarUsadoNuevo != null) data.dolarUsado = dolarUsadoNuevo;

    const carteraOrigen = carteras.find(c => c.id === nuevoOrigen);
    const carteraDestino = carteras.find(c => c.id === nuevoDestino);
    const tasaNew = dolarUsadoNuevo ?? dolarMep;
    const importeOrigen = toNativa(nuevoImporte, moneda, carteraOrigen, tasaNew);
    const importeDestino = toNativa(nuevoImporte, moneda, carteraDestino, tasaNew);

    if (initial?.id) {
      // Revertir efecto de la transferencia original (usa la tasa con que se aplicó)
      const carteraOrigenOld = carteras.find(c => c.id === initial.cuentaOrigen);
      const carteraDestinoOld = carteras.find(c => c.id === initial.cuentaDestino);
      const tasaOld = initial.dolarUsado ?? dolarMep;
      const importeOrigenOld = toNativa(initial.importe, initial.moneda, carteraOrigenOld, tasaOld);
      const importeDestinoOld = toNativa(initial.importe, initial.moneda, carteraDestinoOld, tasaOld);
      await db.carteras.where('id').equals(initial.cuentaOrigen).modify(c => { c.importe += importeOrigenOld; });
      await db.carteras.where('id').equals(initial.cuentaDestino).modify(c => { c.importe -= importeDestinoOld; });
      // Aplicar efecto de la transferencia nueva
      await db.carteras.where('id').equals(nuevoOrigen).modify(c => { c.importe -= importeOrigen; });
      await db.carteras.where('id').equals(nuevoDestino).modify(c => { c.importe += importeDestino; });
      await db.transferencias.update(initial.id, data);
    } else {
      await db.transferencias.add(data);
      await db.carteras.where('id').equals(nuevoOrigen).modify(c => { c.importe -= importeOrigen; });
      await db.carteras.where('id').equals(nuevoDestino).modify(c => { c.importe += importeDestino; });
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
          <input type="text" className="form-input" placeholder="0,00" value={importe} onChange={e => setImporte(e.target.value.replace(/[^0-9.,]/g, ''))} inputMode="decimal" />
        </div>
        <div className="form-group">
          <label className="form-label">Moneda</label>
          <select className="form-select" value={moneda} onChange={e => setMoneda(e.target.value)}>
            <option value="Pesos">Pesos</option>
            <option value="Dólares">Dólares</option>
          </select>
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
