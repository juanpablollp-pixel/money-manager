import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { db, getAjuste } from '../db/database';
import { nombreMes, tasaDelPeriodo } from './format';

function inicioPeriodo({ mes, anio }) {
  return `${anio}-${String(mes).padStart(2, '0')}-01`;
}

function finPeriodo({ mes, anio }) {
  const ultimoDia = new Date(anio, mes, 0).getDate();
  return `${anio}-${String(mes).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`;
}

function ymCompare(a, b) {
  if (a.anio !== b.anio) return a.anio - b.anio;
  return a.mes - b.mes;
}

function dentroDeRango(mes, anio, desde, hasta) {
  const cmpD = ymCompare({ mes, anio }, desde);
  const cmpH = ymCompare({ mes, anio }, hasta);
  return cmpD >= 0 && cmpH <= 0;
}

function tituloRango(desde, hasta) {
  if (ymCompare(desde, hasta) === 0) return `${nombreMes(desde.mes)} ${desde.anio}`;
  return `${nombreMes(desde.mes)} ${desde.anio} – ${nombreMes(hasta.mes)} ${hasta.anio}`;
}

function nombreArchivo(desde, hasta) {
  if (ymCompare(desde, hasta) === 0) {
    return `estado-cuenta-${nombreMes(desde.mes).toLowerCase()}-${desde.anio}.pdf`;
  }
  return `estado-cuenta-${nombreMes(desde.mes).toLowerCase()}-${desde.anio}-a-${nombreMes(hasta.mes).toLowerCase()}-${hasta.anio}.pdf`;
}

export async function exportarReportePDF(rango) {
  // Compatibilidad: si llega { mes, anio } se convierte a rango de un solo mes
  const desde = rango.desde ?? { mes: rango.mes, anio: rango.anio };
  const hasta = rango.hasta ?? { mes: rango.mes, anio: rango.anio };

  const fechaIni = inicioPeriodo(desde);
  const fechaFin = finPeriodo(hasta);

  const [movs, press, carts, cats, trans, facts, dolar, sep] = await Promise.all([
    db.movimientos.toArray(),
    db.presupuestos.toArray(),
    db.carteras.toArray(),
    db.categorias.toArray(),
    db.transferencias.toArray(),
    db.facturacion.toArray(),
    getAjuste('dolarMep'),
    getAjuste('separadorDecimal'),
  ]);

  const dolarMep = parseFloat(dolar) || 1000;
  const tasaPeriodo = tasaDelPeriodo(movs, trans, fechaFin, dolarMep);

  const movsRango = movs
    .filter(m => m.fecha >= fechaIni && m.fecha <= fechaFin)
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
  const pressRango = press.filter(p => dentroDeRango(p.mes, p.anio, desde, hasta));
  const factsRango = facts.filter(f => dentroDeRango(f.mes, f.anio, desde, hasta));

  const fmt = v => {
    const num = parseFloat(v) || 0;
    if (sep === 'punto') return '$' + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return '$' + num.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };
  const fmtUSD = v => {
    const num = parseFloat(v) || 0;
    const locale = sep === 'punto' ? 'en-US' : 'es-AR';
    return '$' + num.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' USD';
  };
  const getCat = id => cats.find(c => c.id === id)?.nombre || '—';
  const getCartera = id => carts.find(c => c.id === id)?.nombre || '—';

  const totalIngresado = movsRango
    .filter(m => m.tipo === 'ingreso')
    .reduce((acc, m) => acc + (m.moneda === 'Dólares' ? m.importe * (m.dolarUsado ?? dolarMep) : m.importe), 0);
  const totalGastado = movsRango
    .filter(m => m.tipo === 'gasto')
    .reduce((acc, m) => acc + (m.moneda === 'Dólares' ? m.importe * (m.dolarUsado ?? dolarMep) : m.importe), 0);

  // Reconstruir saldo nativo de cada cartera al final del rango
  function toNativaCartera(imp, monedaMov, cartera, tasa) {
    if (!cartera || monedaMov === cartera.moneda) return imp;
    if (monedaMov === 'Dólares' && cartera.moneda === 'Pesos') return imp * tasa;
    if (monedaMov === 'Pesos' && cartera.moneda === 'Dólares') return imp / tasa;
    return imp;
  }
  function saldoCarteraAlFin(cartera) {
    let saldo = cartera.importe;
    for (const m of movs) {
      if (m.fecha <= fechaFin) continue;
      if (m.carteraId !== cartera.id) continue;
      const nat = toNativaCartera(m.importe, m.moneda, cartera, m.dolarUsado ?? dolarMep);
      saldo += m.tipo === 'ingreso' ? -nat : nat;
    }
    for (const t of trans) {
      if (t.fecha <= fechaFin) continue;
      const tasaT = t.dolarUsado ?? dolarMep;
      if (t.cuentaOrigen === cartera.id) {
        saldo += toNativaCartera(t.importe, t.moneda, cartera, tasaT);
      }
      if (t.cuentaDestino === cartera.id) {
        saldo -= toNativaCartera(t.importe, t.moneda, cartera, tasaT);
      }
    }
    return saldo;
  }

  const HEADER_COLOR = [30, 41, 59];
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const tituloPeriodo = tituloRango(desde, hasta);

  // Título
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('MoneyManager', 14, 18);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.text(`Estado de Cuenta — ${tituloPeriodo}`, 14, 25);
  doc.setDrawColor(244, 63, 94);
  doc.setLineWidth(0.8);
  doc.line(14, 28, 196, 28);
  doc.setTextColor(0);

  // Resumen del período
  let y = 34;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('Resumen del Período', 14, y);

  autoTable(doc, {
    startY: y + 2,
    head: [['Concepto', 'Importe']],
    body: [
      ['Ingresos', fmt(totalIngresado)],
      ['Gastos', fmt(totalGastado)],
      ['Balance neto', fmt(totalIngresado - totalGastado)],
    ],
    styles: { fontSize: 10 },
    headStyles: { fillColor: HEADER_COLOR },
    columnStyles: { 1: { halign: 'right' } },
    margin: { left: 14, right: 14 },
  });

  // Estado de cuentas al final del rango
  y = doc.lastAutoTable.finalY + 8;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('Estado de Cuentas', 14, y);

  autoTable(doc, {
    startY: y + 2,
    head: [['Cartera', 'Tipo', 'Moneda', 'Saldo']],
    body: carts.map(c => {
      const saldoNat = saldoCarteraAlFin(c);
      const saldoFmt = c.moneda === 'Dólares' ? fmtUSD(saldoNat) : fmt(saldoNat);
      const nombre = c.enBalance ? c.nombre : `${c.nombre} *`;
      return [
        nombre,
        c.tipo === 'ahorros' ? 'Ahorro' : 'Gastos',
        c.moneda,
        saldoFmt,
      ];
    }),
    styles: { fontSize: 10 },
    headStyles: { fillColor: HEADER_COLOR },
    columnStyles: { 3: { halign: 'right' } },
    margin: { left: 14, right: 14 },
  });

  if (carts.some(c => !c.enBalance)) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(120);
    doc.text('* No se incluye en el Balance de Cuenta', 14, doc.lastAutoTable.finalY + 4);
    doc.setTextColor(0);
    doc.setFont('helvetica', 'normal');
  }

  // Movimientos
  y = doc.lastAutoTable.finalY + (carts.some(c => !c.enBalance) ? 10 : 8);
  if (y > 240) { doc.addPage(); y = 14; }
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('Movimientos del Período', 14, y);

  autoTable(doc, {
    startY: y + 2,
    head: [['Fecha', 'Categoría', 'Descripción', 'Cuenta', 'Tipo', 'Importe']],
    body: movsRango.length
      ? movsRango.map(m => [
          m.fecha,
          getCat(m.categoriaId),
          m.empresa || '—',
          getCartera(m.carteraId),
          m.tipo === 'gasto' ? 'Gasto' : 'Ingreso',
          (m.tipo === 'gasto' ? '-' : '+') + (m.moneda === 'Dólares' ? fmtUSD(m.importe) : fmt(m.importe)),
        ])
      : [['Sin movimientos en este período', '', '', '', '', '']],
    styles: { fontSize: 9 },
    headStyles: { fillColor: HEADER_COLOR },
    columnStyles: { 5: { halign: 'right' } },
    margin: { left: 14, right: 14 },
  });

  // Presupuestos
  if (pressRango.length > 0) {
    y = doc.lastAutoTable.finalY + 8;
    if (y > 240) { doc.addPage(); y = 14; }
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text('Presupuestos', 14, y);

    // Gastado por categoría dentro del rango
    const gastadoPorCat = movsRango
      .filter(m => m.tipo === 'gasto')
      .reduce((acc, m) => {
        const ars = m.moneda === 'Dólares' ? m.importe * (m.dolarUsado ?? dolarMep) : m.importe;
        acc[m.categoriaId] = (acc[m.categoriaId] || 0) + ars;
        return acc;
      }, {});

    const mostrarPeriodo = ymCompare(desde, hasta) !== 0;

    autoTable(doc, {
      startY: y + 2,
      head: [mostrarPeriodo
        ? ['Período', 'Categoría', 'Presupuesto', 'Gastado', 'Resta', '%']
        : ['Categoría', 'Presupuesto', 'Gastado', 'Resta', '%']],
      body: pressRango
        .slice()
        .sort((a, b) => ymCompare({ mes: a.mes, anio: a.anio }, { mes: b.mes, anio: b.anio }))
        .map(p => {
          const esUSD = p.moneda === 'Dólares';
          const tasa = p.dolarUsado ?? dolarMep;
          const presupARS = esUSD ? p.importe * tasa : p.importe;
          const gastado = gastadoPorCat[p.categoriaId] || 0;
          const resta = presupARS - gastado;
          const pct = presupARS > 0 ? Math.round((gastado / presupARS) * 100) : 0;
          const categoria = esUSD ? `${getCat(p.categoriaId)} (USD)` : getCat(p.categoriaId);
          const presupCell = esUSD ? `${fmtUSD(p.importe)}\n(${fmt(presupARS)})` : fmt(presupARS);
          const fila = [categoria, presupCell, fmt(gastado), fmt(resta), `${pct}%`];
          return mostrarPeriodo ? [`${nombreMes(p.mes)} ${p.anio}`, ...fila] : fila;
        }),
      styles: { fontSize: 9 },
      headStyles: { fillColor: HEADER_COLOR },
      columnStyles: mostrarPeriodo
        ? { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' } }
        : { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
      margin: { left: 14, right: 14 },
    });
  }

  // Facturación
  if (factsRango.length > 0) {
    y = doc.lastAutoTable.finalY + 8;
    if (y > 240) { doc.addPage(); y = 14; }
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text('Facturación del Período', 14, y);

    const totalFactARS = factsRango.reduce((acc, f) => acc + (f.moneda === 'Dólares' ? f.importe * (f.dolarUsado ?? dolarMep) : f.importe), 0);
    const mostrarPeriodo = ymCompare(desde, hasta) !== 0;

    autoTable(doc, {
      startY: y + 2,
      head: [mostrarPeriodo
        ? ['Período', 'Empresa', 'Moneda', 'Importe', 'En ARS']
        : ['Empresa', 'Moneda', 'Importe', 'En ARS']],
      body: [
        ...factsRango
          .slice()
          .sort((a, b) => ymCompare({ mes: a.mes, anio: a.anio }, { mes: b.mes, anio: b.anio }))
          .map(f => {
            const fila = [
              f.empresa || '—',
              f.moneda,
              f.moneda === 'Dólares' ? fmtUSD(f.importe) : fmt(f.importe),
              fmt(f.moneda === 'Dólares' ? f.importe * (f.dolarUsado ?? dolarMep) : f.importe),
            ];
            return mostrarPeriodo ? [`${nombreMes(f.mes)} ${f.anio}`, ...fila] : fila;
          }),
        mostrarPeriodo
          ? [{ content: 'TOTAL', colSpan: 4, styles: { fontStyle: 'bold', halign: 'right' } }, { content: fmt(totalFactARS), styles: { fontStyle: 'bold', halign: 'right' } }]
          : [{ content: 'TOTAL', colSpan: 3, styles: { fontStyle: 'bold', halign: 'right' } }, { content: fmt(totalFactARS), styles: { fontStyle: 'bold', halign: 'right' } }],
      ],
      styles: { fontSize: 9 },
      headStyles: { fillColor: HEADER_COLOR },
      columnStyles: mostrarPeriodo
        ? { 3: { halign: 'right' }, 4: { halign: 'right' } }
        : { 2: { halign: 'right' }, 3: { halign: 'right' } },
      margin: { left: 14, right: 14 },
    });
  }

  // Footer en cada página
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(
      `MoneyManager — ${tituloPeriodo} — Página ${i} de ${pageCount}`,
      14,
      doc.internal.pageSize.height - 8
    );
  }

  doc.save(nombreArchivo(desde, hasta));
}
