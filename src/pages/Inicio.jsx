import { useState, useEffect } from 'react';
import { db, getAjuste } from '../db/database';
import { formatPesos, formatFecha, esMismoPeriodo } from '../utils/format';
import { useApp } from '../context/AppContext';
import PeriodSelector from '../components/PeriodSelector';
import Header from '../components/Header';
import Modal from '../components/Modal';
import FormMovimiento from '../components/FormMovimiento';
import { Pencil, X, Calendar, TrendingDown, TrendingUp } from 'lucide-react';
import FitButton from '../components/FitButton';

export default function Inicio() {
  const { refreshKey, triggerRefresh, periodo } = useApp();
  const [movimientos, setMovimientos] = useState([]);
  const [presupuestos, setPresupuestos] = useState([]);
  const [carteras, setCarteras] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [facturacion, setFacturacion] = useState([]);
  const [transferencias, setTransferencias] = useState([]);
  const [dolarMep, setDolarMep] = useState(1000);
  const [separador, setSeparador] = useState('coma');
  const [modal, setModal] = useState(null);

  const [mostrarFiltro, setMostrarFiltro] = useState(false);
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');

  useEffect(() => {
    async function load() {
      const [movs, press, carts, cats, facts, trans, sep, dolar] = await Promise.all([
        db.movimientos.toArray(),
        db.presupuestos.toArray(),
        db.carteras.toArray(),
        db.categorias.toArray(),
        db.facturacion.toArray(),
        db.transferencias.toArray(),
        getAjuste('separadorDecimal'),
        getAjuste('dolarMep'),
      ]);
      setMovimientos(movs.sort((a, b) => {
        const byFecha = b.fecha.localeCompare(a.fecha);
        if (byFecha !== 0) return byFecha;
        return b.id - a.id;
      }));
      setPresupuestos(press);
      setCarteras(carts);
      setCategorias(cats);
      setFacturacion(facts);
      setTransferencias(trans);
      setSeparador(sep || 'coma');
      setDolarMep(parseFloat(dolar) || 1000);
    }
    load();
  }, [refreshKey]);

  const fmt = v => formatPesos(v, separador);

  const presupuestosPeriodo = presupuestos.filter(p => p.mes === periodo.mes && p.anio === periodo.anio);

  const presupuestoTotalPesos = presupuestosPeriodo
    .filter(p => p.moneda === 'Pesos')
    .reduce((acc, p) => acc + p.importe, 0);

  const presupuestoTotalUSD = presupuestosPeriodo
    .filter(p => p.moneda === 'Dólares')
    .reduce((acc, p) => acc + p.importe, 0);

  const presupuestoTotalUSDenARS = presupuestosPeriodo
    .filter(p => p.moneda === 'Dólares')
    .reduce((acc, p) => acc + p.importe * (p.dolarUsado ?? dolarMep), 0);

  const movsMes = movimientos.filter(m => esMismoPeriodo(m.fecha, periodo.mes, periodo.anio));

  const totalGastado = movsMes
    .filter(m => m.tipo === 'gasto')
    .reduce((acc, m) => acc + (m.moneda === 'Dólares' ? m.importe * (m.dolarUsado ?? dolarMep) : m.importe), 0);

  const totalIngresado = movsMes
    .filter(m => m.tipo === 'ingreso')
    .reduce((acc, m) => acc + (m.moneda === 'Dólares' ? m.importe * (m.dolarUsado ?? dolarMep) : m.importe), 0);

  const facturacionPeriodo = facturacion.filter(f => f.mes === periodo.mes && f.anio === periodo.anio);

  const totalFacturado = facturacionPeriodo.reduce((acc, f) => {
    return acc + (f.moneda === 'Dólares' ? f.importe * (f.dolarUsado ?? dolarMep) : f.importe);
  }, 0);

  // Reconstruye el saldo nativo de cada cartera al final del período seleccionado.
  // Resta el efecto de movimientos y transferencias con fecha posterior al último día del mes.
  const finPeriodo = (() => {
    const ultimoDia = new Date(periodo.anio, periodo.mes, 0).getDate();
    return `${periodo.anio}-${String(periodo.mes).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`;
  })();

  function toNativaCartera(imp, monedaMov, cartera, tasa) {
    if (!cartera || monedaMov === cartera.moneda) return imp;
    if (monedaMov === 'Dólares' && cartera.moneda === 'Pesos') return imp * tasa;
    if (monedaMov === 'Pesos' && cartera.moneda === 'Dólares') return imp / tasa;
    return imp;
  }

  function saldoCarteraAlPeriodo(cartera) {
    let saldo = cartera.importe;
    for (const m of movimientos) {
      if (m.fecha <= finPeriodo) continue;
      if (m.carteraId !== cartera.id) continue;
      const nat = toNativaCartera(m.importe, m.moneda, cartera, m.dolarUsado ?? dolarMep);
      saldo += m.tipo === 'ingreso' ? -nat : nat;
    }
    for (const t of transferencias) {
      if (t.fecha <= finPeriodo) continue;
      if (t.cuentaOrigen === cartera.id) {
        saldo += toNativaCartera(t.importe, t.moneda, cartera, dolarMep);
      }
      if (t.cuentaDestino === cartera.id) {
        saldo -= toNativaCartera(t.importe, t.moneda, cartera, dolarMep);
      }
    }
    return saldo;
  }

  const balanceCuenta = carteras
    .filter(c => c.enBalance)
    .reduce((acc, c) => {
      const saldoNat = saldoCarteraAlPeriodo(c);
      return acc + (c.moneda === 'Dólares' ? saldoNat * dolarMep : saldoNat);
    }, 0);

  // Por categoría: contar hasta el límite del presupuesto (el exceso no reduce la obligación restante)
  const gastadoEnPresupuestados = presupuestosPeriodo
    .filter(p => p.moneda === 'Pesos')
    .reduce((acc, p) => {
      const gastadoEnCategoria = movsMes
        .filter(m => m.tipo === 'gasto' && m.categoriaId === p.categoriaId)
        .reduce((sum, m) => sum + (m.moneda === 'Dólares' ? m.importe * (m.dolarUsado ?? dolarMep) : m.importe), 0);
      return acc + Math.min(gastadoEnCategoria, p.importe);
    }, 0);

  const gastadoUSD = movsMes
    .filter(m => m.tipo === 'gasto' && m.moneda === 'Dólares')
    .filter(m => presupuestosPeriodo.some(p => p.categoriaId === m.categoriaId && p.moneda === 'Dólares'))
    .reduce((acc, m) => acc + m.importe, 0);

  // Solo display — no afecta ningún cálculo del sistema
  const pendienteUSD = presupuestoTotalUSD - gastadoUSD;

  const totalDejarEnCuenta = presupuestoTotalPesos - gastadoEnPresupuestados;
  const totalDespuesGastos = balanceCuenta - totalDejarEnCuenta;

  const ahorros = carteras
    .filter(c => c.tipo === 'ahorros')
    .reduce((acc, c) => {
      const saldoNat = saldoCarteraAlPeriodo(c);
      return acc + (c.moneda === 'Dólares' ? saldoNat * dolarMep : saldoNat);
    }, 0);

  const movsFiltrados = (() => {
    if (fechaDesde || fechaHasta) {
      return movimientos.filter(m => {
        if (fechaDesde && m.fecha < fechaDesde) return false;
        if (fechaHasta && m.fecha > fechaHasta) return false;
        return true;
      });
    }
    return movimientos.filter(m => esMismoPeriodo(m.fecha, periodo.mes, periodo.anio));
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
      const cartera = carteras.find(c => c.id === mov.carteraId);
      let importeNativo = mov.importe;
      if (cartera && mov.moneda !== cartera.moneda) {
        const tasa = mov.dolarUsado ?? dolarMep;
        if (mov.moneda === 'Dólares' && cartera.moneda === 'Pesos') importeNativo = mov.importe * tasa;
        if (mov.moneda === 'Pesos' && cartera.moneda === 'Dólares') importeNativo = mov.importe / tasa;
      }
      const delta = mov.tipo === 'ingreso' ? -importeNativo : importeNativo;
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

      <PeriodSelector />

      <div className="resumen">
        <div className="resumen-row">
          <span className="resumen-label">Facturación Mensual</span>
          <span className="resumen-valor" style={{ color: 'var(--verde)' }}>{fmt(totalFacturado)}</span>
        </div>
        <div className="resumen-row">
          <span className="resumen-label">Presupuesto Mensual</span>
          <span className="resumen-valor">{fmt(presupuestoTotalPesos + presupuestoTotalUSDenARS)}</span>
        </div>
        {pendienteUSD > 0 && (
          <div className="resumen-row">
            <span className="resumen-label" style={{ color: 'var(--gris-oscuro)' }}>Pendiente en USD</span>
            <span className="resumen-valor" style={{ color: 'var(--gris-oscuro)', fontSize: '0.88rem' }}>
              ${pendienteUSD.toFixed(2)} → {fmt(pendienteUSD * dolarMep)}
            </span>
          </div>
        )}
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
