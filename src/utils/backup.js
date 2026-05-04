import { db, marcarBackupHecho } from '../db/database';

export async function exportarBackup() {
  const [movs, carts, press, cats, trans, facts, ajus] = await Promise.all([
    db.movimientos.toArray(),
    db.carteras.toArray(),
    db.presupuestos.toArray(),
    db.categorias.toArray(),
    db.transferencias.toArray(),
    db.facturacion.toArray(),
    db.ajustes.toArray(),
  ]);
  const data = JSON.stringify({
    movimientos: movs,
    carteras: carts,
    presupuestos: press,
    categorias: cats,
    transferencias: trans,
    facturacion: facts,
    ajustes: ajus,
  }, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `moneymanager-backup-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
  await marcarBackupHecho();
}
