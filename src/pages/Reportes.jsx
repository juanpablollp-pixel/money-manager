import { useState, useEffect, useMemo } from 'react';
import { db, getAjuste } from '../db/database';
import { formatPesos, esDolar, esMismoPeriodo, nombreMes } from '../utils/format';
import { useApp } from '../context/AppContext';
import Header from '../components/Header';
import PeriodSelector from '../components/PeriodSelector';

const COLORES = [
  '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e',
  '#14b8a6', '#06b6d4', '#3b82f6', '#6366f1', '#a855f7',
  '#d946ef', '#ec4899', '#64748b', '#78716c',
];

function aARS(m, dolarFallback) {
  return esDolar(m.moneda) ? m.importe * (m.dolarUsado ?? dolarFallback) : m.importe;
}

// ===== Gráfico de barras: evolución 12 meses =====
function GraficoBarras({ datos, fmt }) {
  const maxValor = Math.max(1, ...datos.flatMap(d => [d.ingresos, d.gastos]));
  const H = 180;
  const W = 320;
  const padTop = 12;
  const padBottom = 28;
  const padLeft = 6;
  const padRight = 6;
  const innerH = H - padTop - padBottom;
  const slot = (W - padLeft - padRight) / datos.length;
  const barW = (slot - 4) / 2;

  return (
    <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <svg width={W} height={H} style={{ display: 'block' }}>
        {datos.map((d, i) => {
          const x0 = padLeft + slot * i + 2;
          const hIng = (d.ingresos / maxValor) * innerH;
          const hGas = (d.gastos / maxValor) * innerH;
          return (
            <g key={`${d.anio}-${d.mes}`}>
              <rect
                x={x0}
                y={padTop + innerH - hIng}
                width={barW}
                height={hIng}
                fill="#22c55e"
                rx={2}
                style={{
                  transformOrigin: `${x0 + barW / 2}px ${padTop + innerH}px`,
                  animation: `grow-up 0.5s ${i * 40}ms cubic-bezier(0.2, 0.7, 0.2, 1) backwards`,
                }}
              >
                <title>{nombreMes(d.mes)} {d.anio}: ingresos {fmt(d.ingresos)}</title>
              </rect>
              <rect
                x={x0 + barW + 1}
                y={padTop + innerH - hGas}
                width={barW}
                height={hGas}
                fill="#ef4444"
                rx={2}
                style={{
                  transformOrigin: `${x0 + barW + 1 + barW / 2}px ${padTop + innerH}px`,
                  animation: `grow-up 0.5s ${i * 40 + 80}ms cubic-bezier(0.2, 0.7, 0.2, 1) backwards`,
                }}
              >
                <title>{nombreMes(d.mes)} {d.anio}: gastos {fmt(d.gastos)}</title>
              </rect>
              <text x={x0 + barW} y={H - 12} fontSize="10" textAnchor="middle" fill="#64748b">
                {nombreMes(d.mes).slice(0, 3)}
              </text>
              <text x={x0 + barW} y={H - 2} fontSize="9" textAnchor="middle" fill="#94a3b8">
                {String(d.anio).slice(2)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ===== Gráfico de torta: distribución por categoría =====
function GraficoTorta({ slices, fmt }) {
  const total = slices.reduce((a, s) => a + s.monto, 0);
  if (total === 0) return <div className="empty">Sin datos</div>;
  const R = 70;
  const cx = 90;
  const cy = 90;
  // Precalcular acumulado de cada slice (sin mutar en el map).
  const enriched = slices.reduce((arr, s) => {
    const prev = arr.length === 0 ? 0 : arr[arr.length - 1].end;
    const frac = s.monto / total;
    arr.push({ ...s, start: prev, end: prev + frac, frac });
    return arr;
  }, []);
  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
      <svg width={180} height={180}>
        {enriched.map((s, i) => {
          const { frac, start, end } = s;
          const a0 = start * 2 * Math.PI - Math.PI / 2;
          const a1 = end * 2 * Math.PI - Math.PI / 2;
          const x0 = cx + R * Math.cos(a0);
          const y0 = cy + R * Math.sin(a0);
          const x1 = cx + R * Math.cos(a1);
          const y1 = cy + R * Math.sin(a1);
          const largeArc = frac > 0.5 ? 1 : 0;
          const path = `M ${cx} ${cy} L ${x0} ${y0} A ${R} ${R} 0 ${largeArc} 1 ${x1} ${y1} Z`;
          return (
            <path
              key={s.nombre}
              d={path}
              fill={COLORES[i % COLORES.length]}
              style={{
                transformOrigin: `${cx}px ${cy}px`,
                animation: `fade-scale 0.4s ${i * 60}ms cubic-bezier(0.2, 0.7, 0.2, 1) backwards`,
              }}
            >
              <title>{s.nombre}: {fmt(s.monto)} ({(frac * 100).toFixed(1)}%)</title>
            </path>
          );
        })}
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 140 }}>
        {enriched.map((s, i) => (
          <div key={s.nombre} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem' }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: COLORES[i % COLORES.length] }} />
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.nombre}</span>
            <span style={{ color: 'var(--gris-oscuro)' }}>{(s.frac * 100).toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Reportes() {
  const { refreshKey, periodo } = useApp();
  const [movimientos, setMovimientos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [separador, setSeparador] = useState('coma');
  const [dolarMep, setDolarMep] = useState(1000);
  const [compMesA, setCompMesA] = useState('');
  const [compMesB, setCompMesB] = useState('');

  useEffect(() => {
    async function load() {
      const [movs, cats, sep, dolar] = await Promise.all([
        db.movimientos.toArray(),
        db.categorias.toArray(),
        getAjuste('separadorDecimal'),
        getAjuste('dolarMep'),
      ]);
      setMovimientos(movs);
      setCategorias(cats);
      setSeparador(sep || 'coma');
      setDolarMep(parseFloat(dolar) || 1000);
    }
    load();
  }, [refreshKey]);

  const fmt = v => formatPesos(v, separador);

  // Evolución 12 meses (hasta el período seleccionado).
  const evolucion = useMemo(() => {
    const out = [];
    let m = periodo.mes - 11;
    let y = periodo.anio;
    while (m <= 0) { m += 12; y -= 1; }
    let cm = m, cy = y;
    for (let i = 0; i < 12; i++) {
      const ingresos = movimientos
        .filter(x => x.tipo === 'ingreso' && esMismoPeriodo(x.fecha, cm, cy))
        .reduce((a, x) => a + aARS(x, dolarMep), 0);
      const gastos = movimientos
        .filter(x => x.tipo === 'gasto' && esMismoPeriodo(x.fecha, cm, cy))
        .reduce((a, x) => a + aARS(x, dolarMep), 0);
      out.push({ mes: cm, anio: cy, ingresos, gastos });
      cm += 1; if (cm > 12) { cm = 1; cy += 1; }
    }
    return out;
  }, [movimientos, periodo, dolarMep]);

  // Distribución por categoría del período seleccionado (gastos).
  const distribucion = useMemo(() => {
    const map = new Map();
    for (const m of movimientos) {
      if (m.tipo !== 'gasto') continue;
      if (!esMismoPeriodo(m.fecha, periodo.mes, periodo.anio)) continue;
      const ars = aARS(m, dolarMep);
      map.set(m.categoriaId, (map.get(m.categoriaId) || 0) + ars);
    }
    const slices = [];
    for (const [catId, monto] of map) {
      const cat = categorias.find(c => c.id === catId);
      slices.push({ nombre: cat?.nombre || '—', monto });
    }
    return slices.sort((a, b) => b.monto - a.monto);
  }, [movimientos, categorias, periodo, dolarMep]);

  // Comparación de meses: opciones disponibles (períodos con movimientos).
  const periodosDisponibles = useMemo(() => {
    const set = new Map();
    for (const m of movimientos) {
      if (!m.fecha) continue;
      const [y, mo] = m.fecha.split('-').map(Number);
      if (!y || !mo) continue;
      set.set(`${y}-${String(mo).padStart(2, '0')}`, { mes: mo, anio: y });
    }
    return [...set.values()].sort((a, b) => a.anio !== b.anio ? a.anio - b.anio : a.mes - b.mes);
  }, [movimientos]);

  // Default compMesA/B: penúltimo y último.
  useEffect(() => {
    if (periodosDisponibles.length >= 2 && !compMesA && !compMesB) {
      const ult = periodosDisponibles[periodosDisponibles.length - 1];
      const pen = periodosDisponibles[periodosDisponibles.length - 2];
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCompMesA(`${pen.anio}-${String(pen.mes).padStart(2, '0')}`);
      setCompMesB(`${ult.anio}-${String(ult.mes).padStart(2, '0')}`);
    }
  }, [periodosDisponibles, compMesA, compMesB]);

  const comparacion = useMemo(() => {
    if (!compMesA || !compMesB) return null;
    const [yA, mA] = compMesA.split('-').map(Number);
    const [yB, mB] = compMesB.split('-').map(Number);
    function gastosPorCat(mes, anio) {
      const map = new Map();
      for (const m of movimientos) {
        if (m.tipo !== 'gasto') continue;
        if (!esMismoPeriodo(m.fecha, mes, anio)) continue;
        const ars = aARS(m, dolarMep);
        map.set(m.categoriaId, (map.get(m.categoriaId) || 0) + ars);
      }
      return map;
    }
    const gA = gastosPorCat(mA, yA);
    const gB = gastosPorCat(mB, yB);
    const todasCats = new Set([...gA.keys(), ...gB.keys()]);
    const filas = [];
    for (const catId of todasCats) {
      const a = gA.get(catId) || 0;
      const b = gB.get(catId) || 0;
      const cat = categorias.find(c => c.id === catId);
      filas.push({ nombre: cat?.nombre || '—', a, b, delta: b - a });
    }
    return filas.sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta));
  }, [compMesA, compMesB, movimientos, categorias, dolarMep]);

  return (
    <div className="page">
      <Header title="Reportes" showBack />
      <PeriodSelector />

      <div className="section-header">
        <div className="section-title">Evolución últimos 12 meses</div>
        <div className="section-line" />
      </div>
      <div className="resumen" style={{ paddingBottom: 8 }}>
        <GraficoBarras datos={evolucion} fmt={fmt} />
        <div style={{ display: 'flex', justifyContent: 'center', gap: 16, fontSize: '0.75rem', marginTop: 6 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: '#22c55e' }} /> Ingresos
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: '#ef4444' }} /> Gastos
          </span>
        </div>
      </div>

      <div className="section-header">
        <div className="section-title">Distribución de gastos</div>
        <div className="section-line" />
      </div>
      <div className="resumen">
        <GraficoTorta slices={distribucion} fmt={fmt} />
      </div>

      <div className="section-header">
        <div className="section-title">Comparación de meses</div>
        <div className="section-line" />
      </div>
      <div className="resumen" style={{ gap: 8 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <select className="form-select" value={compMesA} onChange={e => setCompMesA(e.target.value)} style={{ flex: 1 }}>
            <option value="">Mes A</option>
            {periodosDisponibles.map(p => (
              <option key={`a-${p.anio}-${p.mes}`} value={`${p.anio}-${String(p.mes).padStart(2, '0')}`}>
                {nombreMes(p.mes)} {p.anio}
              </option>
            ))}
          </select>
          <select className="form-select" value={compMesB} onChange={e => setCompMesB(e.target.value)} style={{ flex: 1 }}>
            <option value="">Mes B</option>
            {periodosDisponibles.map(p => (
              <option key={`b-${p.anio}-${p.mes}`} value={`${p.anio}-${String(p.mes).padStart(2, '0')}`}>
                {nombreMes(p.mes)} {p.anio}
              </option>
            ))}
          </select>
        </div>
        {comparacion && comparacion.length === 0 && <div className="empty">Sin gastos</div>}
        {comparacion && comparacion.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: '4px 10px', fontSize: '0.7rem', color: 'var(--gris-oscuro)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <span>Categoría</span>
              <span style={{ textAlign: 'right' }}>A</span>
              <span style={{ textAlign: 'right' }}>B</span>
              <span style={{ textAlign: 'right' }}>Δ</span>
            </div>
            {comparacion.map((f, i) => (
              <div
                key={f.nombre}
                style={{
                  display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: '4px 10px',
                  fontSize: '0.78rem', alignItems: 'baseline',
                  animation: `slide-in 0.3s ${i * 30}ms cubic-bezier(0.2, 0.7, 0.2, 1) backwards`,
                }}
              >
                <span>{f.nombre}</span>
                <span style={{ textAlign: 'right', color: 'var(--gris-oscuro)' }}>{fmt(f.a)}</span>
                <span style={{ textAlign: 'right' }}>{fmt(f.b)}</span>
                <span style={{ textAlign: 'right', color: f.delta > 0 ? 'var(--rojo)' : f.delta < 0 ? 'var(--verde)' : 'var(--gris-oscuro)', fontWeight: 600 }}>
                  {f.delta > 0 ? '+' : ''}{fmt(f.delta)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
