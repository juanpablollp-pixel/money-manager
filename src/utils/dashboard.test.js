import { describe, it, expect } from 'vitest';
import { calcularExcesoDesglose, sumarExceso } from './dashboard';

describe('calcularExcesoDesglose', () => {
  const categorias = [
    { id: 1, nombre: 'Internet', tipo: 'gastos' },
    { id: 9, nombre: 'Delivery', tipo: 'gastos' },
    { id: 10, nombre: 'Amocito', tipo: 'gastos' },
    { id: 12, nombre: 'Combustible', tipo: 'gastos' },
    { id: 17, nombre: 'Panadería', tipo: 'gastos' },
    { id: 29, nombre: 'Otros', tipo: 'gastos' },
  ];

  it('reporta huérfanos cuando no hay presupuesto para la categoría', () => {
    const presupuestos = [];
    const movs = [
      { tipo: 'gasto', moneda: 'Pesos', importe: 1000, categoriaId: 9 },
      { tipo: 'gasto', moneda: 'Pesos', importe: 500, categoriaId: 17 },
      { tipo: 'ingreso', moneda: 'Pesos', importe: 9999, categoriaId: 1 }, // ignorado
    ];
    const r = calcularExcesoDesglose({ presupuestosPeriodo: presupuestos, movsMes: movs, categorias, dolarFallback: 1000 });
    expect(r).toHaveLength(2);
    expect(r[0].monto).toBe(1000);
    expect(r[0].tipo).toBe('huerfano');
    expect(sumarExceso(r)).toBe(1500);
  });

  it('reporta excedente cuando el gasto supera el presupuesto', () => {
    const presupuestos = [{ categoriaId: 10, moneda: 'Pesos', importe: 100, mes: 5, anio: 2026 }];
    const movs = [{ tipo: 'gasto', moneda: 'Pesos', importe: 150, categoriaId: 10 }];
    const r = calcularExcesoDesglose({ presupuestosPeriodo: presupuestos, movsMes: movs, categorias, dolarFallback: 1000 });
    expect(r).toHaveLength(1);
    expect(r[0].tipo).toBe('excedente');
    expect(r[0].monto).toBe(50);
  });

  it('no reporta nada si el gasto está dentro del presupuesto', () => {
    const presupuestos = [{ categoriaId: 10, moneda: 'Pesos', importe: 100 }];
    const movs = [{ tipo: 'gasto', moneda: 'Pesos', importe: 80, categoriaId: 10 }];
    expect(calcularExcesoDesglose({ presupuestosPeriodo: presupuestos, movsMes: movs, categorias, dolarFallback: 1000 })).toEqual([]);
  });

  it('agrupa huérfanos por categoría', () => {
    const movs = [
      { tipo: 'gasto', moneda: 'Pesos', importe: 100, categoriaId: 29 },
      { tipo: 'gasto', moneda: 'Pesos', importe: 200, categoriaId: 29 },
      { tipo: 'gasto', moneda: 'Pesos', importe: 50, categoriaId: 9 },
    ];
    const r = calcularExcesoDesglose({ presupuestosPeriodo: [], movsMes: movs, categorias, dolarFallback: 1000 });
    expect(r).toHaveLength(2);
    expect(r.find(x => x.categoriaId === 29).monto).toBe(300);
    expect(r.find(x => x.categoriaId === 9).monto).toBe(50);
  });

  it('convierte gastos en USD usando dolarUsado congelado', () => {
    const movs = [{ tipo: 'gasto', moneda: 'Dólares', importe: 10, dolarUsado: 1443, categoriaId: 9 }];
    const r = calcularExcesoDesglose({ presupuestosPeriodo: [], movsMes: movs, categorias, dolarFallback: 1000 });
    expect(r[0].monto).toBe(14430);
  });

  it('cae al dolarFallback si el gasto USD no tiene dolarUsado', () => {
    const movs = [{ tipo: 'gasto', moneda: 'Dólares', importe: 10, categoriaId: 9 }];
    const r = calcularExcesoDesglose({ presupuestosPeriodo: [], movsMes: movs, categorias, dolarFallback: 1420 });
    expect(r[0].monto).toBe(14200);
  });

  it('ordena por monto descendente', () => {
    const movs = [
      { tipo: 'gasto', moneda: 'Pesos', importe: 50, categoriaId: 9 },
      { tipo: 'gasto', moneda: 'Pesos', importe: 1000, categoriaId: 17 },
      { tipo: 'gasto', moneda: 'Pesos', importe: 300, categoriaId: 29 },
    ];
    const r = calcularExcesoDesglose({ presupuestosPeriodo: [], movsMes: movs, categorias, dolarFallback: 1000 });
    expect(r.map(x => x.monto)).toEqual([1000, 300, 50]);
  });

  it('caso real: mayo 2026 del usuario reproduce $173.789,84', () => {
    // Datos extraídos del backup del usuario.
    const presupuestos = [
      { categoriaId: 1, importe: 86448.95, moneda: 'Pesos' }, // Internet
      { categoriaId: 10, importe: 180000, moneda: 'Pesos' }, // Amocito
      { categoriaId: 12, importe: 70000, moneda: 'Pesos' }, // Combustible
      { categoriaId: 15, importe: 80000, moneda: 'Pesos' }, // Ordenanza
      { categoriaId: 28, importe: 88777.35, moneda: 'Pesos' }, // Café
      // Otros presupuestos no relevantes a los gastos de mayo: EDESE, IIBB, etc.
    ];
    const movs = [
      // Con presupuesto (no son exceso)
      { tipo: 'gasto', moneda: 'Pesos', importe: 86448.95, categoriaId: 1 }, // Claro
      { tipo: 'gasto', moneda: 'Pesos', importe: 80000, categoriaId: 10 }, // Amocito
      { tipo: 'gasto', moneda: 'Pesos', importe: 100000, categoriaId: 10 }, // Amocito
      { tipo: 'gasto', moneda: 'Pesos', importe: 70000, categoriaId: 12 }, // YPF
      { tipo: 'gasto', moneda: 'Pesos', importe: 20000, categoriaId: 15 }, // Chiqui
      { tipo: 'gasto', moneda: 'Pesos', importe: 88777.35, categoriaId: 28 }, // Flat&White
      // Huérfanos
      { tipo: 'gasto', moneda: 'Pesos', importe: 29000, categoriaId: 9 }, // Jefferson
      { tipo: 'gasto', moneda: 'Pesos', importe: 29000, categoriaId: 9 }, // Oklahoma
      { tipo: 'gasto', moneda: 'Pesos', importe: 1000, categoriaId: 16 }, // Verduleria
      { tipo: 'gasto', moneda: 'Pesos', importe: 2400, categoriaId: 17 }, // El sol
      { tipo: 'gasto', moneda: 'Pesos', importe: 4000, categoriaId: 17 }, // Panadería
      { tipo: 'gasto', moneda: 'Pesos', importe: 4800, categoriaId: 17 }, // Palau
      { tipo: 'gasto', moneda: 'Pesos', importe: 17789.84, categoriaId: 29 }, // Macro IVA
      { tipo: 'gasto', moneda: 'Pesos', importe: 77800, categoriaId: 29 }, // Gastos efectivo
      { tipo: 'gasto', moneda: 'Pesos', importe: 8000, categoriaId: 29 }, // Gastos varios
    ];
    const r = calcularExcesoDesglose({ presupuestosPeriodo: presupuestos, movsMes: movs, categorias, dolarFallback: 1420.15 });
    expect(Math.round(sumarExceso(r) * 100) / 100).toBe(173789.84);
  });
});
