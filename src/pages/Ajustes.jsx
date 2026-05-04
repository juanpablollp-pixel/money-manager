import { useState, useEffect } from 'react';
import { db, getAjuste, setAjuste, marcarBackupHecho } from '../db/database';
import { useApp } from '../context/AppContext';
import Header from '../components/Header';
import { exportarBackup } from '../utils/backup';
import { Upload, Download, RefreshCw } from 'lucide-react';

export default function Ajustes() {
  const { triggerRefresh } = useApp();
  const [carteras, setCarteras] = useState([]);
  const [loadingDolar, setLoadingDolar] = useState(false);
  const [ultimoBackup, setUltimoBackup] = useState(null);
  const [vals, setVals] = useState({
    dolarMep: '',
    periodoDefault: 'mensual',
    cuentaDefault: '',
    primerDiaSemana: 'lunes',
    separadorDecimal: 'coma',
  });

  useEffect(() => {
    async function load() {
      const [carts, dolar, periodo, cuenta, dia, sep, ub] = await Promise.all([
        db.carteras.toArray(),
        getAjuste('dolarMep'),
        getAjuste('periodoDefault'),
        getAjuste('cuentaDefault'),
        getAjuste('primerDiaSemana'),
        getAjuste('separadorDecimal'),
        getAjuste('ultimoBackup'),
      ]);
      setCarteras(carts);
      setUltimoBackup(ub || null);
      setVals({
        dolarMep: dolar || '',
        periodoDefault: periodo || 'mensual',
        cuentaDefault: cuenta || '',
        primerDiaSemana: dia || 'lunes',
        separadorDecimal: sep || 'coma',
      });
    }
    load();
  }, []);

  async function update(clave, valor) {
    setVals(v => ({ ...v, [clave]: valor }));
    await setAjuste(clave, valor);
    triggerRefresh();
  }

  async function fetchDolarMep() {
    setLoadingDolar(true);
    try {
      const res = await fetch('https://dolarapi.com/v1/dolares/bolsa');
      const data = await res.json();
      const valor = ((data.compra + data.venta) / 2).toFixed(2);
      await update('dolarMep', valor);
    } catch {
      alert('No se pudo obtener la cotización. Intentá más tarde.');
    } finally {
      setLoadingDolar(false);
    }
  }

  async function exportData() {
    await exportarBackup();
    setUltimoBackup(await getAjuste('ultimoBackup'));
    triggerRefresh();
  }

  async function importData(e) {
    const file = e.target.files[0]; if (!file) return;
    const text = await file.text();
    try {
      const data = JSON.parse(text);
      if (!confirm('¿Restaurar backup? Se reemplazarán todos los datos actuales.')) return;
      await Promise.all([
        db.movimientos.clear(), db.carteras.clear(), db.presupuestos.clear(),
        db.categorias.clear(), db.transferencias.clear(), db.facturacion.clear(),
      ]);
      if (data.movimientos?.length) await db.movimientos.bulkAdd(data.movimientos);
      if (data.carteras?.length) await db.carteras.bulkAdd(data.carteras);
      if (data.presupuestos?.length) {
        let mesDefault, anioDefault;
        const movFechas = (data.movimientos || []).map(m => m.fecha).filter(Boolean).sort();
        const fechaRef = movFechas[movFechas.length - 1];
        if (fechaRef) {
          const [y, m] = fechaRef.split('-').map(Number);
          anioDefault = y; mesDefault = m;
        } else {
          const now = new Date();
          mesDefault = now.getMonth() + 1;
          anioDefault = now.getFullYear();
        }
        const presupuestosNorm = data.presupuestos.map(p => ({
          ...p,
          mes: p.mes ?? mesDefault,
          anio: p.anio ?? anioDefault,
        }));
        await db.presupuestos.bulkAdd(presupuestosNorm);
      }
      if (data.categorias?.length) await db.categorias.bulkAdd(data.categorias);
      if (data.transferencias?.length) await db.transferencias.bulkAdd(data.transferencias);
      if (data.facturacion?.length) await db.facturacion.bulkAdd(data.facturacion);
      if (data.ajustes?.length) {
        // Mergear: actualizar valores existentes por clave; agregar los nuevos.
        for (const a of data.ajustes) {
          if (!a?.clave) continue;
          const existing = await db.ajustes.where('clave').equals(a.clave).first();
          if (existing) await db.ajustes.update(existing.id, { valor: a.valor });
          else await db.ajustes.add({ clave: a.clave, valor: a.valor });
        }
      }
      // Tras restaurar, no hay cambios sin guardar.
      await marcarBackupHecho();
      setUltimoBackup(await getAjuste('ultimoBackup'));
      triggerRefresh();
      alert('Backup restaurado correctamente.');
    } catch { alert('Archivo inválido.'); }
  }

  return (
    <div className="page">
      <Header title="Ajustes" showBack />

      {/* Backup */}
      <div className="ajuste-card" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 10 }}>
        <span className="ajuste-label">Backup de Datos</span>
        <span style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>
          {ultimoBackup
            ? `Último backup: ${new Date(ultimoBackup).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}`
            : 'Nunca hiciste backup'}
        </span>
        <div style={{ display: 'flex', gap: 8, width: '100%' }}>
          <button
            className="btn-icon"
            style={{ flex: 1, width: 'auto', height: 40, background: 'var(--negro)', color: 'var(--blanco)', border: 'none', borderRadius: 8 }}
            onClick={exportData}
            title="Exportar"
          >
            <Upload size={18} />
          </button>
          <label style={{ flex: 1 }}>
            <div className="btn-icon" style={{ width: '100%', height: 40, cursor: 'pointer', borderRadius: 8 }}>
              <Download size={18} />
            </div>
            <input type="file" accept=".json" style={{ display: 'none' }} onChange={importData} />
          </label>
        </div>
      </div>

      {/* Periodo */}
      <div className="ajuste-card">
        <span className="ajuste-label">Periodo por Defecto</span>
        <select className="ajuste-select" value={vals.periodoDefault} onChange={e => update('periodoDefault', e.target.value)}>
          <option value="diario">Diario</option>
          <option value="semanal">Semanal</option>
          <option value="mensual">Mensual</option>
        </select>
      </div>

      {/* Cuenta default */}
      <div className="ajuste-card">
        <span className="ajuste-label">Cuenta por Defecto</span>
        <select className="ajuste-select" value={vals.cuentaDefault} onChange={e => update('cuentaDefault', e.target.value)}>
          <option value="">Ninguna</option>
          {carteras.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
      </div>

      {/* Dólar MEP */}
      <div className="ajuste-card">
        <span className="ajuste-label">Cotización Dólar MEP</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="number"
            className="ajuste-input"
            value={vals.dolarMep}
            onChange={e => update('dolarMep', e.target.value)}
            inputMode="decimal"
            placeholder="0,00"
          />
          <button
            className="btn-icon"
            onClick={fetchDolarMep}
            disabled={loadingDolar}
            title="Actualizar cotización"
            style={{ flexShrink: 0 }}
          >
            <RefreshCw size={16} style={{ animation: loadingDolar ? 'spin 1s linear infinite' : 'none' }} />
          </button>
        </div>
      </div>

      {/* Primer día */}
      <div className="ajuste-card">
        <span className="ajuste-label">Primer Día de Semana</span>
        <select className="ajuste-select" value={vals.primerDiaSemana} onChange={e => update('primerDiaSemana', e.target.value)}>
          <option value="sabado">Sábado</option>
          <option value="domingo">Domingo</option>
          <option value="lunes">Lunes</option>
        </select>
      </div>

      {/* Separador decimal */}
      <div className="ajuste-card">
        <span className="ajuste-label">Separador Decimal</span>
        <select className="ajuste-select" value={vals.separadorDecimal} onChange={e => update('separadorDecimal', e.target.value)}>
          <option value="punto">Punto 0.1</option>
          <option value="coma">Coma 0,1</option>
        </select>
      </div>
    </div>
  );
}
