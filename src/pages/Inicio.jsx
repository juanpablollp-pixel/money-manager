import { useState, useEffect } from 'react';
import { db, getAjuste } from '../db/database';
import { formatPesos, formatFecha, mismoMes } from '../utils/format';
import { useApp } from '../context/AppContext';
import Header from '../components/Header';
import Modal from '../components/Modal';
import FormMovimiento from '../components/FormMovimiento';
import { Pencil, X, Calendar, TrendingDown, TrendingUp } from 'lucide-react';
import FitButton from '../components/FitButton';

export default function Inicio() {
  const { refreshKey, triggerRefresh } = useApp();
  const [movimientos, setMovimientos] = useState([]);
  const [presupuestos, setPresupuestos] = useState([]);
  const [carteras, setCarteras] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [facturacion, setFacturacion] = useState([]);
  const [dolarMep, setDolarMep] = useState(1000);
  const [separador, setSeparador] = useState('coma');
  const [modal, setModal] = useState(null);

  const [mostrarFiltro, setMostrarFiltro] = useState(false);
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');

  useEffect(() => {
    async function load() {
      const now = new Date();
      const mesActual = now.getMonth() + 1;
      const anioActual = now.getFullYear();

      const [movs, press, carts, cats, facts, sep, dolar] = await Promise.all([
        db.movimientos.toArray(),
        db.presupuestos.toArray(),
        db.carteras.toArray(),
        db.categorias.toArray(),
        db.facturacion.toArray(),
        getAjuste('separadorDecimal'),
        getAjuste('dolarMep'),
      ]);
      setMovimientos(movs.sort((a, b) => b.fecha.localeCompare(a.fecha)));
      setPresupuestos(press);
      setCarteras(carts);
      setCategorias(cats);
      setFacturacion(facts.filter(f => f.mes === mesActual && f.anio === anioActual));
      setSeparador(sep || 'coma');
      setDolarMep(parseFloat(dolar) || 1000);
    }
    load();
  }, [refreshKey]);

  const fmt = v => formatPesos(v, separador);

  const presupuestoTotal = presupuestos.reduce((acc, p) => {
    return acc + (p.moneda === 'Dólares' ? p.importe * dolarMep : p.importe);
  }, 0);

  const movsMes = movimientos.filter(m => mismoMes(m.fecha));

  const totalGastado = movsMes
    .filter(m => m.tipo === 'gasto')
    .reduce((acc, m) => acc + (m.moneda === 'Dólares' ? m.importe * dolarMep : m.importe), 0);

  const totalIngresado = movsMes
    .filter(m => m.tipo === 'ingreso')
    .reduce((acc, m) => acc + (m.moneda === 'Dólares' ? m.importe * dolarMep : m.importe), 0);

  const totalFacturado = facturacion.reduce((acc, f) => {
    return acc + (f.moneda === 'Dólares' ? f.importe * dolarMep : f.importe);
  }, 0);

  const balanceCuenta = carteras
    .filter(c => c.enBalance)
    .reduce((acc, c) => acc + (c.moneda === 'Dólares' ? c.importe * dolarMep : c.importe), 0);

  const totalDejarEnCuenta = presupuestoTotal - totalGastado;
  const totalDespuesGastos = balanceCuenta - totalDejarEnCuenta;

  const ahorros = carteras
    .filter(c => c.tipo === 'ahorros')
    .reduce((acc, c) => acc + (c.moneda === 'Dólares' ? c.importe * dolarMep : c.importe), 0);

  const movsFiltrados = (() => {
    if (fechaDesde || fechaHasta) {
      return movimientos.filter(m => {
        if (fechaDesde && m.fecha < fechaDesde) return false;
        if (fechaHasta && m.fecha > fechaHasta) return false;
        return true;
      });
    }
    return movimientos;
  })();

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

  function limpiarFiltro() {
    setFechaDesde('');
    setFechaHasta('');
    setMostrarFiltro(false);
  }

  return (
    <div className="page">
      <Header title="MoneyManager" />

      <div className="btn-row">
        <FitButton className="btn-main rojo" onClick={() => setModal({ tipo: 'gasto' })}>Nuevo Gasto</FitButton>
        <FitButton className="btn-main verde" onClick={() => setModal({ tipo: 'ingreso' })}>Nuevo Ingreso</FitButton>
      </div>

      <div className="resumen">
        <div className="resumen-row">
          <span className="resumen-label">Facturación Mensual</span>
          <span className="resumen-valor" style={{ color: 'var(--verde)' }}>{fmt(totalFacturado)}</span>
        </div>
        <div className="resumen-row">
          <span className="resumen-label">Presupuesto Mensual</span>
          <span className="resumen-valor">{fmt(presupuestoTotal)}</span>
        </div>
        <div className="resumen-row">
          <span className="resumen-label">Total a Dejar en Cuenta</span>
          <span className="resumen-valor">{fmt(totalDejarEnCuenta)}</span>
        </div>
        <div className="resumen-row">
          <span className="resumen-label">Total Después de Gastos</span>
          <span className="resumen-valor" style={{ color: totalDespuesGastos < 0 ? 'var(--rojo)' : 'var(--negro)' }}>{fmt(totalDespuesGastos)}</span>
        </div>
        <div className="resumen-divider" />
        <div className="resumen-row">
          <span className="resumen-label">Ingresos</span>
          <span className="resumen-valor" style={{ color: 'var(--verde)' }}>{fmt(totalIngresado)}</span>
        </div>
        <div className="resumen-row">
          <span className="resumen-label">Gastos</span>
          <span className="resumen-valor" style={{ color: 'var(--rojo)' }}>{fmt(totalGastado)}</span>
        </div>
        <div className="resumen-divider" />
        <div className="resumen-row">
          <span className="resumen-label">Balance de Cuenta</span>
          <span className="resumen-valor">{fmt(balanceCuenta)}</span>
        </div>
        <div className="resumen-divider" />
        <div className="resumen-row">
          <span className="resumen-label">Ahorros</span>
          <span className="resumen-valor" style={{ color: 'var(--verde)' }}>{fmt(ahorros)}</span>
        </div>
      </div>

      <div className="section-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="section-title">Historial de Movimientos</div>
          <button
            className="btn-icon"
            style={{ width: 32, height: 32 }}
            onClick={() => setMostrarFiltro(v => !v)}
            title="Filtrar por fecha"
          >
            <Calendar size={15} />
          </button>
        </div>
        <div className="section-line" />
      </div>

      {mostrarFiltro && (
        <div className="filtro-fecha">
          <input
            type="date"
            value={fechaDesde}
            onChange={e => setFechaDesde(e.target.value)}
          />
          <input
            type="date"
            value={fechaHasta}
            onChange={e => setFechaHasta(e.target.value)}
          />
          <button className="btn-filtro-clear" onClick={limpiarFiltro}>Limpiar</button>
        </div>
      )}

      <div className="cards-list">
        {movsFiltrados.length === 0 && <div className="empty">Sin movimientos</div>}
        {movsFiltrados.map(m => (
          <div key={m.id} className="card">
            <div className={`card-icon ${m.tipo === 'gasto' ? 'rojo' : 'verde'}`}>
              {m.tipo === 'gasto'
                ? <TrendingDown size={20} />
                : <TrendingUp size={20} />
              }
            </div>
            <div className="card-body">
              <div className="card-title">{getCatNombre(m.categoriaId)}</div>
              <div className="card-subtitle">{m.empresa} · {getCarteraNombre(m.carteraId)}</div>
              <div className="card-date">{formatFecha(m.fecha)}</div>
            </div>
            <div className="card-right">
              <span className={`card-importe ${m.tipo === 'gasto' ? 'rojo' : 'verde'}`}>
                {m.tipo === 'gasto' ? '-' : '+'}{fmt(m.importe)}
              </span>
              <div className="card-actions">
                <button className="btn-icon" onClick={() => setModal({ tipo: m.tipo, item: m })}>
                  <Pencil size={14} />
                </button>
                <button className="btn-icon rojo" onClick={() => eliminar(m.id)}>
                  <X size={14} />
                </button>
              </div>
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
