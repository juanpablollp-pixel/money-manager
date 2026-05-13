import { useEffect, useState } from 'react';
import { db, getAjuste, registrarCambio } from '../db/database';
import { formatPesos, esDolar, esPeso } from '../utils/format';
import Modal from './Modal';
import { RefreshCw, Wrench } from 'lucide-react';

// Recalcula el saldo "esperado" de cada cartera a partir de sus movimientos
// y transferencias, asumiendo saldo inicial 0. La diferencia con el saldo
// guardado representa el saldo inicial implícito (cuando se creó la cartera)
// más cualquier drift acumulado por bugs o ediciones manuales.
function toNativa(imp, monedaOrigen, cartera, tasa) {
  if (!cartera || monedaOrigen === cartera.moneda) return imp;
  if (esDolar(monedaOrigen) && esPeso(cartera.moneda)) return imp * tasa;
  if (esPeso(monedaOrigen) && esDolar(cartera.moneda)) return imp / tasa;
  return imp;
}

function reconstruir(cartera, movimientos, transferencias, dolarFallback) {
  let saldo = 0;
  for (const m of movimientos) {
    if (m.carteraId !== cartera.id) continue;
    const tasa = m.dolarUsado ?? dolarFallback;
    const nat = toNativa(m.importe, m.moneda, cartera, tasa);
    saldo += m.tipo === 'ingreso' ? nat : -nat;
  }
  for (const t of transferencias) {
    if (t.cuentaOrigen !== cartera.id && t.cuentaDestino !== cartera.id) continue;
    const tasa = t.dolarUsado ?? dolarFallback;
    const nat = toNativa(t.importe, t.moneda, cartera, tasa);
    if (t.cuentaOrigen === cartera.id) saldo -= nat;
    if (t.cuentaDestino === cartera.id) saldo += nat;
  }
  return Math.round(saldo * 100) / 100;
}

export default function ModalReconciliacion({ onClose }) {
  const [filas, setFilas] = useState([]);
  const [separador, setSeparador] = useState('coma');
  const [cargando, setCargando] = useState(true);

  async function recalcular() {
    setCargando(true);
    const [carts, movs, trans, dolar, sep] = await Promise.all([
      db.carteras.toArray(),
      db.movimientos.toArray(),
      db.transferencias.toArray(),
      getAjuste('dolarMep'),
      getAjuste('separadorDecimal'),
    ]);
    const dolarFallback = parseFloat(dolar) || 1000;
    setSeparador(sep || 'coma');
    const result = carts.map(c => {
      const recalc = reconstruir(c, movs, trans, dolarFallback);
      const guardado = Math.round((c.importe || 0) * 100) / 100;
      // Saldo inicial implícito = guardado - recalculado (con saldo inicial 0).
      // Si una cartera ya tiene un movimiento "Saldo inicial", su recalc incluye ese ingreso,
      // así que la "diferencia" debería tender a 0.
      const diferencia = Math.round((guardado - recalc) * 100) / 100;
      return { cartera: c, guardado, recalc, diferencia };
    });
    setFilas(result);
    setCargando(false);
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { recalcular(); }, []);

  async function corregir(carteraId, nuevoSaldo) {
    if (!confirm(`¿Ajustar el saldo guardado a ${formatPesos(nuevoSaldo, separador)}?`)) return;
    await db.carteras.update(carteraId, { importe: nuevoSaldo });
    await registrarCambio();
    await recalcular();
  }

  const fmt = v => formatPesos(v, separador);

  return (
    <Modal onClose={onClose}>
      <div className="modal-title">Reconciliación de Saldos</div>
      <div style={{ fontSize: '0.78rem', color: 'var(--gris-oscuro)', lineHeight: 1.4, marginBottom: 4 }}>
        Compara el saldo guardado de cada cartera con el recalculado a partir de sus movimientos y transferencias (asumiendo saldo inicial 0). Una diferencia distinta a cero representa el saldo inicial implícito (cuando creaste la cartera) o un drift por ediciones manuales.
      </div>
      <div className="form-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="form-section-title" style={{ margin: 0 }}>Carteras</div>
          <button className="btn-icon" onClick={recalcular} title="Recalcular" disabled={cargando}>
            <RefreshCw size={14} style={{ animation: cargando ? 'spin 1s linear infinite' : 'none' }} />
          </button>
        </div>
        {filas.length === 0 && !cargando && <div className="empty">Sin carteras</div>}
        {filas.map(f => (
          <div key={f.cartera.id} style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '6px 0', borderBottom: '1px solid var(--gris-claro)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 600 }}>{f.cartera.nombre}</span>
              <span style={{ fontSize: '0.7rem', color: 'var(--gris-oscuro)' }}>{f.cartera.moneda}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
              <span style={{ color: 'var(--gris-oscuro)' }}>Guardado</span>
              <span>{fmt(f.guardado)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
              <span style={{ color: 'var(--gris-oscuro)' }}>Recalculado (desde 0)</span>
              <span>{fmt(f.recalc)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem' }}>
              <span style={{ color: 'var(--gris-oscuro)' }}>Saldo inicial implícito</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: f.diferencia === 0 ? 'var(--verde)' : 'var(--gris-oscuro)' }}>{fmt(f.diferencia)}</span>
                {f.diferencia !== 0 && (
                  <button
                    className="btn-icon"
                    title="Ajustar saldo guardado al recalculado (poner saldo inicial implícito en 0)"
                    style={{ width: 24, height: 24 }}
                    onClick={() => corregir(f.cartera.id, f.recalc)}
                  >
                    <Wrench size={12} />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="btn-row">
        <button className="btn-main gris-claro" onClick={onClose}>Cerrar</button>
      </div>
    </Modal>
  );
}
