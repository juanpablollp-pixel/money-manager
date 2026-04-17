import { useState, useEffect } from 'react';
import { db, getAjuste } from '../db/database';
import { formatPesos, mismoMes } from '../utils/format';
import { useApp } from '../context/AppContext';
import Header from '../components/Header';
import Modal from '../components/Modal';
import FormPresupuesto from '../components/FormPresupuesto';
import { Pencil, X } from 'lucide-react';
import FitButton from '../components/FitButton';

export default function Presupuestos() {
  const { refreshKey, triggerRefresh } = useApp();
  const [presupuestos, setPresupuestos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [movimientos, setMovimientos] = useState([]);
  const [dolarMep, setDolarMep] = useState(1000);
  const [separador, setSeparador] = useState('coma');
  const [modal, setModal] = useState(null);

  useEffect(() => {
    async function load() {
      const [press, cats, movs, dolar, sep] = await Promise.all([
        db.presupuestos.toArray(),
        db.categorias.toArray(),
        db.movimientos.toArray(),
        getAjuste('dolarMep'),
        getAjuste('separadorDecimal'),
      ]);
      setPresupuestos(press);
      setCategorias(cats);
      setMovimientos(movs.filter(m => m.tipo === 'gasto' && mismoMes(m.fecha)));
      setDolarMep(parseFloat(dolar) || 1000);
      setSeparador(sep || 'coma');
    }
    load();
  }, [refreshKey]);

  async function eliminar(id) {
    if (!confirm('¿Eliminar?')) return;
    await db.presupuestos.delete(id);
    triggerRefresh();
  }

  function getCat(id) { return categorias.find(c => c.id === id)?.nombre || '—'; }
  const fmt = v => formatPesos(v, separador);

  // Gastos del mes agrupados por categoría (en ARS)
  const gastadoPorCategoria = movimientos.reduce((acc, m) => {
    const enARS = m.moneda === 'Dólares' ? m.importe * dolarMep : m.importe;
    acc[m.categoriaId] = (acc[m.categoriaId] || 0) + enARS;
    return acc;
  }, {});

  function barColor(pct) {
    if (pct >= 90) return 'var(--rojo)';
    if (pct >= 70) return '#f97316';
    return 'var(--verde)';
  }

  const pesos = presupuestos.filter(p => p.moneda === 'Pesos');
  const dolares = presupuestos.filter(p => p.moneda === 'Dólares');

  const totalPresupuesto = presupuestos.reduce((acc, p) => {
    return acc + (p.moneda === 'Dólares' ? p.importe * dolarMep : p.importe);
  }, 0);

  return (
    <div className="page">
      <Header title="Presupuestos" showBack />

      <FitButton className="btn-main negro full" onClick={() => setModal({})}>
        Agregar Nuevo Gasto al Presupuesto
      </FitButton>

      <div className="resumen">
        <div className="resumen-row">
          <span className="resumen-label">Total Presupuesto Mensual</span>
          <span className="resumen-valor">{fmt(totalPresupuesto)}</span>
        </div>
        {presupuestos.length > 0 && (
          <>
            <div className="resumen-divider" />
            {[...presupuestos].sort((a, b) => {
              const arsA = a.moneda === 'Dólares' ? a.importe * dolarMep : a.importe;
              const arsB = b.moneda === 'Dólares' ? b.importe * dolarMep : b.importe;
              const pctA = arsA > 0 ? (gastadoPorCategoria[a.categoriaId] || 0) / arsA : 0;
              const pctB = arsB > 0 ? (gastadoPorCategoria[b.categoriaId] || 0) / arsB : 0;
              return pctA - pctB;
            }).map(p => {
              const presupARS = p.moneda === 'Dólares' ? p.importe * dolarMep : p.importe;
              const gastado = gastadoPorCategoria[p.categoriaId] || 0;
              const pct = presupARS > 0 ? Math.min(100, (gastado / presupARS) * 100) : 0;
              const color = barColor(pct);
              return (
                <div key={p.id} className="presupuesto-progreso">
                  <div className="presupuesto-progreso-header">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <span>{p.empresa}</span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--gris-oscuro)' }}>
                        {fmt(gastado)} usado de {fmt(presupARS)}
                      </span>
                    </div>
                    <span style={{ color }}>{Math.round(pct)}%</span>
                  </div>
                  <div className="presupuesto-progreso-bar">
                    <div className="presupuesto-progreso-fill" style={{ width: `${pct}%`, background: color }} />
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>

      <div className="section-header">
        <div className="section-title">Detalle de Presupuestos</div>
        <div className="section-line" />
      </div>

      <div className="cards-list">
        {pesos.length > 0 && (
          <div style={{ fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--gris-oscuro)' }}>Pesos</div>
        )}
        {pesos.map(p => (
          <div key={p.id} className="presupuesto-card">
            <div className="presupuesto-body">
              <span className="card-title">{p.empresa}</span>
              <span className="card-subtitle">{getCat(p.categoriaId)}</span>
              <span className="card-date">Pesos</span>
            </div>
            <div className="card-right">
              <span className="card-importe">{fmt(p.importe)}</span>
              <div className="card-actions">
                <button className="btn-icon" onClick={() => setModal({ item: p })}><Pencil size={15} /></button>
                <button className="btn-icon rojo" onClick={() => eliminar(p.id)}><X size={15} /></button>
              </div>
            </div>
          </div>
        ))}

        {dolares.length > 0 && (
          <div style={{ fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--gris-oscuro)', marginTop: 8 }}>Dólares</div>
        )}
        {dolares.map(p => (
          <div key={p.id} className="presupuesto-card">
            <div className="presupuesto-body">
              <span className="card-title">{p.empresa}</span>
              <span className="card-subtitle">{getCat(p.categoriaId)}</span>
              <span className="card-date">Dólares → {fmt(p.importe * dolarMep)}</span>
            </div>
            <div className="card-right">
              <span className="card-importe">${p.importe}</span>
              <div className="card-actions">
                <button className="btn-icon" onClick={() => setModal({ item: p })}><Pencil size={15} /></button>
                <button className="btn-icon rojo" onClick={() => eliminar(p.id)}><X size={15} /></button>
              </div>
            </div>
          </div>
        ))}
        {presupuestos.length === 0 && <div className="empty">Sin presupuestos</div>}
      </div>

      {modal && (
        <Modal onClose={() => setModal(null)}>
          <FormPresupuesto initial={modal.item} onSave={triggerRefresh} onClose={() => setModal(null)} />
        </Modal>
      )}
    </div>
  );
}
