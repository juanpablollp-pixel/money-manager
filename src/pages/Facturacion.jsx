import { useState, useEffect } from 'react';
import { db, getAjuste } from '../db/database';
import { formatPesos } from '../utils/format';
import { useApp } from '../context/AppContext';
import Header from '../components/Header';
import Modal from '../components/Modal';
import FormFacturacion from '../components/FormFacturacion';
import { Pencil, X } from 'lucide-react';
import FitButton from '../components/FitButton';

export default function Facturacion() {
  const { refreshKey, triggerRefresh } = useApp();
  const [facturacion, setFacturacion] = useState([]);
  const [dolarMep, setDolarMep] = useState(1000);
  const [separador, setSeparador] = useState('coma');
  const [modal, setModal] = useState(null);

  const now = new Date();
  const mesActual = now.getMonth() + 1;
  const anioActual = now.getFullYear();

  useEffect(() => {
    async function load() {
      const [facts, sep, dolar] = await Promise.all([
        db.facturacion.toArray(),
        getAjuste('separadorDecimal'),
        getAjuste('dolarMep'),
      ]);
      setFacturacion(facts.filter(f => f.mes === mesActual && f.anio === anioActual));
      setSeparador(sep || 'coma');
      setDolarMep(parseFloat(dolar) || 1000);
    }
    load();
  }, [refreshKey]);

  async function eliminar(id) {
    if (!confirm('¿Eliminar registro de facturación?')) return;
    await db.facturacion.delete(id);
    triggerRefresh();
  }

  const fmt = v => formatPesos(v, separador);
  const total = facturacion.reduce(
    (acc, f) => acc + (f.moneda === 'Dólares' ? f.importe * dolarMep : f.importe),
    0
  );

  const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

  return (
    <div className="page">
      <Header title="Facturación" showBack />

      <FitButton className="btn-main negro full" onClick={() => setModal({})}>
        Agregar Facturación
      </FitButton>

      <div className="resumen">
        <div className="resumen-row">
          <span className="resumen-label">Mes</span>
          <span className="resumen-valor">{meses[mesActual - 1]} {anioActual}</span>
        </div>
        <div className="resumen-divider" />
        <div className="resumen-row">
          <span className="resumen-label">Total Facturado</span>
          <span className="resumen-valor" style={{ color: 'var(--verde)' }}>{fmt(total)}</span>
        </div>
      </div>

      <div className="section-header">
        <div className="section-title">Detalle del Mes</div>
        <div className="section-line" />
      </div>

      <div className="cards-list">
        {facturacion.length === 0 && <div className="empty">Sin registros de facturación</div>}
        {facturacion.map(f => (
          <div key={f.id} className="presupuesto-card">
            <div className="presupuesto-body">
              <span className="card-title">{f.empresa || '—'}</span>
              <span className="card-date">
                {f.moneda === 'Dólares' ? `Dólares → ${fmt(f.importe * dolarMep)}` : 'Pesos'}
              </span>
            </div>
            <div className="card-right">
              <span className="card-importe">
                {f.moneda === 'Dólares' ? `$${f.importe}` : fmt(f.importe)}
              </span>
              <div className="card-actions">
                <button className="btn-icon" onClick={() => setModal({ item: f })}><Pencil size={15} /></button>
                <button className="btn-icon rojo" onClick={() => eliminar(f.id)}><X size={15} /></button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {modal && (
        <Modal onClose={() => setModal(null)}>
          <FormFacturacion
            initial={modal.item}
            onSave={triggerRefresh}
            onClose={() => setModal(null)}
          />
        </Modal>
      )}
    </div>
  );
}
