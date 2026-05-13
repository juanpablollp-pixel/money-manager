// Reparación de mojibake (UTF-8 leído como Latin-1).
export function repararMojibake(s) {
  if (typeof s !== 'string' || s.indexOf('Ã') === -1) return s;
  try {
    const bytes = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) {
      const cp = s.charCodeAt(i);
      if (cp > 0xFF) return s;
      bytes[i] = cp;
    }
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return s;
  }
}

// Detección robusta de moneda. Tolera mojibake ("DÃ³lares"), mayúsculas/minúsculas,
// espacios al final y variantes ("USD"). Evita que un encoding roto haga que la
// app trate dólares como pesos en silencio.
function _normMoneda(m) {
  if (typeof m !== 'string') return '';
  return m.trim().toLowerCase();
}
export function esDolar(m) {
  const n = _normMoneda(m);
  if (!n) return false;
  return n === 'dólares' || n === 'dolares' || n === 'usd' || n.startsWith('d') && n.includes('lares');
}
export function esPeso(m) {
  const n = _normMoneda(m);
  if (!n) return false;
  return n === 'pesos' || n === 'ars' || n.startsWith('peso');
}

export function formatPesos(valor, separador = 'coma') {
  const num = parseFloat(valor) || 0;
  if (separador === 'coma') {
    return '$' + num.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return '$' + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatFecha(fechaStr) {
  if (!fechaStr) return '';
  const d = new Date(fechaStr + 'T00:00:00');
  const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  return `${String(d.getDate()).padStart(2,'0')} - ${meses[d.getMonth()]} - ${d.getFullYear()}`;
}

export function hoy() {
  return new Date().toISOString().split('T')[0];
}

export function periodoActual() {
  const now = new Date();
  return { mes: now.getMonth() + 1, anio: now.getFullYear() };
}

export function mismoMes(fechaStr) {
  const { mes, anio } = periodoActual();
  const d = new Date(fechaStr + 'T00:00:00');
  return d.getMonth() + 1 === mes && d.getFullYear() === anio;
}

export function esMismoPeriodo(fechaStr, mes, anio) {
  const d = new Date(fechaStr + 'T00:00:00');
  return d.getMonth() + 1 === mes && d.getFullYear() === anio;
}

export const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

export function nombreMes(mes) {
  return MESES[mes - 1];
}

// Tasa de dólar representativa del período. Para evitar que los balances de
// períodos cerrados fluctúen al cambiar el dólar de Ajustes, usamos el último
// dolarUsado conocido con fecha ≤ fechaFin (entre movimientos y transferencias).
// Si no hay ninguno, devuelve dolarFallback (típicamente el dólar actual).
export function tasaDelPeriodo(movimientos, transferencias, fechaFin, dolarFallback) {
  let mejor = null;
  let mejorFecha = '';
  for (const m of movimientos) {
    if (!esDolar(m.moneda) || m.dolarUsado == null) continue;
    if (!m.fecha || m.fecha > fechaFin) continue;
    if (m.fecha > mejorFecha) {
      mejor = m.dolarUsado;
      mejorFecha = m.fecha;
    }
  }
  for (const t of transferencias) {
    if (!esDolar(t.moneda) || t.dolarUsado == null) continue;
    if (!t.fecha || t.fecha > fechaFin) continue;
    if (t.fecha > mejorFecha) {
      mejor = t.dolarUsado;
      mejorFecha = t.fecha;
    }
  }
  return mejor ?? dolarFallback;
}
