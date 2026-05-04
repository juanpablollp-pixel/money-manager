import { useState } from 'react';
import { AlertTriangle, Download } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { snoozeBackup24h } from '../db/database';
import { exportarBackup } from '../utils/backup';

export default function BannerBackup() {
  const { avisoBackup, triggerRefresh } = useApp();
  const [trabajando, setTrabajando] = useState(false);

  if (!avisoBackup?.mostrar) return null;

  const { cambios, diasSinBackup, ultimoBackup } = avisoBackup;

  const detalle = (() => {
    const partes = [];
    if (cambios > 0) partes.push(`${cambios} cambio${cambios === 1 ? '' : 's'} sin guardar`);
    if (diasSinBackup !== null && diasSinBackup >= 1) {
      partes.push(`${diasSinBackup} día${diasSinBackup === 1 ? '' : 's'} sin backup`);
    } else if (!ultimoBackup) {
      partes.push('nunca hiciste backup');
    }
    return partes.join(' · ');
  })();

  async function hacerBackup() {
    setTrabajando(true);
    try {
      await exportarBackup();
      triggerRefresh();
    } finally {
      setTrabajando(false);
    }
  }

  async function postergar() {
    setTrabajando(true);
    try {
      await snoozeBackup24h();
      triggerRefresh();
    } finally {
      setTrabajando(false);
    }
  }

  return (
    <div className="banner-backup">
      <div className="banner-backup-icon">
        <AlertTriangle size={18} />
      </div>
      <div className="banner-backup-body">
        <div className="banner-backup-title">Hacé backup de tus datos</div>
        <div className="banner-backup-detail">{detalle}</div>
      </div>
      <div className="banner-backup-actions">
        <button className="banner-backup-btn primary" onClick={hacerBackup} disabled={trabajando}>
          <Download size={14} />
          <span>Backup</span>
        </button>
        <button className="banner-backup-btn ghost" onClick={postergar} disabled={trabajando}>
          Luego
        </button>
      </div>
    </div>
  );
}
