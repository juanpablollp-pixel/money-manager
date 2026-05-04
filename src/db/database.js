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
