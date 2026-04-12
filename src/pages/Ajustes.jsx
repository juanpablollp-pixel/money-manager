import { useState, useEffect } from 'react';
import { db, getAjuste, setAjuste } from '../db/database';
import { useApp } from '../context/AppContext';
import Header from '../components/Header';

export default function Ajustes() {
  const { triggerRefresh } = useApp();
  const [carteras, setCarteras] = useState([]);
  const [vals, setVals] = useState({
    dolarMep: '',
    periodoDefault: 'mensual',
    cuentaDefault: '',
    primerDiaSemana: 'lunes',
    separadorDecimal: 'coma',
  });

  useEffect(() => {
    async function load() {
      const [carts, dolar, periodo, cuenta, dia, sep] = await Promise.all([
        db.carteras.toArray(),
        getAjuste('dolarMep'),
        getAjuste('periodoDefault'),
        getAjuste('cuentaDefault'),
        getAjuste('primerDiaSemana'),
        getAjuste('separadorDecimal'),
      ]);
      setCarteras(carts);
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

  async function exportData() {
    const [movs, carts, press, cats, trans] = await Promise.all([
      db.movimientos.toArray(),
      db.carteras.toArray(),
      db.presupuestos.toArray(),
      db.categorias.toArray(),
      db.transferencias.toArray(),
    ]);
    const data = JSON.stringify({ movimientos: movs, carteras: carts, presupuestos: press, categorias: cats, transferencias: trans }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `moneymanager-backup-${new Date().toISOString().split('T')[0]}.json`; a.click();
    URL.revokeObjectURL(url);
  }

  async function importData(e) {
    const file = e.target.files[0]; if (!file) return;
    const text = await file.text();
    try {
      const data = JSON.parse(text);
      if (!confirm('¿Restaurar backup? Se reemplazarán todos los datos actuales.')) return;
      await Promise.all([
        db.movimientos.clear(), db.carteras.clear(), db.presupuestos.clear(),
        db.categorias.clear(), db.transferencias.clear(),
      ]);
      if (data.movimientos?.length) await db.movimientos.bulkAdd(data.movimientos.map(({ id, ...r }) => r));
      if (data.carteras?.length) await db.carteras.bulkAdd(data.carteras.map(({ id, ...r }) => r));
      if (data.presupuestos?.length) await db.presupuestos.bulkAdd(data.presupuestos.map(({ id, ...r }) => r));
      if (data.categorias?.length) await db.categorias.bulkAdd(data.categorias.map(({ id, ...r }) => r));
      if (data.transferencias?.length) await db.transferencias.bulkAdd(data.transferencias.map(({ id, ...r }) => r));
      triggerRefresh();
      alert('Backup restaurado correctamente.');
    } catch { alert('Archivo inválido.'); }
  }

  return (
    <div className="page">
      <Header title="Ajustes" showBack backTo="/" />

      {/* Backup */}
      <div className="ajuste-card" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 10 }}>
        <span className="ajuste-label">Backup de Datos</span>
        <div style={{ display: 'flex', gap: 8, width: '100%' }}>
          <button className="btn-icon" style={{ flex: 1, width: 'auto', height: 40, background: 'var(--negro)', color: 'var(--blanco)', border: 'none', borderRadius: 8, fontSize: '1.1rem' }} onClick={exportData} title="Exportar">↑</button>
          <label style={{ flex: 1 }}>
            <div className="btn-icon" style={{ width: '100%', height: 40, cursor: 'pointer', borderRadius: 8, fontSize: '1.1rem' }}>↓</div>
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
        <input
          type="number"
          className="ajuste-input"
          value={vals.dolarMep}
          onChange={e => update('dolarMep', e.target.value)}
          inputMode="decimal"
          placeholder="0,00"
        />
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
