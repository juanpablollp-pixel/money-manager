import { esDolar } from './format';

// Convierte un importe a ARS según la moneda y la tasa congelada (o fallback).
function aARS(importe, moneda, dolarUsado, dolarFallback) {
  return esDolar(moneda) ? importe * (dolarUsado ?? dolarFallback) : importe;
}

// Calcula el desglose del "Exceso de Gasto" del período.
// - excedentes: por cada categoría presupuestada, lo gastado por encima del tope.
// - huérfanos: gastos cuyas categorías no tienen presupuesto en el período (agrupados por categoría).
// Retorna items ordenados por monto descendente.
export function calcularExcesoDesglose({ presupuestosPeriodo, movsMes, categorias, dolarFallback }) {
  const items = [];
  for (const p of presupuestosPeriodo) {
    const presupARS = aARS(p.importe, p.moneda, p.dolarUsado, dolarFallback);
    const gastadoEnCategoriaARS = movsMes
      .filter(m => m.tipo === 'gasto' && m.categoriaId === p.categoriaId)
      .reduce((sum, m) => sum + aARS(m.importe, m.moneda, m.dolarUsado, dolarFallback), 0);
    const exceso = gastadoEnCategoriaARS - presupARS;
    if (exceso > 0) {
      const cat = categorias.find(c => c.id === p.categoriaId);
      items.push({ tipo: 'excedente', categoriaId: p.categoriaId, nombre: cat?.nombre || '—', monto: exceso });
    }
  }
  const huerfanosPorCat = new Map();
  for (const m of movsMes) {
    if (m.tipo !== 'gasto') continue;
    if (presupuestosPeriodo.some(p => p.categoriaId === m.categoriaId)) continue;
    const ars = aARS(m.importe, m.moneda, m.dolarUsado, dolarFallback);
    huerfanosPorCat.set(m.categoriaId, (huerfanosPorCat.get(m.categoriaId) || 0) + ars);
  }
  for (const [catId, monto] of huerfanosPorCat) {
    const cat = categorias.find(c => c.id === catId);
    items.push({ tipo: 'huerfano', categoriaId: catId, nombre: cat?.nombre || '—', monto });
  }
  return items.sort((a, b) => b.monto - a.monto);
}

// Suma total del desglose.
export function sumarExceso(desglose) {
  return desglose.reduce((acc, it) => acc + it.monto, 0);
}
