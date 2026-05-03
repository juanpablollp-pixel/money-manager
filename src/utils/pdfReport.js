import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { db, getAjuste } from '../db/database';
import { esMismoPeriodo, nombreMes } from './format';

export async function exportarReportePDF(periodo) {
  const { mes, anio } = periodo;

  const [movs, press, carts, cats, facts, dolar, sep] = await Promise.all([
    db.movimientos.toArray(),
    db.presupuestos.toArray(),
    db.carteras.toArray(),
    db.categorias.toArray(),
    db.facturacion.toArray(),
    getAjuste('dolarMep'),
    getAjuste('separadorDecimal'),
  ]);

  const dolarMep = parseFloat(dolar) || 1000;
  const movsPeriodo = movs
    .filter(m => esMismoPeriodo(m.fecha, mes, anio))
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
  const factsPeriodo = facts.filter(f => f.mes === mes && f.anio === anio);

  const fmt = v => {
    const num = parseFloat(v) || 0;
    if (sep === 'punto') return '$' + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return '$' + num.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };
  const getCat = id => cats.find(c => c.id === id)?.nombre || '—';
  const getCartera = id => carts.find(c => c.id === id)?.nombre || '—';

  const totalIngresado = movsPeriodo
    .filter(m => m.tipo === 'ingreso')
    .reduce((acc, m) => acc + (m.moneda === 'Dólares' ? m.importe * dolarMep : m.importe), 0);
  const totalGastado = movsPeriodo
    .filter(m => m.tipo === 'gasto')
    .reduce((acc, m) => acc + (m.moneda === 'Dólares' ? m.importe * dolarMep : m.importe), 0);

  const HEADER_COLOR = [30, 41, 59];
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  // Título
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('MoneyManager', 14, 18);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.text(`Reporte de ${nombreMes(mes)} ${anio}`, 14, 25);
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

  // Estado de cuentas
  y = doc.lastAutoTable.finalY + 8;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('Estado de Cuentas', 14, y);

  autoTable(doc, {
    startY: y + 2,
    head: [['Cartera', 'Tipo', 'Moneda', 'Saldo']],
    body: carts.map(c => [
      c.nombre,
      c.tipo === 'ahorros' ? 'Ahorro' : 'Gastos',
      c.moneda,
      c.moneda === 'Dólares' ? `$${c.importe.toFixed(2)} USD` : fmt(c.importe),
    ]),
    styles: { fontSize: 10 },
    headStyles: { fillColor: HEADER_COLOR },
    columnStyles: { 3: { halign: 'right' } },
    margin: { left: 14, right: 14 },
  });

  // Movimientos
  y = doc.lastAutoTable.finalY + 8;
  if (y > 240) { doc.addPage(); y = 14; }
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('Movimientos del Período', 14, y);

  autoTable(doc, {
    startY: y + 2,
    head: [['Fecha', 'Categoría', 'Descripción', 'Cuenta', 'Tipo', 'Importe']],
    body: movsPeriodo.length
      ? movsPeriodo.map(m => [
          m.fecha,
          getCat(m.categoriaId),
          m.empresa || '—',
          getCartera(m.carteraId),
          m.tipo === 'gasto' ? 'Gasto' : 'Ingreso',
          (m.tipo === 'gasto' ? '-' : '+') + (m.moneda === 'Dólares' ? `$${m.importe} USD` : fmt(m.importe)),
        ])
      : [['Sin movimientos en este período', '', '', '', '', '']],
    styles: { fontSize: 9 },
    headStyles: { fillColor: HEADER_COLOR },
    columnStyles: { 5: { halign: 'right' } },
    margin: { left: 14, right: 14 },
  });

  // Presupuestos
  if (press.length > 0) {
    y = doc.lastAutoTable.finalY + 8;
    if (y > 240) { doc.addPage(); y = 14; }
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text('Presupuestos', 14, y);

    const gastadoPorCat = movsPeriodo
      .filter(m => m.tipo === 'gasto')
      .reduce((acc, m) => {
        const ars = m.moneda === 'Dólares' ? m.importe * dolarMep : m.importe;
        acc[m.categoriaId] = (acc[m.categoriaId] || 0) + ars;
        return acc;
      }, {});

    autoTable(doc, {
      startY: y + 2,
      head: [['Categoría', 'Presupuesto', 'Gastado', 'Resta', '%']],
      body: press.map(p => {
        const presupARS = p.moneda === 'Dólares' ? p.importe * dolarMep : p.importe;
        const gastado = gastadoPorCat[p.categoriaId] || 0;
        const resta = presupARS - gastado;
        const pct = presupARS > 0 ? Math.round((gastado / presupARS) * 100) : 0;
        return [getCat(p.categoriaId), fmt(presupARS), fmt(gastado), fmt(resta), `${pct}%`];
      }),
      styles: { fontSize: 9 },
      headStyles: { fillColor: HEADER_COLOR },
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
      margin: { left: 14, right: 14 },
    });
  }

  // Facturación
  if (factsPeriodo.length > 0) {
    y = doc.lastAutoTable.finalY + 8;
    if (y > 240) { doc.addPage(); y = 14; }
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text('Facturación del Período', 14, y);

    const totalFactARS = factsPeriodo.reduce((acc, f) => acc + (f.moneda === 'Dólares' ? f.importe * dolarMep : f.importe), 0);

    autoTable(doc, {
      startY: y + 2,
      head: [['Empresa', 'Moneda', 'Importe', 'En ARS']],
      body: [
        ...factsPeriodo.map(f => [
          f.empresa || '—',
          f.moneda,
          f.moneda === 'Dólares' ? `$${f.importe} USD` : fmt(f.importe),
          fmt(f.moneda === 'Dólares' ? f.importe * dolarMep : f.importe),
        ]),
        [{ content: 'TOTAL', colSpan: 3, styles: { fontStyle: 'bold', halign: 'right' } }, { content: fmt(totalFactARS), styles: { fontStyle: 'bold', halign: 'right' } }],
      ],
      styles: { fontSize: 9 },
      headStyles: { fillColor: HEADER_COLOR },
      columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' } },
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
      `MoneyManager — ${nombreMes(mes)} ${anio} — Página ${i} de ${pageCount}`,
      14,
      doc.internal.pageSize.height - 8
    );
  }

  doc.save(`reporte-${nombreMes(mes).toLowerCase()}-${anio}.pdf`);
}
