import { useState, useEffect } from 'react';
import { db, getAjuste } from '../db/database';
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
  const [dolarMep, setDolarMep] = useState(1000);

  useEffect(() => {
    async function load() {
      const [cats, carts, dolar, defaultCuenta] = await Promise.all([
        db.categorias.toArray(),
        db.carteras.toArray(),
        getAjuste('dolarMep'),
        initial ? Promise.resolve(null) : getAjuste('cuentaDefault'),
      ]);
      setCategorias(cats);
      setCarteras(carts);
      setDolarMep(parseFloat(dolar) || 1000);
      if (!initial && defaultCuenta) setCarteraId(String(defaultCuenta));
    }
    load();
  }, []);

  function toCarteraNativa(importe, movMoneda, cartera) {
    if (!cartera) return importe;
    if (movMoneda === cartera.moneda) return importe;
    if (movMoneda === 'Dólares' && cartera.moneda === 'Pesos') return importe * dolarMep;
    if (movMoneda === 'Pesos' && cartera.moneda === 'Dólares') return importe / dolarMep;
    return importe;
  }

  async function handleSave() {
    if (!empresa || !importe) return;
    const nuevoImporte = parseFloat(String(importe).replace(',', '.'));
    const nuevaCarteraId = Number(carteraId);
    const data = { tipo, fecha, empresa, categoriaId: Number(categoriaId), carteraId: nuevaCarteraId, importe: nuevoImporte, moneda, createdAt: Date.now() };

    if (initial?.id) {
      // Revertir efecto del movimiento original sobre su cartera
      if (initial.carteraId) {
        const carteraOrigen = carteras.find(c => c.id === initial.carteraId);
        const importeNativoOld = toCarteraNativa(initial.importe, initial.moneda, carteraOrigen);
        const oldDelta = initial.tipo === 'ingreso' ? -importeNativoOld : importeNativoOld;
        await db.carteras.where('id').equals(initial.carteraId).modify(c => { c.importe += oldDelta; });
      }
      // Aplicar efecto del movimiento nuevo sobre su cartera
      if (nuevaCarteraId) {
        const carteraDestino = carteras.find(c => c.id === nuevaCarteraId);
        const importeNativoNew = toCarteraNativa(nuevoImporte, moneda, carteraDestino);
        const newDelta = tipo === 'ingreso' ? importeNativoNew : -importeNativoNew;
        await db.carteras.where('id').equals(nuevaCarteraId).modify(c => { c.importe += newDelta; });
      }
      await db.movimientos.update(initial.id, data);
    } else {
      await db.movimientos.add(data);
      if (nuevaCarteraId) {
        const carteraDestino = carteras.find(c => c.id === nuevaCarteraId);
        const importeNativo = toCarteraNativa(nuevoImporte, moneda, carteraDestino);
        const delta = tipo === 'ingreso' ? importeNativo : -importeNativo;
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
          <select className="form-select" value={moneda} onChange={e => setMoneda(e.target.value)}>
            <option value="Pesos">Pesos</option>
            <option value="Dólares">Dólares</option>
          </select>
        </div>
      </div>
      <div className="btn-row">
        <button className="btn-main gris-claro" onClick={onClose}>Cancelar</button>
        <button className="btn-main" style={{ background: accentColor }} onClick={handleSave}>Guardar</button>
      </div>
    </>
  );
}
