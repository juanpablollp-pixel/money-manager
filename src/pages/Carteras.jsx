import { useState, useEffect, useMemo } from 'react';
import { db, getAjuste, registrarCambio } from '../db/database';
import { formatPesos, nombreMes } from '../utils/format';
import { useApp } from '../context/AppContext';
import Header from '../components/Header';
import Modal from '../components/Modal';
import FormCartera from '../components/FormCartera';
import FormTransferencia from '../components/FormTransferencia';
import { Pencil, X, Eye, EyeOff } from 'lucide-react';
import FitButton from '../components/FitButton';

function ymToValue(mes, anio) {
  return `${anio}-${String(mes).padStart(2, '0')}`;
}
function ymCompare(a, b) {
  if (a.anio !== b.anio) return a.anio - b.anio;
  return a.mes - b.mes;
}

export default function Carteras() {
  const { refreshKey, triggerRefresh } = useApp();
  const [carteras, setCarteras] = useState([]);
  const [transferencias, setTransferencias] = useState([]);
  const [separador, setSeparador] = useState('coma');
  const [modal, setModal] = useState(null);
  const [showHistorial, setShowHistorial] = useState(false);
  const [filtroDesde, setFiltroDesde] = useState('');
  const [filtroHasta, setFiltroHasta] = useState('');

  useEffect(() => {
    async function load() {
      const [carts, trans, sep] = await Promise.all([
        db.carteras.toArray(),
        db.transferencias.orderBy('fecha').reverse().toArray(),
        getAjuste('separadorDecimal'),
      ]);
      setCarteras(carts);
      setTransferencias(trans);
      setSeparador(sep || 'coma');
    }
    load();
  }, [refreshKey]);

  async function toggleBalance(c) {
    await db.carteras.update(c.id, { enBalance: !c.enBalance });
    await registrarCambio();
    triggerRefresh();
  }
  async function eliminar(id) {
    const movsAsociados = await db.movimientos.where('carteraId').equals(id).count();
    const transfAsociadas = await db.transferencias
      .filter(t => t.cuentaOrigen === id || t.cuentaDestino === id)
      .count();
    let mensaje = '¿Eliminar cartera?';
    if (movsAsociados > 0 || transfAsociadas > 0) {
      mensaje = `Esta cartera tiene ${movsAsociados} movimiento(s) y ${transfAsociadas} transferencia(s) asociada(s). ` +
        `Si la eliminás, también se borrarán esos registros. ¿Continuar?`;
    }
    if (!confirm(mensaje)) return;
    if (movsAsociados > 0) {
      await db.movimientos.where('carteraId').equals(id).delete();
    }
    if (transfAsociadas > 0) {
      const trans = await db.transferencias
        .filter(t => t.cuentaOrigen === id || t.cuentaDestino === id)
        .toArray();
      await db.transferencias.bulkDelete(trans.map(t => t.id));
    }
    await db.carteras.delete(id);
    await registrarCambio();
    triggerRefresh();
  }
  async function eliminarTransferencia(id) {
    if (!confirm('¿Eliminar transferencia?')) return;
    const transf = await db.transferencias.get(id);
    await db.transferencias.delete(id);
    if (transf) {
      const dolar = parseFloat(await getAjuste('dolarMep')) || 1000;
      const tasa = transf.dolarUsado ?? dolar;
      const carteraOrigen = carteras.find(c => c.id === transf.cuentaOrigen);
      const carteraDestino = carteras.find(c => c.id === transf.cuentaDestino);
      function toNat(imp, monedaT, cartera) {
        if (!cartera || monedaT === cartera.moneda) return imp;
        if (monedaT === 'Dólares' && cartera.moneda === 'Pesos') return imp * tasa;
        if (monedaT === 'Pesos' && cartera.moneda === 'Dólares') return imp / tasa;
        return imp;
      }
      const impOrigen = toNat(transf.importe, transf.moneda, carteraOrigen);
      const impDestino = toNat(transf.importe, transf.moneda, carteraDestino);
      await db.carteras.where('id').equals(transf.cuentaOrigen).modify(c => { c.importe += impOrigen; });
      await db.carteras.where('id').equals(transf.cuentaDestino).modify(c => { c.importe -= impDestino; });
    }
    await registrarCambio();
    triggerRefresh();
  }

  const fmt = v => formatPesos(v, separador);

  const gastos = carteras.filter(c => c.tipo === 'gastos');
  const ahorros = carteras.filter(c => c.tipo === 'ahorros');

  function getNombreCartera(id) {
    return carteras.find(c => c.id === id)?.nombre || id;
  }

  const periodosDisponibles = useMemo(() => {
    const set = new Map();
    for (const t of transferencias) {
      if (!t.fecha) continue;
      const [y, m] = t.fecha.split('-').map(Number);
      if (!y || !m) continue;
      set.set(ymToValue(m, y), { mes: m, anio: y });
    }
    return [...set.values()].sort(ymCompare);
  }, [transferencias]);

  const opcionesHasta = useMemo(() => {
    if (!filtroDesde) return periodosDisponibles;
    const [y, m] = filtroDesde.split('-').map(Number);
    return periodosDisponibles.filter(p => ymCompare(p, { mes: m, anio: y }) >= 0);
  }, [periodosDisponibles, filtroDesde]);

  const transferenciasFiltradas = useMemo(() => {
    if (!filtroDesde || !filtroHasta) return transferencias;
    const [yD, mD] = filtroDesde.split('-').map(Number);
    const [yH, mH] = filtroHasta.split('-').map(Number);
    const ultimoDia = new Date(yH, mH, 0).getDate();
    const desdeStr = `${yD}-${String(mD).padStart(2, '0')}-01`;
    const hastaStr = `${yH}-${String(mH).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`;
    return transferencias.filter(t => t.fecha >= desdeStr && t.fecha <= hastaStr);
  }, [transferencias, filtroDesde, filtroHasta]);

  function abrirHistorial() {
    setFiltroDesde('');
    setFiltroHasta('');
    setShowHistorial(true);
  }

  return (
    <div className="page">
      <Header title="Carteras" showBack />

      <div className="btn-row">
        <FitButton className="btn-main gris-claro" onClick={abrirHistorial}>Historial de Transf.</FitButton>
        <FitButton className="btn-main gris-oscuro" onClick={() => setModal({ tipo: 'transferencia' })}>Nueva Transferencia</FitButton>
      </div>
      <div className="btn-row">
        <FitButton className="btn-main rojo" onClick={() => setModal({ tipo: 'cartera', tipoCartera: 'gastos' })}>Nueva Cartera de Gastos</FitButton>
        <FitButton className="btn-main verde" onClick={() => setModal({ tipo: 'cartera', tipoCartera: 'ahorros' })}>Nueva Cartera de Ahorros</FitButton>
      </div>

      <div className="section-header">
        <div className="section-title">Cuentas Bancarias / Carteras</div>
        <div className="section-line" />
      </div>

      <div className="cards-list">
        {gastos.map(c => (
          <div key={c.id} className="cartera-card">
            <span className="cartera-nombre">{c.nombre}</span>
            <span className="cartera-monto">{fmt(c.importe)}</span>
            <span className="cartera-tipo">{c.tipoCuenta}</span>
            <div className="cartera-actions" style={{ gridRow: 'span 2', alignSelf: 'start' }}>
              <button className="btn-ojo" onClick={() => toggleBalance(c)}>
                {c.enBalance ? <Eye size={16} /> : <EyeOff size={16} />}
              </button>
              <button className="btn-icon" onClick={() => setModal({ tipo: 'cartera', item: c })}>
                <Pencil size={15} />
              </button>
              <button className="btn-icon rojo" onClick={() => eliminar(c.id)}>
                <X size={15} />
              </button>
            </div>
            <span className="cartera-moneda">{c.moneda}</span>
          </div>
        ))}
        {ahorros.map(c => (
          <div key={c.id} className="cartera-card ahorro">
            <span className="cartera-nombre">{c.nombre}</span>
            <span className="cartera-monto">{fmt(c.importe)}</span>
            <span className="cartera-tipo">{c.tipoCuenta}</span>
            <div className="cartera-actions" style={{ gridRow: 'span 2', alignSelf: 'start' }}>
              <button className="btn-ojo" onClick={() => toggleBalance(c)}>
                {c.enBalance ? <Eye size={16} /> : <EyeOff size={16} />}
              </button>
              <button className="btn-icon" onClick={() => setModal({ tipo: 'cartera', item: c })}>
                <Pencil size={15} />
              </button>
              <button className="btn-icon rojo" onClick={() => eliminar(c.id)}>
                <X size={15} />
              </button>
            </div>
            <span className="cartera-moneda">{c.moneda}</span>
          </div>
        ))}
        {carteras.length === 0 && <div className="empty">Sin carteras</div>}
      </div>

      {modal && !showHistorial && (
        <Modal onClose={() => setModal(null)}>
          {modal.tipo === 'transferencia'
            ? <FormTransferencia initial={modal.item} onSave={triggerRefresh} onClose={() => setModal(null)} />
            : <FormCartera initial={modal.item} onSave={triggerRefresh} onClose={() => setModal(null)} />
          }
        </Modal>
      )}

      {showHistorial && (
        <Modal onClose={() => setShowHistorial(false)}>
          <div className="modal-header-row">
            <div className="modal-title">Historial de Transferencias</div>
            <button className="menu-close-btn" onClick={() => setShowHistorial(false)} aria-label="Cerrar">
              <X size={18} />
            </button>
          </div>
          {periodosDisponibles.length > 0 && (
            <div className="historial-filtros">
              <select
                className="historial-select"
                value={filtroDesde}
                onChange={e => {
                  const nuevo = e.target.value;
                  setFiltroDesde(nuevo);
                  if (nuevo && filtroHasta) {
                    const [yN, mN] = nuevo.split('-').map(Number);
                    const [yH, mH] = filtroHasta.split('-').map(Number);
                    if (ymCompare({ mes: mH, anio: yH }, { mes: mN, anio: yN }) < 0) {
                      setFiltroHasta(nuevo);
                    }
                  }
                }}
              >
                <option value="">Desde</option>
                {periodosDisponibles.map(p => (
                  <option key={ymToValue(p.mes, p.anio)} value={ymToValue(p.mes, p.anio)}>
                    {nombreMes(p.mes)} {p.anio}
                  </option>
                ))}
              </select>
              <select
                className="historial-select"
                value={filtroHasta}
                onChange={e => setFiltroHasta(e.target.value)}
              >
                <option value="">Hasta</option>
                {opcionesHasta.map(p => (
                  <option key={ymToValue(p.mes, p.anio)} value={ymToValue(p.mes, p.anio)}>
                    {nombreMes(p.mes)} {p.anio}
                  </option>
                ))}
              </select>
              {(filtroDesde || filtroHasta) && (
                <button className="btn-filtro-clear" onClick={() => { setFiltroDesde(''); setFiltroHasta(''); }}>
                  Limpiar
                </button>
              )}
            </div>
          )}
          <div className="cards-list modal-scroll-list">
            {transferenciasFiltradas.length === 0 && <div className="empty">Sin transferencias</div>}
            {transferenciasFiltradas.map(t => (
              <div key={t.id} className="card">
                <div className="card-grid">
                  <span className="card-cat">{getNombreCartera(t.cuentaOrigen)} → {getNombreCartera(t.cuentaDestino)}</span>
                  <span className="card-importe">{fmt(t.importe)}</span>
                  <span className="card-fecha">{t.fecha}</span>
                  <div className="card-actions">
                    <button className="btn-icon rojo" onClick={() => eliminarTransferencia(t.id)}>
                      <X size={15} />
                    </button>
                  </div>
                  {t.comentarios && <span className="card-cartera">{t.comentarios}</span>}
                </div>
              </div>
            ))}
          </div>
          <FitButton className="btn-main negro full" onClick={() => { setShowHistorial(false); setModal({ tipo: 'transferencia' }); }}>Nueva Transferencia</FitButton>
        </Modal>
      )}
    </div>
  );
}
