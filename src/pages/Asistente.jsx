import { useState, useEffect, useRef, useCallback } from 'react';
import { db, getAjuste } from '../db/database';
import Header from '../components/Header';
import { Send } from 'lucide-react';

function renderMarkdown(text) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    return part.split('\n').map((line, j, arr) => (
      j < arr.length - 1 ? [line, <br key={`${i}-${j}`} />] : line
    ));
  });
}

async function buildContext() {
  const now = new Date();
  const mes = now.getMonth() + 1;
  const anio = now.getFullYear();

  const [movs, carteras, presupuestos, categorias, facturacion, dolarMep] = await Promise.all([
    db.movimientos.toArray(),
    db.carteras.toArray(),
    db.presupuestos.toArray(),
    db.categorias.toArray(),
    db.facturacion.toArray(),
    getAjuste('dolarMep'),
  ]);

  const dolar = parseFloat(dolarMep) || 1000;
  const catMap = Object.fromEntries(categorias.map(c => [c.id, c.nombre]));

  const movsMes = movs.filter(m => {
    const d = new Date(m.fecha);
    return d.getMonth() + 1 === mes && d.getFullYear() === anio;
  });

  const totalGastosMes = movsMes
    .filter(m => m.tipo === 'gasto')
    .reduce((s, m) => s + (m.moneda === 'USD' ? m.importe * dolar : m.importe), 0);

  const totalIngresosMes = movsMes
    .filter(m => m.tipo === 'ingreso')
    .reduce((s, m) => s + (m.moneda === 'USD' ? m.importe * dolar : m.importe), 0);

  const ultimos30 = [...movs]
    .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id - a.id)
    .slice(0, 30);

  const facturacionMes = facturacion.filter(f => f.mes === mes && f.anio === anio);
  const totalFacturacion = facturacionMes.reduce((s, f) => s + (f.moneda === 'USD' ? f.importe * dolar : f.importe), 0);

  const presupuestosConProgreso = presupuestos.map(p => {
    const gastado = movsMes
      .filter(m => m.tipo === 'gasto' && m.categoriaId === p.categoriaId)
      .reduce((s, m) => s + (m.moneda === 'USD' ? m.importe * dolar : m.importe), 0);
    const limite = p.moneda === 'USD' ? p.importe * dolar : p.importe;
    const pct = limite > 0 ? Math.round((gastado / limite) * 100) : 0;
    return { ...p, gastado, limite, pct, categoriaNombre: catMap[p.categoriaId] || 'Sin categoría' };
  });

  const fmt = (n) => '$' + Math.round(n).toLocaleString('es-AR');

  let ctx = `=== DATOS FINANCIEROS (${now.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}) ===\n\n`;

  ctx += `COTIZACIÓN DÓLAR MEP: $${dolar.toLocaleString('es-AR')}\n\n`;

  ctx += `RESUMEN DEL MES:\n`;
  ctx += `- Gastos: ${fmt(totalGastosMes)}\n`;
  ctx += `- Ingresos: ${fmt(totalIngresosMes)}\n`;
  ctx += `- Balance: ${fmt(totalIngresosMes - totalGastosMes)}\n`;
  if (totalFacturacion > 0) ctx += `- Facturación: ${fmt(totalFacturacion)}\n`;
  ctx += '\n';

  ctx += `CARTERAS:\n`;
  carteras.forEach(c => {
    const saldoARS = c.moneda === 'USD' ? c.importe * dolar : c.importe;
    ctx += `- ${c.nombre} (${c.tipo}): ${c.moneda === 'USD' ? `USD ${c.importe.toLocaleString('es-AR')} ≈ ${fmt(saldoARS)}` : fmt(c.importe)}${c.enBalance ? '' : ' [excluida del balance]'}\n`;
  });
  ctx += '\n';

  ctx += `PRESUPUESTOS:\n`;
  presupuestosConProgreso.forEach(p => {
    ctx += `- ${p.categoriaNombre}: ${fmt(p.gastado)} de ${fmt(p.limite)} (${p.pct}%)${p.pct > 100 ? ' ⚠️ EXCEDIDO' : ''}\n`;
  });
  ctx += '\n';

  ctx += `CATEGORÍAS: ${categorias.map(c => c.nombre).join(', ')}\n\n`;

  if (facturacionMes.length > 0) {
    ctx += `FACTURACIÓN DEL MES:\n`;
    facturacionMes.forEach(f => {
      ctx += `- ${f.empresa}: ${f.moneda === 'USD' ? `USD ${f.importe}` : fmt(f.importe)}\n`;
    });
    ctx += '\n';
  }

  ctx += `ÚLTIMOS 30 MOVIMIENTOS:\n`;
  ultimos30.forEach(m => {
    const cat = catMap[m.categoriaId] || '';
    const imp = m.moneda === 'USD' ? `USD ${m.importe}` : fmt(m.importe);
    ctx += `- [${m.fecha}] ${m.tipo.toUpperCase()} ${imp}${m.empresa ? ` — ${m.empresa}` : ''}${cat ? ` (${cat})` : ''}\n`;
  });

  return ctx;
}

const SYSTEM_PROMPT = `Sos un asistente financiero personal. Respondés en español argentino, de forma concreta, directa y útil. Usás los datos financieros reales del usuario que se proveen al inicio de cada conversación para dar respuestas precisas. Si el usuario pregunta sobre sus gastos, presupuestos, carteras o ingresos, respondés con los números exactos de sus datos. No inventás información. Si algo no está en los datos, lo decís claramente.`;

export default function Asistente() {
  const [apiKey, setApiKey] = useState(null);
  const [model, setModel] = useState('gemini-2.5-flash');
  const [contexto, setContexto] = useState('');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    async function init() {
      const [key, mdl, ctx] = await Promise.all([
        getAjuste('geminiApiKey'),
        getAjuste('geminiModel'),
        buildContext(),
      ]);
      setApiKey(key || '');
      setModel(mdl || 'gemini-2.5-flash');
      setContexto(ctx);
      setLoadingConfig(false);
    }
    init();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const autoResize = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
  }, []);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;

    const newMessages = [...messages, { role: 'user', text }];
    setMessages(newMessages);
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    setLoading(true);

    try {
      const contents = [
        { role: 'user', parts: [{ text: `${SYSTEM_PROMPT}\n\n${contexto}` }] },
        { role: 'model', parts: [{ text: 'Entendido. Tengo todos tus datos financieros. ¿En qué te puedo ayudar?' }] },
        ...newMessages.map(m => ({
          role: m.role === 'user' ? 'user' : 'model',
          parts: [{ text: m.text }],
        })),
      ];

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents }),
        }
      );

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || `Error ${res.status}`);
      }

      const data = await res.json();
      const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Sin respuesta.';
      setMessages(prev => [...prev, { role: 'model', text: reply }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: 'model', text: `Error: ${e.message}` }]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  if (loadingConfig) {
    return (
      <div className="page">
        <Header title="Asistente IA" showBack />
      </div>
    );
  }

  if (!apiKey) {
    return (
      <div className="page">
        <Header title="Asistente IA" showBack />
        <div style={{ padding: '32px 20px', textAlign: 'center', color: '#64748b' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>✨</div>
          <p style={{ fontWeight: 600, color: '#1e293b', marginBottom: 8 }}>API Key no configurada</p>
          <p style={{ fontSize: 14 }}>Ingresá tu API Key de Google Gemini en Ajustes para usar el asistente.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @keyframes blink { 0%,80%,100%{opacity:0} 40%{opacity:1} }
        .typing-dot { width:7px;height:7px;background:#94a3b8;border-radius:50%;display:inline-block;margin:0 2px;animation:blink 1.4s infinite; }
        .typing-dot:nth-child(2){animation-delay:.2s}
        .typing-dot:nth-child(3){animation-delay:.4s}
      `}</style>
      <div className="page" style={{ padding: 0, gap: 0, minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px 16px 8px', paddingTop: 'calc(16px + env(safe-area-inset-top))' }}>
          <Header title="Asistente IA" showBack />
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 16px 16px' }}>
          {messages.length === 0 && (
            <div style={{ textAlign: 'center', color: '#94a3b8', padding: '40px 20px' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>✨</div>
              <p style={{ fontSize: 15, fontWeight: 500, color: '#64748b' }}>¿En qué te puedo ayudar?</p>
              <p style={{ fontSize: 13, marginTop: 6 }}>Preguntame sobre tus gastos, presupuestos o finanzas.</p>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: 10 }}>
              <div style={{
                maxWidth: '82%',
                padding: '10px 14px',
                borderRadius: m.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                background: m.role === 'user' ? '#1e293b' : '#ffffff',
                color: m.role === 'user' ? '#ffffff' : '#1e293b',
                border: m.role === 'user' ? 'none' : '1px solid #e2e8f0',
                fontSize: 14,
                lineHeight: 1.5,
                wordBreak: 'break-word',
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
              }}>
                {renderMarkdown(m.text)}
              </div>
            </div>
          ))}

          {loading && (
            <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 10 }}>
              <div style={{
                padding: '12px 16px',
                borderRadius: '18px 18px 18px 4px',
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
              }}>
                <span className="typing-dot" />
                <span className="typing-dot" />
                <span className="typing-dot" />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <div style={{
          paddingTop: 10,
          paddingBottom: 'calc(10px + env(safe-area-inset-bottom))',
          paddingLeft: 16,
          paddingRight: 16,
          background: '#ffffff',
          borderTop: '1px solid #e2e8f0',
          display: 'flex',
          gap: 10,
          alignItems: 'flex-end',
        }}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => { setInput(e.target.value); autoResize(); }}
            onKeyDown={handleKeyDown}
            placeholder="Escribí tu consulta..."
            rows={1}
            style={{
              flex: 1,
              resize: 'none',
              border: '1px solid #e2e8f0',
              borderRadius: 12,
              padding: '10px 14px',
              fontSize: 14,
              fontFamily: 'inherit',
              lineHeight: 1.5,
              outline: 'none',
              background: '#f8fafc',
              color: '#1e293b',
              maxHeight: 120,
              overflowY: 'auto',
            }}
          />
          <button
            onClick={send}
            disabled={loading || !input.trim()}
            style={{
              width: 42,
              height: 42,
              borderRadius: 12,
              border: 'none',
              background: loading || !input.trim() ? '#e2e8f0' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              color: loading || !input.trim() ? '#94a3b8' : '#ffffff',
              cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              transition: 'background 0.2s',
            }}
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </>
  );
}
