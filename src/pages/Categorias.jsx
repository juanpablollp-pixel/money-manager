import { useState, useEffect } from 'react';
import { db, registrarCambio } from '../db/database';
import { useApp } from '../context/AppContext';
import Header from '../components/Header';
import Modal from '../components/Modal';
import FormCategoria from '../components/FormCategoria';
import { Pencil, X } from 'lucide-react';
import FitButton from '../components/FitButton';

export default function Categorias() {
  const { refreshKey, triggerRefresh } = useApp();
  const [categorias, setCategorias] = useState([]);
  const [modal, setModal] = useState(null);

  useEffect(() => { db.categorias.toArray().then(setCategorias); }, [refreshKey]);

  async function eliminar(id) {
    if (!confirm('¿Eliminar?')) return;
    await db.categorias.delete(id);
    await registrarCambio();
    triggerRefresh();
  }

  const gastos = categorias.filter(c => c.tipo === 'gastos');
  const ingresos = categorias.filter(c => c.tipo === 'ingresos');

  return (
    <div className="page">
      <Header title="Categorías" showBack />

      <FitButton className="btn-main negro full" onClick={() => setModal({})}>
        Agregar Nueva Categoría
      </FitButton>

      <div className="section-header">
        <div className="section-title">Detalle de Categorías</div>
        <div className="section-line" />
      </div>

      <div className="cards-list">
        {gastos.length > 0 && (
          <div style={{ fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--rojo)' }}>Gastos</div>
        )}
        {gastos.map(c => (
          <div key={c.id} className="categoria-card">
            <span className="categoria-nombre">{c.nombre}</span>
            <div className="card-actions">
              <button className="btn-icon" onClick={() => setModal({ item: c })}><Pencil size={15} /></button>
              <button className="btn-icon rojo" onClick={() => eliminar(c.id)}><X size={15} /></button>
            </div>
          </div>
        ))}

        {ingresos.length > 0 && (
          <div style={{ fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--verde)', marginTop: 8 }}>Ingresos</div>
        )}
        {ingresos.map(c => (
          <div key={c.id} className="categoria-card">
            <span className="categoria-nombre">{c.nombre}</span>
            <div className="card-actions">
              <button className="btn-icon" onClick={() => setModal({ item: c })}><Pencil size={15} /></button>
              <button className="btn-icon rojo" onClick={() => eliminar(c.id)}><X size={15} /></button>
            </div>
          </div>
        ))}
        {categorias.length === 0 && <div className="empty">Sin categorías</div>}
      </div>

      {modal && (
        <Modal onClose={() => setModal(null)}>
          <FormCategoria initial={modal.item} onSave={triggerRefresh} onClose={() => setModal(null)} />
        </Modal>
      )}
    </div>
  );
}
