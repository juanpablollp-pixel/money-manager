import { useEffect, useMemo, useState } from 'react';
import { db } from '../db/database';
import Modal from './Modal';
import { nombreMes } from '../utils/format';
import { exportarReportePDF } from '../utils/pdfReport';

function ymToValue({ mes, anio }) {
  return `${anio}-${String(mes).padStart(2, '0')}`;
}

function valueToYm(v) {
  const [anio, mes] = v.split('-').map(Number);
  return { mes, anio };
}

function ymCompare(a, b) {
  if (a.anio !== b.anio) return a.anio - b.anio;
  return a.mes - b.mes;
}

export default function ModalEstadoCuenta({ onClose }) {
  const [periodos, setPeriodos] = useState([]);
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [exportando, setExportando] = useState(false);

  useEffect(() => {
    async function load() {
      const [movs, press, facts] = await Promise.all([
        db.movimientos.toArray(),
        db.presupuestos.toArray(),
        db.facturacion.toArray(),
      ]);
      const set = new Map();
      for (const m of movs) {
        if (!m.fecha) continue;
        const [y, mo] = m.fecha.split('-').map(Number);
        if (!y || !mo) continue;
        set.set(`${y}-${String(mo).padStart(2, '0')}`, { mes: mo, anio: y });
      }
      for (const p of press) {
        if (p.mes && p.anio) set.set(`${p.anio}-${String(p.mes).padStart(2, '0')}`, { mes: p.mes, anio: p.anio });
      }
      for (const f of facts) {
        if (f.mes && f.anio) set.set(`${f.anio}-${String(f.mes).padStart(2, '0')}`, { mes: f.mes, anio: f.anio });
      }
      const lista = [...set.values()].sort(ymCompare);
      setPeriodos(lista);
      if (lista.length > 0) {
        const ult = lista[lista.length - 1];
        const v = ymToValue(ult);
        setDesde(v);
        setHasta(v);
      }
    }
    load();
  }, []);

  const opcionesHasta = useMemo(() => {
    if (!desde) return periodos;
    const d = valueToYm(desde);
    return periodos.filter(p => ymCompare(p, d) >= 0);
  }, [periodos, desde]);

  async function handleExportar() {
    if (!desde || !hasta) return;
    setExportando(true);
    try {
      await exportarReportePDF({ desde: valueToYm(desde), hasta: valueToYm(hasta) });
      onClose?.();
    } finally {
      setExportando(false);
    }
  }

  return (
    <Modal onClose={onClose}>
      <div className="modal-title">Estado de Cuenta</div>
      {periodos.length === 0 ? (
        <>
          <div className="empty">No hay datos para exportar</div>
          <div className="btn-row">
            <button className="btn-main gris-claro" onClick={onClose}>Cerrar</button>
          </div>
        </>
      ) : (
        <>
          <div className="form-card">
            <div className="form-section-title">Rango de Períodos</div>
            <div className="form-group">
              <label className="form-label">Desde</label>
              <select
                className="form-select"
                value={desde}
                onChange={e => {
                  const nuevo = e.target.value;
                  setDesde(nuevo);
                  if (hasta && ymCompare(valueToYm(hasta), valueToYm(nuevo)) < 0) {
                    setHasta(nuevo);
                  }
                }}
              >
                {periodos.map(p => {
                  const v = ymToValue(p);
                  return <option key={v} value={v}>{nombreMes(p.mes)} {p.anio}</option>;
                })}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Hasta</label>
              <select
                className="form-select"
                value={hasta}
                onChange={e => setHasta(e.target.value)}
              >
                {opcionesHasta.map(p => {
                  const v = ymToValue(p);
                  return <option key={v} value={v}>{nombreMes(p.mes)} {p.anio}</option>;
                })}
              </select>
            </div>
          </div>
          <div className="btn-row">
            <button className="btn-main gris-claro" onClick={onClose} disabled={exportando}>Cancelar</button>
            <button className="btn-main negro" onClick={handleExportar} disabled={exportando}>
              {exportando ? 'Exportando...' : 'Exportar PDF'}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
