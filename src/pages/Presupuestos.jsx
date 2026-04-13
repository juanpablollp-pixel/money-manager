import { useState, useEffect } from 'react';
import { db, getAjuste } from '../db/database';
import { formatPesos } from '../utils/format';
import { useApp } from '../context/AppContext';
import Header from '../components/Header';
import Modal from '../components/Modal';
import FormPresupuesto from '../components/FormPresupuesto';

export default function Presupuestos() {
  const { refreshKey, triggerRefresh } = useApp();
  const [presupuestos, setPresupuestos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [dolarMep, setDolarMep] = useState(1000);
  const [separador, setSeparador] = useState('coma');
  const [modal, setModal] = useState(null);

  useEffect(() => {
    async function load() {
      const [press, cats, dolar, sep] = await Promise.all([
        db.presupuestos.toArray(),
        db.categorias.toArray(),
        getAjuste('dolarMep'),
        getAjuste('separadorDecimal'),
      ]);
      setPresupuestos(press);
      setCategorias(cats);
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

  const pesos = presupuestos.filter(p => p.moneda === 'Pesos');
  const dolares = presupuestos.filter(p => p.moneda === 'Dólares');

  const totalPresupuesto = presupuestos.reduce((acc, p) => {
    return acc + (p.moneda === 'Dólares' ? p.importe * dolarMep : p.importe);
  }, 0);

  return (
    <div className="page">
      <Header title="Presupuestos" showBack />

      <button className="btn-main negro full" onClick={() => setModal({})}>
        Agregar Nuevo Gasto al Presupuesto
      </button>

      <div className="resumen">
        <div className="resumen-row">
          <span className="resumen-label">Total Presupuesto Mensual</span>
          <span className="resumen-valor">{fmt(totalPresupuesto)}</span>
        </div>
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
            <span style={{ fontWeight: 700 }}>{p.empresa}</span>
            <span style={{ fontWeight: 700, textAlign: 'right' }}>{fmt(p.importe)}</span>
            <span style={{ fontSize: '0.82rem', color: '#555' }}>{getCat(p.categoriaId)}</span>
            <div className="card-actions">
              <button className="btn-icon" onClick={() => setModal({ item: p })}>✏️</button>
              <button className="btn-icon" onClick={() => eliminar(p.id)}>✕</button>
            </div>
            <span style={{ fontSize: '0.82rem', color: '#555' }}>Pesos</span>
          </div>
        ))}

        {dolares.length > 0 && (
          <div style={{ fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--gris-oscuro)', marginTop: 8 }}>Dólares</div>
        )}
        {dolares.map(p => (
          <div key={p.id} className="presupuesto-card">
            <span style={{ fontWeight: 700 }}>{p.empresa}</span>
            <span style={{ fontWeight: 700, textAlign: 'right' }}>${p.importe}</span>
            <span style={{ fontSize: '0.82rem', color: '#555' }}>{getCat(p.categoriaId)}</span>
            <div className="card-actions">
              <button className="btn-icon" onClick={() => setModal({ item: p })}>✏️</button>
              <button className="btn-icon" onClick={() => eliminar(p.id)}>✕</button>
            </div>
            <span style={{ fontSize: '0.82rem', color: '#555' }}>Dólares → {fmt(p.importe * dolarMep)}</span>
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
