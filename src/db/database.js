import Dexie from 'dexie';

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
export async function registrarCambio() {
  const actual = parseInt(await getAjuste('cambiosDesdeBackup'), 10) || 0;
  await setAjuste('cambiosDesdeBackup', String(actual + 1));
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
