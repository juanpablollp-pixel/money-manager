import { useState, useEffect } from 'react';
import { db } from '../db/database';
import { formatPesos } from '../utils/format';
import { useApp } from '../context/AppContext';
import Header from '../components/Header';
import Modal from '../components/Modal';
import FormCartera from '../components/FormCartera';
import FormTransferencia from '../components/FormTransferencia';

export default function Carteras() {
  const { refreshKey, triggerRefresh } = useApp();
  const [carteras, setCarteras] = useState([]);
  const [transferencias, setTransferencias] = useState([]);
  const [modal, setModal] = useState(null);
  const [showHistorial, setShowHistorial] = useState(false);

  useEffect(() => {
    db.carteras.toArray().then(setCarteras);
    db.transferencias.orderBy('fecha').reverse().toArray().then(setTransferencias);
  }, [refreshKey]);

  async function toggleBalance(c) {
    await db.carteras.update(c.id, { enBalance: !c.enBalance });
    triggerRefresh();
  }
  async function eliminar(id) {
    if (!confirm('¿Eliminar cartera?')) return;
    await db.carteras.delete(id);
    triggerRefresh();
  }
  async function eliminarTransferencia(id) {
    if (!confirm('¿Eliminar transferencia?')) return;
    const transf = await db.transferencias.get(id);
    await db.transferencias.delete(id);
    if (transf) {
      await db.carteras.where('id').equals(transf.cuentaOrigen).modify(c => { c.importe += transf.importe; });
      await db.carteras.where('id').equals(transf.cuentaDestino).modify(c => { c.importe -= transf.importe; });
    }
    triggerRefresh();
  }

  const gastos = carteras.filter(c => c.tipo === 'gastos');
  const ahorros = carteras.filter(c => c.tipo === 'ahorros');

  function getNombreCartera(id) {
    return carteras.find(c => c.id === id)?.nombre || id;
  }

  return (
    <div className="page">
      <Header title="Carteras" showBack backTo="/" />

      <div className="btn-row">
        <button className="btn-main gris-claro" onClick={() => setShowHistorial(true)}>Historial de Transferencias</button>
        <button className="btn-main gris-oscuro" onClick={() => setModal({ tipo: 'transferencia' })}>Nueva Transferencia</button>
      </div>
      <div className="btn-row">
        <button className="btn-main rojo" onClick={() => setModal({ tipo: 'cartera', tipoCartera: 'gastos' })}>Nueva Cartera de Gastos</button>
        <button className="btn-main verde" onClick={() => setModal({ tipo: 'cartera', tipoCartera: 'ahorros' })}>Nueva Cartera de Ahorros</button>
      </div>

      <div className="section-header">
        <div className="section-title">Cuentas Bancarias / Carteras</div>
        <div className="section-line" />
      </div>

      <div className="cards-list">
        {gastos.map(c => (
          <div key={c.id} className="cartera-card">
            <span className="cartera-nombre">{c.nombre}</span>
            <span className="cartera-monto">{formatPesos(c.importe)}</span>
            <span className="cartera-tipo">{c.tipoCuenta}</span>
            <div className="cartera-actions" style={{ gridRow: 'span 2', alignSelf: 'start' }}>
              <button className="btn-ojo" onClick={() => toggleBalance(c)}>{c.enBalance ? '👁' : '🙈'}</button>
              <button className="btn-icon" onClick={() => setModal({ tipo: 'cartera', item: c })}>✏️</button>
              <button className="btn-icon" onClick={() => eliminar(c.id)}>✕</button>
            </div>
            <span className="cartera-moneda">{c.moneda}</span>
          </div>
        ))}
        {ahorros.map(c => (
          <div key={c.id} className="cartera-card ahorro">
            <span className="cartera-nombre">{c.nombre}</span>
            <span className="cartera-monto">{formatPesos(c.importe)}</span>
            <span className="cartera-tipo">{c.tipoCuenta}</span>
            <div className="cartera-actions" style={{ gridRow: 'span 2', alignSelf: 'start' }}>
              <button className="btn-ojo" onClick={() => toggleBalance(c)}>{c.enBalance ? '👁' : '🙈'}</button>
              <button className="btn-icon" onClick={() => setModal({ tipo: 'cartera', item: c })}>✏️</button>
              <button className="btn-icon" onClick={() => eliminar(c.id)}>✕</button>
            </div>
            <span className="cartera-moneda">{c.moneda}</span>
          </div>
        ))}
        {carteras.length === 0 && <div className="empty">Sin carteras</div>}
      </div>

      {/* Modal cartera / transferencia */}
      {modal && !showHistorial && (
        <Modal onClose={() => setModal(null)}>
          {modal.tipo === 'transferencia'
            ? <FormTransferencia initial={modal.item} onSave={triggerRefresh} onClose={() => setModal(null)} />
            : <FormCartera initial={modal.item} onSave={triggerRefresh} onClose={() => setModal(null)} />
          }
        </Modal>
      )}

      {/* Historial */}
      {showHistorial && (
        <Modal onClose={() => setShowHistorial(false)}>
          <div className="modal-title">Historial de Transferencias</div>
          <div className="cards-list" style={{ paddingBottom: 0 }}>
            {transferencias.length === 0 && <div className="empty">Sin transferencias</div>}
            {transferencias.map(t => (
              <div key={t.id} className="card">
                <div className="card-grid">
                  <span className="card-cat">{getNombreCartera(t.cuentaOrigen)} → {getNombreCartera(t.cuentaDestino)}</span>
                  <span className="card-importe">{formatPesos(t.importe)}</span>
                  <span className="card-fecha">{t.fecha}</span>
                  <div className="card-actions">
                    <button className="btn-icon" onClick={() => eliminarTransferencia(t.id)}>✕</button>
                  </div>
                  {t.comentarios && <span className="card-cartera">{t.comentarios}</span>}
                </div>
              </div>
            ))}
          </div>
          <button className="btn-main negro full" onClick={() => { setShowHistorial(false); setModal({ tipo: 'transferencia' }); }}>Nueva Transferencia</button>
        </Modal>
      )}
    </div>
  );
}
