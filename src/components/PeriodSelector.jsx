import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { nombreMes } from '../utils/format';

export default function PeriodSelector() {
  const { periodo, periodoAnterior, periodoSiguiente, esPeriodoActual } = useApp();
  return (
    <div className="period-selector">
      <button className="period-btn" onClick={periodoAnterior}>
        <ChevronLeft size={18} />
      </button>
      <span className="period-label">{nombreMes(periodo.mes)} {periodo.anio}</span>
      <button className="period-btn" onClick={periodoSiguiente} disabled={esPeriodoActual}>
        <ChevronRight size={18} />
      </button>
    </div>
  );
}
