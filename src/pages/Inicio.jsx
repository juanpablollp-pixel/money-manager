import { useState, useEffect } from 'react';
import { db, getAjuste } from '../db/database';
import { formatPesos, formatFecha, mismoMes } from '../utils/format';
import { useApp } from '../context/AppContext';
import Header from '../components/Header';
import Modal from '../components/Modal';
import FormMovimiento from '../components/FormMovimiento';

export default function Inicio() {
  const { refreshKey, triggerRefresh } = useApp();
  const [movimientos, setMovimientos] = useState([]);
  const [presupuestos, setPresupuestos] = useState([]);
  const [carteras, setCarteras] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [dolarMep, setDolarMep] = useState(1000);
  const [separador, setSeparador] = useState('coma');
  const [modal, setModal] = useState(null); // null | { tipo, item }

  useEffect(() => {
    async function load() {
      const [movs, press, carts, cats, sep, dolar] = await Promise.all([
        db.movimientos.toArray(),
        db.presupuestos.toArray(),
        db.carteras.toArray(),
        db.categorias.toArray(),
        getAjuste('separadorDecimal'),
        getAjuste('dolarMep'),
      ]);
      setMovimientos(movs.sort((a, b) => b.fecha.localeCompare(a.fecha)));
      setPresupuestos(press);
      setCarteras(carts);
      setCategorias(cats);
      setSeparador(sep || 'coma');
      setDolarMep(parseFloat(dolar) || 1000);
    }
    load();
  }, [refreshKey]);

  // ---- Cálculo ----
  const fmt = v => formatPesos(v, separador);

  const presupuestoTotal = presupuestos.reduce((acc, p) => {
    const importe = p.moneda === 'Dólares' ? p.importe * dolarMep : p.importe;
    return acc + importe;
  }, 0);

  const movsMes = movimientos.filter(m => mismoMes(m.fecha));

  const totalGastado = movsMes
    .filter(m => m.tipo === 'gasto')
    .reduce((acc, m) => acc + (m.moneda === 'Dólares' ? m.importe * dolarMep : m.importe), 0);

  const totalIngresado = movsMes
    .filter(m => m.tipo === 'ingreso')
    .reduce((acc, m) => acc + (m.moneda === 'Dólares' ? m.importe * dolarMep : m.importe), 0);

  const carterasEnBalance = carteras.filter(c => c.enBalance && c.tipo === 'gastos');
  const totalEnCuentas = carterasEnBalance.reduce((acc, c) => acc + (c.moneda === 'Dólares' ? c.importe * dolarMep : c.importe), 0);

  const totalDejarEnCuenta = presupuestoTotal - totalGastado;
  const totalDespuesGastos = totalEnCuentas + totalIngresado - totalGastado;

  const ahorros = carteras
    .filter(c => c.tipo === 'ahorros')
    .reduce((acc, c) => acc + (c.moneda === 'Dólares' ? c.importe * dolarMep : c.importe), 0) + totalDespuesGastos;

  function getCatNombre(id) {
    return categorias.find(c => c.id === id)?.nombre || '—';
  }
  function getCarteraNombre(id) {
    return carteras.find(c => c.id === id)?.nombre || '—';
  }

  async function eliminar(id) {
    if (!confirm('¿Eliminar movimiento?')) return;
    const mov = await db.movimientos.get(id);
    await db.movimientos.delete(id);
    if (mov?.carteraId) {
      const delta = mov.tipo === 'ingreso' ? -mov.importe : mov.importe;
      await db.carteras.where('id').equals(mov.carteraId).modify(c => { c.importe += delta; });
    }
    triggerRefresh();
  }

  return (
    <div className="page">
      <Header title="MoneyManager" />

      <div className="btn-row">
        <button className="btn-main rojo" onClick={() => setModal({ tipo: 'gasto' })}>Nuevo Gasto</button>
        <button className="btn-main verde" onClick={() => setModal({ tipo: 'ingreso' })}>Nuevo Ingreso</button>
      </div>

      <div className="resumen">
        <div className="resumen-row"><span className="resumen-label">Presupuesto Mensual</span><span className="resumen-valor">{fmt(presupuestoTotal)}</span></div>
        <div className="resumen-row"><span className="resumen-label">Total a Dejar en Cuenta</span><span className="resumen-valor">{fmt(totalDejarEnCuenta)}</span></div>
        <div className="resumen-row"><span className="resumen-label">Total Gastado</span><span className="resumen-valor" style={{ color: 'var(--rojo)' }}>{fmt(totalGastado)}</span></div>
        <div className="resumen-row"><span className="resumen-label">Total después de Gastos</span><span className="resumen-valor">{fmt(totalDespuesGastos)}</span></div>
        <div className="resumen-row"><span className="resumen-label">Ahorros</span><span className="resumen-valor" style={{ color: 'var(--verde)' }}>{fmt(ahorros)}</span></div>
      </div>

      <div className="section-header">
        <div className="section-title">Historial de Movimientos</div>
        <div className="section-line" />
      </div>

      <div className="cards-list">
        {movimientos.length === 0 && <div className="empty">Sin movimientos aún</div>}
        {movimientos.map(m => (
          <div key={m.id} className={`card ${m.tipo === 'gasto' ? 'rojo' : 'verde'}`}>
            <div className="card-grid">
              <span className="card-cat">{getCatNombre(m.categoriaId)}</span>
              <span className="card-importe">{fmt(m.importe)}</span>
              <span className="card-fecha">{m.empresa}</span>
              <div className="card-actions">
                <button className="btn-icon" onClick={() => setModal({ tipo: m.tipo, item: m })}>✏️</button>
                <button className="btn-icon" onClick={() => eliminar(m.id)}>✕</button>
              </div>
              <span className="card-cartera">{formatFecha(m.fecha)}</span>
              <span />
              <span className="card-cartera">{getCarteraNombre(m.carteraId)} | {m.moneda}</span>
            </div>
          </div>
        ))}
      </div>

      {modal && (
        <Modal onClose={() => setModal(null)}>
          <FormMovimiento
            tipo={modal.tipo}
            initial={modal.item}
            onSave={triggerRefresh}
            onClose={() => setModal(null)}
          />
        </Modal>
      )}
    </div>
  );
}
