import { useEffect, useState } from 'react';
import { db, getAjuste, registrarCambio } from '../db/database';
import { formatPesos, esDolar, esPeso } from '../utils/format';
import Modal from './Modal';
import { RefreshCw, Wrench, ChevronDown, FilePlus } from 'lucide-react';

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
  const [expandida, setExpandida] = useState(null); // id de cartera abierta

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

  useEffect(() => { recalcular(); }, []);

  async function corregir(carteraId, nuevoSaldo) {
    if (!confirm(
      `Vas a AJUSTAR el saldo guardado a ${formatPesos(nuevoSaldo, separador)}.\n\n` +
      `Esto borra el "saldo inicial implícito" sin crear ningún movimiento. Útil sólo si la diferencia es un drift o ruido (centavitos por redondeo), NO si es plata real con la que arrancaste.\n\n` +
      `¿Continuar?`
    )) return;
    await db.carteras.update(carteraId, { importe: nuevoSaldo });
    await registrarCambio();
    await recalcular();
  }

  // Convierte la diferencia en un movimiento "Saldo inicial" del día anterior al
  // primer movimiento de la cartera. NO toca el saldo guardado: el ingreso/gasto
  // se inserta directamente con db.movimientos.add (sin pasar por el form que
  // actualizaría cartera.importe). Como ambos lados de la balanza suben en la
  // misma cantidad, la diferencia queda en 0 sin modificar el saldo actual.
  async function convertirEnMovimiento(cartera, diferencia) {
    const tipoMov = diferencia > 0 ? 'ingreso' : 'gasto';
    const monto = Math.abs(diferencia);
    if (!confirm(
      `Vas a CREAR un movimiento "${tipoMov}" llamado "Saldo inicial" por ${formatPesos(monto, separador)} en ${cartera.nombre}.\n\n` +
      `El saldo guardado NO se modifica. Esto convierte la diferencia "implícita" en un movimiento trazable con fecha previa al primer movimiento de la cartera.\n\n` +
      `¿Continuar?`
    )) return;
    // Buscar/crear la categoría "Saldo inicial" del tipo correcto.
    const tipoCat = tipoMov === 'ingreso' ? 'ingresos' : 'gastos';
    let cat = await db.categorias.filter(c => c.nombre === 'Saldo inicial' && c.tipo === tipoCat).first();
    if (!cat) {
      const newId = await db.categorias.add({ nombre: 'Saldo inicial', tipo: tipoCat });
      cat = { id: newId, nombre: 'Saldo inicial', tipo: tipoCat };
    }
    // Fecha: un día antes del primer movimiento/transferencia de la cartera, o hoy si no hay.
    const [movs, trans] = await Promise.all([
      db.movimientos.where('carteraId').equals(cartera.id).toArray(),
      db.transferencias.filter(t => t.cuentaOrigen === cartera.id || t.cuentaDestino === cartera.id).toArray(),
    ]);
    let primera = null;
    for (const m of movs) if (m.fecha && (!primera || m.fecha < primera)) primera = m.fecha;
    for (const t of trans) if (t.fecha && (!primera || t.fecha < primera)) primera = t.fecha;
    let fechaInicial;
    if (primera) {
      const d = new Date(primera + 'T00:00:00');
      d.setDate(d.getDate() - 1);
      fechaInicial = d.toISOString().split('T')[0];
    } else {
      fechaInicial = new Date().toISOString().split('T')[0];
    }
    // Insertar sin tocar el saldo guardado de la cartera.
    const data = {
      tipo: tipoMov,
      fecha: fechaInicial,
      empresa: 'Saldo inicial',
      categoriaId: cat.id,
      carteraId: cartera.id,
      importe: monto,
      moneda: cartera.moneda,
      // eslint-disable-next-line react-hooks/purity
      createdAt: Date.now(),
    };
    if (esDolar(cartera.moneda)) {
      const dolarActual = parseFloat(await getAjuste('dolarMep')) || 1000;
      data.dolarUsado = dolarActual;
    }
    await db.movimientos.add(data);
    await registrarCambio();
    await recalcular();
  }

  const fmt = v => formatPesos(v, separador);

  return (
    <Modal onClose={onClose}>
      <div className="modal-header-row">
        <div className="modal-title">Reconciliación de Saldos</div>
        <button className="btn-icon" onClick={recalcular} title="Recalcular" disabled={cargando} style={{ width: 32, height: 32 }}>
          <RefreshCw size={14} style={{ animation: cargando ? 'spin 1s linear infinite' : 'none' }} />
        </button>
      </div>
      <div style={{ fontSize: '0.72rem', color: 'var(--gris-oscuro)', lineHeight: 1.4, marginBottom: 6 }}>
        Saldo guardado vs recalculado desde 0. La diferencia puede ser tu saldo inicial real (plata con la que arrancaste) o un drift por redondeos. Expandí una cartera para verlo en detalle.
      </div>
      <div style={{ display: 'flex', gap: 10, fontSize: '0.68rem', color: 'var(--gris-oscuro)', marginBottom: 8, lineHeight: 1.3 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <FilePlus size={11} /> Crear movimiento "Saldo inicial"
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <Wrench size={11} /> Ajustar saldo (sólo para drifts)
        </span>
      </div>
      <div className="cards-list modal-scroll-list" style={{ gap: 4 }}>
        {filas.length === 0 && !cargando && <div className="empty">Sin carteras</div>}
        {filas.map(f => {
          const abierta = expandida === f.cartera.id;
          const ok = f.diferencia === 0;
          return (
            <div
              key={f.cartera.id}
              style={{
                background: 'var(--blanco)',
                border: '1px solid var(--gris-claro)',
                borderRadius: 8,
                overflow: 'hidden',
              }}
            >
              <div
                onClick={() => setExpandida(abierta ? null : f.cartera.id)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto auto',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 10px',
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <span style={{ fontWeight: 600, fontSize: '0.88rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {f.cartera.nombre}
                  </span>
                  <span style={{ fontSize: '0.68rem', color: 'var(--gris-oscuro)' }}>
                    {f.cartera.moneda} · {fmt(f.guardado)}
                  </span>
                </div>
                <span style={{
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  color: ok ? 'var(--verde)' : (f.diferencia > 0 ? 'var(--gris-oscuro)' : 'var(--rojo)'),
                  whiteSpace: 'nowrap',
                }}>
                  {ok ? '✓' : fmt(f.diferencia)}
                </span>
                <ChevronDown
                  size={14}
                  style={{
                    color: 'var(--gris-oscuro)',
                    transform: abierta ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s',
                  }}
                />
              </div>
              {abierta && (
                <div style={{ padding: '0 10px 8px', display: 'flex', flexDirection: 'column', gap: 3, fontSize: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--gris-oscuro)' }}>Guardado</span>
                    <span>{fmt(f.guardado)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--gris-oscuro)' }}>Recalculado (desde 0)</span>
                    <span>{fmt(f.recalc)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
                    <span style={{ color: 'var(--gris-oscuro)' }}>Saldo inicial implícito</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontWeight: 600, color: ok ? 'var(--verde)' : 'var(--negro)' }}>{fmt(f.diferencia)}</span>
                      {!ok && (
                        <>
                          <button
                            className="btn-icon"
                            title="Crear movimiento &quot;Saldo inicial&quot; (no modifica el saldo guardado)"
                            style={{ width: 22, height: 22 }}
                            onClick={(e) => { e.stopPropagation(); convertirEnMovimiento(f.cartera, f.diferencia); }}
                          >
                            <FilePlus size={11} />
                          </button>
                          <button
                            className="btn-icon"
                            title="Ajustar saldo guardado al recalculado (sólo para drifts)"
                            style={{ width: 22, height: 22 }}
                            onClick={(e) => { e.stopPropagation(); corregir(f.cartera.id, f.recalc); }}
                          >
                            <Wrench size={11} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="btn-row">
        <button className="btn-main gris-claro" onClick={onClose}>Cerrar</button>
      </div>
    </Modal>
  );
}
