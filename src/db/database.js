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
