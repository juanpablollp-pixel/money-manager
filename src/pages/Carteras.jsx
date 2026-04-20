import { useState, useEffect } from 'react';
import { db, getAjuste } from '../db/database';
import { formatPesos } from '../utils/format';
import { useApp } from '../context/AppContext';
import Modal from '../components/Modal';
import FormCartera from '../components/FormCartera';
import FormTransferencia from '../components/FormTransferencia';
import { Pencil, X, Eye, EyeOff } from 'lucide-react';
import FitButton from '../components/FitButton';

export default function Carteras() {
  const { refreshKey, triggerRefresh } = useApp();
  const [carteras, setCarteras] = useState([]);
  const [transferencias, setTransferencias] = useState([]);
  const [separador, setSeparador] = useState('coma');
  const [modal, setModal] = useState(null);
  const [showHistorial, setShowHistorial] = useState(false);

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

  const fmt = v => formatPesos(v, separador);

  const gastos = carteras.filter(c => c.tipo === 'gastos');
  const ahorros = carteras.filter(c => c.tipo === 'ahorros');

  function getNombreCartera(id) {
    return carteras.find(c => c.id === id)?.nombre || id;
  }

  return (
    <div className="page">
<div className="btn-row">
        <FitButton className="btn-main gris-claro" onClick={() => setShowHistorial(true)}>Historial de Transf.</FitButton>
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
          <div className="modal-title">Historial de Transferencias</div>
          <div className="cards-list" style={{ paddingBottom: 0 }}>
            {transferencias.length === 0 && <div className="empty">Sin transferencias</div>}
            {transferencias.map(t => (
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
