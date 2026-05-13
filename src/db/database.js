import Dexie from 'dexie';
import { repararMojibake as _repararMojibake } from '../utils/format';
export const repararMojibake = _repararMojibake;

export const db = new Dexie('MoneyManager');

db.version(1).stores({
  movimientos: '++id, tipo, fecha, empresa, categoriaId, carteraId, importe, moneda, createdAt',
  carteras: '++id, nombre, tipo, moneda, importe, enBalance, tipoCuenta',
  presupuestos: '++id, empresa, categoriaId, importe, moneda',
  categorias: '++id, nombre, tipo',
  transferencias: '++id, cuentaOrigen, cuentaDestino, importe, moneda, fecha, comentarios',
  ajustes: '++id, clave, valor',
});

db.version(2).stores({
  facturacion: '++id, empresa, importe, moneda, mes, anio',
});

db.version(3).stores({
  presupuestos: '++id, empresa, categoriaId, importe, moneda, mes, anio',
}).upgrade(async tx => {
  const now = new Date();
  const mes = now.getMonth() + 1;
  const anio = now.getFullYear();
  await tx.table('presupuestos').toCollection().modify(p => {
    if (p.mes == null) p.mes = mes;
    if (p.anio == null) p.anio = anio;
  });
});

db.version(4).stores({
  movimientos: '++id, tipo, fecha, empresa, categoriaId, carteraId, importe, moneda, createdAt, dolarUsado',
}).upgrade(async tx => {
  const ajuste = await tx.table('ajustes').where('clave').equals('dolarMep').first();
  const dolarActual = parseFloat(ajuste?.valor) || 1000;
  await tx.table('movimientos').toCollection().modify(m => {
    if (m.moneda === 'Dólares' && m.dolarUsado == null) {
      m.dolarUsado = dolarActual;
    }
  });
});

db.version(5).stores({
  presupuestos: '++id, empresa, categoriaId, importe, moneda, mes, anio, dolarUsado',
  facturacion: '++id, empresa, importe, moneda, mes, anio, dolarUsado',
}).upgrade(async tx => {
  const ajuste = await tx.table('ajustes').where('clave').equals('dolarMep').first();
  const dolarActual = parseFloat(ajuste?.valor) || 1000;
  await tx.table('presupuestos').toCollection().modify(p => {
    if (p.moneda === 'Dólares' && p.dolarUsado == null) p.dolarUsado = dolarActual;
  });
  await tx.table('facturacion').toCollection().modify(f => {
    if (f.moneda === 'Dólares' && f.dolarUsado == null) f.dolarUsado = dolarActual;
  });
});

db.version(6).stores({
  transferencias: '++id, cuentaOrigen, cuentaDestino, importe, moneda, fecha, comentarios, dolarUsado',
}).upgrade(async tx => {
  const ajuste = await tx.table('ajustes').where('clave').equals('dolarMep').first();
  const dolarActual = parseFloat(ajuste?.valor) || 1000;
  await tx.table('transferencias').toCollection().modify(t => {
    if (t.moneda === 'Dólares' && t.dolarUsado == null) t.dolarUsado = dolarActual;
  });
});

// Redondeo defensivo a centavos: limpia residuos de aritmética flotante en saldos
// de carteras (ej.: 9.09e-13 → 0). No altera saldos legítimos porque toda la app
// trabaja a 2 decimales.
db.version(7).stores({}).upgrade(async tx => {
  await tx.table('carteras').toCollection().modify(c => {
    if (typeof c.importe === 'number') {
      c.importe = Math.round(c.importe * 100) / 100;
    }
  });
});

// Reparación de mojibake: la función está en utils/format.js (importada arriba)
// y re-exportada para que Ajustes.jsx pueda seguir usando esta ruta.

db.version(8).stores({}).upgrade(async tx => {
  await tx.table('carteras').toCollection().modify(c => {
    if (c.nombre) c.nombre = repararMojibake(c.nombre);
    if (c.moneda) c.moneda = repararMojibake(c.moneda);
    if (c.tipoCuenta) c.tipoCuenta = repararMojibake(c.tipoCuenta);
  });
  await tx.table('categorias').toCollection().modify(c => {
    if (c.nombre) c.nombre = repararMojibake(c.nombre);
  });
  await tx.table('movimientos').toCollection().modify(m => {
    if (m.empresa) m.empresa = repararMojibake(m.empresa);
    if (m.moneda) m.moneda = repararMojibake(m.moneda);
  });
  await tx.table('presupuestos').toCollection().modify(p => {
    if (p.empresa) p.empresa = repararMojibake(p.empresa);
    if (p.moneda) p.moneda = repararMojibake(p.moneda);
  });
  await tx.table('transferencias').toCollection().modify(t => {
    if (t.comentarios) t.comentarios = repararMojibake(t.comentarios);
    if (t.moneda) t.moneda = repararMojibake(t.moneda);
  });
  await tx.table('facturacion').toCollection().modify(f => {
    if (f.empresa) f.empresa = repararMojibake(f.empresa);
    if (f.moneda) f.moneda = repararMojibake(f.moneda);
  });
});

// Campo "archivada" en carteras: permite ocultarlas sin perder la historia
// asociada. Se inicializa en false para todas las carteras existentes.
db.version(9).stores({}).upgrade(async tx => {
  await tx.table('carteras').toCollection().modify(c => {
    if (c.archivada == null) c.archivada = false;
  });
});

// Saldos iniciales explícitos: si una cartera tiene saldo distinto al recalculado
// desde 0, crear un movimiento "Saldo inicial" que represente el monto con el que
// fue creada. Así no hay magia en los saldos.
db.version(10).stores({}).upgrade(async tx => {
  const dolarRow = await tx.table('ajustes').where('clave').equals('dolarMep').first();
  const dolarFallback = parseFloat(dolarRow?.valor) || 1000;

  // Obtener/crear las categorías "Saldo inicial" (ingresos y gastos).
  async function ensureCategoria(nombre, tipo) {
    let cat = await tx.table('categorias').filter(c => c.nombre === nombre && c.tipo === tipo).first();
    if (!cat) {
      const newId = await tx.table('categorias').add({ nombre, tipo });
      cat = { id: newId, nombre, tipo };
    }
    return cat;
  }
  const catSaldoIngreso = await ensureCategoria('Saldo inicial', 'ingresos');
  const catSaldoGasto = await ensureCategoria('Saldo inicial', 'gastos');

  const carteras = await tx.table('carteras').toArray();
  const movs = await tx.table('movimientos').toArray();
  const trans = await tx.table('transferencias').toArray();

  function aNativa(imp, monedaOrigen, c, tasa) {
    if (!c || monedaOrigen === c.moneda) return imp;
    const md = String(monedaOrigen || '').toLowerCase();
    const mc = String(c.moneda || '').toLowerCase();
    const esDolMov = md.startsWith('d') || md === 'usd';
    const esPesMov = md.startsWith('p') || md === 'ars';
    const esDolCar = mc.startsWith('d') || mc === 'usd';
    const esPesCar = mc.startsWith('p') || mc === 'ars';
    if (esDolMov && esPesCar) return imp * tasa;
    if (esPesMov && esDolCar) return imp / tasa;
    return imp;
  }

  for (const c of carteras) {
    let recalc = 0;
    let primeraFecha = null;
    for (const m of movs) {
      if (m.carteraId !== c.id) continue;
      const tasa = m.dolarUsado ?? dolarFallback;
      const nat = aNativa(m.importe, m.moneda, c, tasa);
      recalc += m.tipo === 'ingreso' ? nat : -nat;
      if (m.fecha && (!primeraFecha || m.fecha < primeraFecha)) primeraFecha = m.fecha;
    }
    for (const t of trans) {
      if (t.cuentaOrigen !== c.id && t.cuentaDestino !== c.id) continue;
      const tasa = t.dolarUsado ?? dolarFallback;
      const nat = aNativa(t.importe, t.moneda, c, tasa);
      if (t.cuentaOrigen === c.id) recalc -= nat;
      if (t.cuentaDestino === c.id) recalc += nat;
      if (t.fecha && (!primeraFecha || t.fecha < primeraFecha)) primeraFecha = t.fecha;
    }
    recalc = Math.round(recalc * 100) / 100;
    const guardado = Math.round((c.importe || 0) * 100) / 100;
    const diferencia = Math.round((guardado - recalc) * 100) / 100;
    if (diferencia === 0) continue;

    // Fecha del saldo inicial: un día antes del primer movimiento, o hoy si no hay ninguno.
    let fechaInicial;
    if (primeraFecha) {
      const d = new Date(primeraFecha + 'T00:00:00');
      d.setDate(d.getDate() - 1);
      fechaInicial = d.toISOString().split('T')[0];
    } else {
      fechaInicial = new Date().toISOString().split('T')[0];
    }

    const tipo = diferencia > 0 ? 'ingreso' : 'gasto';
    const importe = Math.abs(diferencia);
    const cat = tipo === 'ingreso' ? catSaldoIngreso : catSaldoGasto;
    await tx.table('movimientos').add({
      tipo,
      fecha: fechaInicial,
      empresa: 'Saldo inicial',
      categoriaId: cat.id,
      carteraId: c.id,
      importe,
      moneda: c.moneda,
      createdAt: Date.now(),
    });
  }
});

// Tabla snapshots: saldo "congelado" de cada cartera al cierre de un período.
// Permite calcular balances históricos sin depender del saldo actual.
db.version(11).stores({
  snapshots: '++id, &[carteraId+mes+anio], carteraId, mes, anio, saldoNativo, fecha',
});

// Congelar dolarUsado en todos los presupuestos USD existentes sin tasa fija.
// A partir de esta versión, los presupuestos USD siempre quedan congelados al
// momento de cargarlos (ver FormPresupuesto). Esta migración hace lo mismo para
// los que quedaron sueltos antes del cambio.
db.version(12).stores({}).upgrade(async tx => {
  const ajuste = await tx.table('ajustes').where('clave').equals('dolarMep').first();
  const dolarActual = parseFloat(ajuste?.valor) || 1000;
  await tx.table('presupuestos').toCollection().modify(p => {
    const m = String(p.moneda || '').toLowerCase();
    const esDol = m.startsWith('d') || m === 'usd';
    if (esDol && p.dolarUsado == null) p.dolarUsado = dolarActual;
  });
});

// Seed ajustes por defecto
db.on('populate', async () => {
  await db.ajustes.bulkAdd([
    { clave: 'dolarMep', valor: '1000' },
    { clave: 'periodoDefault', valor: 'mensual' },
    { clave: 'cuentaDefault', valor: '' },
    { clave: 'primerDiaSemana', valor: 'lunes' },
    { clave: 'separadorDecimal', valor: 'coma' },
  ]);
});

export async function getAjuste(clave) {
  const r = await db.ajustes.where('clave').equals(clave).first();
  return r?.valor ?? null;
}

export async function setAjuste(clave, valor) {
  const existing = await db.ajustes.where('clave').equals(clave).first();
  if (existing) await db.ajustes.update(existing.id, { valor });
  else await db.ajustes.add({ clave, valor });
}

// Suma 1 al contador de cambios desde el último backup. Se llama tras cada
// operación que modifica datos (movimientos, presupuestos, transferencias,
// carteras, categorías, facturación). Cambios en `ajustes` no cuentan.
// También invalida todos los snapshots de saldos (se regeneran on-demand).
export async function registrarCambio() {
  const actual = parseInt(await getAjuste('cambiosDesdeBackup'), 10) || 0;
  await setAjuste('cambiosDesdeBackup', String(actual + 1));
  // Snapshots: invalidar todos. Es barato (pocos registros) y garantiza correctness.
  try { await db.snapshots.clear(); } catch { /* tabla puede no existir aún */ }
}

// Marca el momento del backup: resetea contador, guarda timestamp y limpia snooze.
export async function marcarBackupHecho() {
  await setAjuste('cambiosDesdeBackup', '0');
  await setAjuste('ultimoBackup', new Date().toISOString());
  await setAjuste('snoozeBackupHasta', '');
}

// Decide si el banner debe mostrarse.
// Retorna { mostrar, cambios, diasSinBackup, ultimoBackup }
export async function estadoBackup() {
  const cambios = parseInt(await getAjuste('cambiosDesdeBackup'), 10) || 0;
  const ultimoIso = await getAjuste('ultimoBackup');
  const snoozeIso = await getAjuste('snoozeBackupHasta');

  const ahora = Date.now();
  const ultimo = ultimoIso ? new Date(ultimoIso).getTime() : null;
  const diasSinBackup = ultimo ? Math.floor((ahora - ultimo) / 86400000) : null;

  // Snooze activo
  if (snoozeIso) {
    const hasta = new Date(snoozeIso).getTime();
    if (ahora < hasta) {
      return { mostrar: false, cambios, diasSinBackup, ultimoBackup: ultimoIso };
    }
  }

  const superaCambios = cambios >= 5;
  const superaDias = diasSinBackup !== null && diasSinBackup >= 3;
  // Si nunca hizo backup y ya hay cambios, también avisar.
  const nuncaConCambios = ultimo === null && cambios > 0;

  return {
    mostrar: superaCambios || superaDias || nuncaConCambios,
    cambios,
    diasSinBackup,
    ultimoBackup: ultimoIso,
  };
}

export async function snoozeBackup24h() {
  const hasta = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
  await setAjuste('snoozeBackupHasta', hasta);
}

// Obtiene los saldos nativos de cada cartera al fin de (mes, anio).
// Si ya existe un snapshot para ese período (cartera-mes-anio), lo usa.
// Si no, reconstruye desde el saldo actual restando movs/transferencias posteriores
// y lo persiste para próximas consultas (sólo para períodos ya cerrados).
export async function getSaldosPeriodo(mes, anio) {
  const carts = await db.carteras.toArray();
  const ultimoDia = new Date(anio, mes, 0).getDate();
  const finPeriodo = `${anio}-${String(mes).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`;

  const ahora = new Date();
  const mesHoy = ahora.getMonth() + 1;
  const anioHoy = ahora.getFullYear();
  const periodoCerrado = anio < anioHoy || (anio === anioHoy && mes < mesHoy);

  const result = new Map();
  const aPersistir = [];

  for (const c of carts) {
    if (periodoCerrado) {
      const snap = await db.snapshots
        .where('[carteraId+mes+anio]').equals([c.id, mes, anio])
        .first();
      if (snap) { result.set(c.id, snap.saldoNativo); continue; }
    }
    // Reconstruir desde el saldo actual.
    const dolarFallback = parseFloat(await getAjuste('dolarMep')) || 1000;
    const movs = await db.movimientos.toArray();
    const trans = await db.transferencias.toArray();
    let saldo = c.importe;
    function aNativa(imp, moneda, tasa) {
      if (moneda === c.moneda) return imp;
      const md = String(moneda || '').toLowerCase();
      const mc = String(c.moneda || '').toLowerCase();
      const esDolMov = md.startsWith('d') || md === 'usd';
      const esPesMov = md.startsWith('p') || md === 'ars';
      const esDolCar = mc.startsWith('d') || mc === 'usd';
      const esPesCar = mc.startsWith('p') || mc === 'ars';
      if (esDolMov && esPesCar) return imp * tasa;
      if (esPesMov && esDolCar) return imp / tasa;
      return imp;
    }
    for (const m of movs) {
      if (m.fecha <= finPeriodo) continue;
      if (m.carteraId !== c.id) continue;
      const nat = aNativa(m.importe, m.moneda, m.dolarUsado ?? dolarFallback);
      saldo += m.tipo === 'ingreso' ? -nat : nat;
    }
    for (const t of trans) {
      if (t.fecha <= finPeriodo) continue;
      const nat = aNativa(t.importe, t.moneda, t.dolarUsado ?? dolarFallback);
      if (t.cuentaOrigen === c.id) saldo += nat;
      if (t.cuentaDestino === c.id) saldo -= nat;
    }
    saldo = Math.round(saldo * 100) / 100;
    result.set(c.id, saldo);
    if (periodoCerrado) aPersistir.push({ carteraId: c.id, mes, anio, saldoNativo: saldo, fecha: finPeriodo });
  }

  // Persistir snapshots que faltaban (sólo períodos cerrados).
  if (aPersistir.length > 0) {
    try { await db.snapshots.bulkAdd(aPersistir); } catch { /* ya existían: ignorar */ }
  }

  return result;
}

// Invalida snapshots cuyas fechas estén por encima de la fecha de un movimiento
// editado/eliminado. Llamar cuando se altera un movimiento o transferencia.
export async function invalidarSnapshotsDesde(fechaStr) {
  if (!fechaStr) return;
  const [y, m] = fechaStr.split('-').map(Number);
  if (!y || !m) return;
  // Borrar todos los snapshots de períodos ≥ (y, m).
  const todos = await db.snapshots.toArray();
  const ids = todos
    .filter(s => s.anio > y || (s.anio === y && s.mes >= m))
    .map(s => s.id);
  if (ids.length > 0) await db.snapshots.bulkDelete(ids);
}

// Re-evalúa el dolarUsado de un presupuesto USD del período (mes/año/categoría):
// - Si aún hay gastos USD asociados, mantiene el dolarUsado existente.
// - Si no quedan gastos USD asociados Y el período sigue vigente, descongela (dolarUsado = null).
// - Si el período ya pasó, lo deja como esté.
export async function reevaluarPresupuestoUSD(categoriaId, mes, anio) {
  if (categoriaId == null || !mes || !anio) return;
  const presup = await db.presupuestos
    .where({ categoriaId: Number(categoriaId), mes: Number(mes), anio: Number(anio) })
    .filter(p => p.moneda === 'Dólares')
    .first();
  if (!presup) return;

  const now = new Date();
  const mesHoy = now.getMonth() + 1;
  const anioHoy = now.getFullYear();
  const periodoVigenteOFuturo = anio > anioHoy || (anio === anioHoy && mes >= mesHoy);
  if (!periodoVigenteOFuturo) return;

  const prefijo = `${anio}-${String(mes).padStart(2, '0')}`;
  const tieneGastos = await db.movimientos
    .filter(m =>
      m.tipo === 'gasto' &&
      m.moneda === 'Dólares' &&
      m.categoriaId === Number(categoriaId) &&
      typeof m.fecha === 'string' &&
      m.fecha.startsWith(prefijo)
    )
    .count();

  if (tieneGastos === 0 && presup.dolarUsado != null) {
    // Dexie no permite borrar campos con update; reescribimos sin el campo.
    const { dolarUsado: _omit, id, ...rest } = presup;
    await db.presupuestos.delete(id);
    await db.presupuestos.add({ ...rest, id });
  }
}

// Congela la cotización de los presupuestos USD cuyo período ya pasó y que aún no tenían dolarUsado.
// Para cada uno, intenta usar el dólar congelado de algún gasto del mismo mes/categoría;
// si no hay gastos asociados, usa la cotización actual.
export async function congelarPresupuestosVencidos() {
  const now = new Date();
  const mesHoy = now.getMonth() + 1;
  const anioHoy = now.getFullYear();
  const dolarActual = parseFloat(await getAjuste('dolarMep')) || 1000;

  const pendientes = await db.presupuestos
    .filter(p => p.moneda === 'Dólares' && p.dolarUsado == null)
    .toArray();
  if (pendientes.length === 0) return;

  const vencidos = pendientes.filter(p => p.anio < anioHoy || (p.anio === anioHoy && p.mes < mesHoy));
  if (vencidos.length === 0) return;

  const movs = await db.movimientos.toArray();
  for (const p of vencidos) {
    const mes = String(p.mes).padStart(2, '0');
    const prefijo = `${p.anio}-${mes}`;
    const gastoConTasa = movs.find(m =>
      m.tipo === 'gasto' &&
      m.categoriaId === p.categoriaId &&
      m.moneda === 'Dólares' &&
      m.dolarUsado != null &&
      typeof m.fecha === 'string' &&
      m.fecha.startsWith(prefijo)
    );
    const tasa = gastoConTasa?.dolarUsado ?? dolarActual;
    await db.presupuestos.update(p.id, { dolarUsado: tasa });
  }
}
