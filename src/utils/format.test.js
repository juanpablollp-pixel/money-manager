import { describe, it, expect } from 'vitest';
import {
  formatPesos,
  esDolar,
  esPeso,
  repararMojibake,
  tasaDelPeriodo,
  esMismoPeriodo,
  nombreMes,
} from './format';

describe('esDolar / esPeso', () => {
  it('reconoce variantes válidas de dólar', () => {
    expect(esDolar('Dólares')).toBe(true);
    expect(esDolar('dólares')).toBe(true);
    expect(esDolar('Dolares')).toBe(true);
    expect(esDolar('USD')).toBe(true);
    expect(esDolar('Dólares ')).toBe(true);
  });

  it('reconoce mojibake como dólar (DÃ³lares)', () => {
    expect(esDolar('DÃ³lares')).toBe(true);
  });

  it('reconoce variantes válidas de peso', () => {
    expect(esPeso('Pesos')).toBe(true);
    expect(esPeso('pesos')).toBe(true);
    expect(esPeso('ARS')).toBe(true);
  });

  it('no confunde dólar con peso ni viceversa', () => {
    expect(esDolar('Pesos')).toBe(false);
    expect(esPeso('Dólares')).toBe(false);
    expect(esDolar('')).toBe(false);
    expect(esPeso('')).toBe(false);
    expect(esDolar(null)).toBe(false);
    expect(esPeso(undefined)).toBe(false);
  });
});

describe('repararMojibake', () => {
  it('repara casos reales del backup del usuario', () => {
    expect(repararMojibake('MarÃ­a JosÃ©')).toBe('María José');
    expect(repararMojibake('Macro DÃ³lares')).toBe('Macro Dólares');
    expect(repararMojibake('Fernando JuÃ¡rez')).toBe('Fernando Juárez');
    expect(repararMojibake('CafÃ©')).toBe('Café');
    expect(repararMojibake('CapitalizaciÃ³n AH')).toBe('Capitalización AH');
    expect(repararMojibake('HermenÃ©utica')).toBe('Hermenéutica');
    expect(repararMojibake('VÃ­a cargo')).toBe('Vía cargo');
  });

  it('no toca strings sin mojibake', () => {
    expect(repararMojibake('Pesos')).toBe('Pesos');
    expect(repararMojibake('María José')).toBe('María José');
    expect(repararMojibake('sin tildes')).toBe('sin tildes');
    expect(repararMojibake('')).toBe('');
  });

  it('devuelve el string original si no es decodificable', () => {
    expect(repararMojibake('Ã')).toBe('Ã');
  });

  it('tolera valores no-string', () => {
    expect(repararMojibake(null)).toBe(null);
    expect(repararMojibake(undefined)).toBe(undefined);
    expect(repararMojibake(123)).toBe(123);
  });
});

describe('formatPesos', () => {
  it('usa coma decimal por defecto', () => {
    const r = formatPesos(1234.56, 'coma');
    expect(r).toContain(',56');
    expect(r.startsWith('$')).toBe(true);
  });
  it('usa punto decimal cuando se pide', () => {
    const r = formatPesos(1234.56, 'punto');
    expect(r).toContain('.56');
  });
  it('maneja cero y negativos', () => {
    expect(formatPesos(0, 'coma')).toContain('0,00');
    expect(formatPesos(-100, 'coma')).toContain('-');
  });
});

describe('esMismoPeriodo', () => {
  it('compara año y mes correctamente', () => {
    expect(esMismoPeriodo('2026-05-12', 5, 2026)).toBe(true);
    expect(esMismoPeriodo('2026-05-12', 4, 2026)).toBe(false);
    expect(esMismoPeriodo('2026-05-12', 5, 2025)).toBe(false);
  });
});

describe('nombreMes', () => {
  it('devuelve el nombre completo', () => {
    expect(nombreMes(1)).toBe('Enero');
    expect(nombreMes(12)).toBe('Diciembre');
  });
});

describe('tasaDelPeriodo', () => {
  it('usa el último dolarUsado conocido <= fechaFin', () => {
    const movs = [
      { moneda: 'Dólares', fecha: '2026-04-15', dolarUsado: 1400 },
      { moneda: 'Dólares', fecha: '2026-04-28', dolarUsado: 1443 },
      { moneda: 'Dólares', fecha: '2026-05-10', dolarUsado: 1500 },
    ];
    const trans = [];
    expect(tasaDelPeriodo(movs, trans, '2026-04-30', 1000)).toBe(1443);
    expect(tasaDelPeriodo(movs, trans, '2026-05-31', 1000)).toBe(1500);
    expect(tasaDelPeriodo(movs, trans, '2026-04-20', 1000)).toBe(1400);
  });

  it('ignora movimientos en pesos', () => {
    const movs = [{ moneda: 'Pesos', fecha: '2026-05-01', dolarUsado: 9999 }];
    expect(tasaDelPeriodo(movs, [], '2026-05-31', 1000)).toBe(1000);
  });

  it('cae al fallback si no hay movs USD', () => {
    expect(tasaDelPeriodo([], [], '2026-05-31', 1420)).toBe(1420);
  });

  it('considera también transferencias USD', () => {
    const trans = [{ moneda: 'Dólares', fecha: '2026-04-27', dolarUsado: 1443 }];
    expect(tasaDelPeriodo([], trans, '2026-05-31', 1000)).toBe(1443);
  });
});
