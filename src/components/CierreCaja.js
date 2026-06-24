import { useState, useEffect, useCallback } from 'react';

const API = process.env.REACT_APP_API_URL ?? 'https://corralon-backend-production.up.railway.app';
const fmt  = n => `$${Number(n ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
const hoy  = () => new Date().toISOString().substring(0, 10);

function KpiCard({ label, value, color }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 12, padding: '18px 20px',
      boxShadow: '0 1px 4px rgba(0,0,0,.08)', borderLeft: `4px solid ${color}`,
      minWidth: 150, flex: 1,
    }}>
      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
    </div>
  );
}

export default function CierreCaja() {
  const [fecha, setFecha]         = useState(hoy());
  const [resumen, setResumen]     = useState(null);
  const [historial, setHistorial] = useState([]);
  const [tab, setTab]             = useState('hoy');
  const [cargando, setCargando]   = useState(false);
  const [errMsg, setErrMsg]       = useState('');
  const [cerrando, setCerrando]   = useState(false);
  const [obs, setObs]             = useState('');
  const [filtroDesde, setFiltroDesde] = useState('');
  const [filtroHasta, setFiltroHasta] = useState('');

  const usuario = (() => { try { return JSON.parse(sessionStorage.getItem('usuario')); } catch { return null; } })();

  const cargarResumen = useCallback(async () => {
    setCargando(true); setErrMsg('');
    try {
      const res  = await fetch(`${API}/api/cierre-caja/resumen?fecha=${fecha}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
      setResumen(data);
    } catch (err) { setErrMsg(err.message); }
    finally       { setCargando(false); }
  }, [fecha]);

  const cargarHistorial = useCallback(async () => {
    setCargando(true); setErrMsg('');
    try {
      let url = `${API}/api/cierre-caja/historial`;
      const params = [];
      if (filtroDesde) params.push(`desde=${filtroDesde}`);
      if (filtroHasta) params.push(`hasta=${filtroHasta}`);
      if (params.length) url += '?' + params.join('&');
      const res  = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
      setHistorial(data);
    } catch (err) { setErrMsg(err.message); }
    finally       { setCargando(false); }
  }, [filtroDesde, filtroHasta]);

  useEffect(() => { cargarResumen(); }, [cargarResumen]);
  useEffect(() => { if (tab === 'historial') cargarHistorial(); }, [tab, cargarHistorial]);

  const handleCerrar = async () => {
    if (!window.confirm(`¿Confirmar cierre de caja para el día ${fecha}?`)) return;
    setCerrando(true); setErrMsg('');
    try {
      const res  = await fetch(`${API}/api/cierre-caja/cerrar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fecha, observaciones: obs || null, usuario: usuario?.nombre }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
      alert('Cierre de caja registrado correctamente.');
      cargarResumen(); setObs('');
    } catch (err) { setErrMsg(err.message); }
    finally       { setCerrando(false); }
  };

  const tabStyle = active => ({
    padding: '8px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600,
    background: active ? '#2563eb' : '#f3f4f6',
    color:      active ? '#fff'    : '#374151',
    fontSize: 14,
  });

  return (
    <div style={{ padding: '20px 16px', maxWidth: 900, margin: '0 auto' }}>
      <h2 style={{ fontWeight: 700, fontSize: 22, marginBottom: 20, color: '#111827' }}>
        Cierre de Caja
      </h2>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button style={tabStyle(tab === 'hoy')} onClick={() => setTab('hoy')}>Resumen del día</button>
        <button style={tabStyle(tab === 'historial')} onClick={() => setTab('historial')}>Historial</button>
      </div>

      {errMsg && (
        <div style={{ background: '#fef2f2', color: '#dc2626', padding: 12, borderRadius: 8, marginBottom: 16 }}>
          {errMsg}
        </div>
      )}

      {tab === 'hoy' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <label style={{ fontWeight: 600, fontSize: 14, color: '#374151' }}>Fecha:</label>
            <input
              type="date"
              value={fecha}
              onChange={e => setFecha(e.target.value)}
              style={{ border: '1px solid #d1d5db', borderRadius: 8, padding: '6px 10px', fontSize: 14 }}
            />
            <button
              onClick={cargarResumen}
              style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8,
                       padding: '7px 16px', cursor: 'pointer', fontWeight: 600, fontSize: 14 }}
            >
              Actualizar
            </button>
          </div>

          {cargando && <div style={{ color: '#6b7280', marginBottom: 16 }}>Cargando...</div>}

          {resumen && (
            <>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
                <KpiCard label="Efectivo"         value={fmt(resumen.total_efectivo)}         color="#16a34a" />
                <KpiCard label="Tarjeta"          value={fmt(resumen.total_tarjeta)}          color="#2563eb" />
                <KpiCard label="Transferencia"    value={fmt(resumen.total_transferencia)}    color="#7c3aed" />
                <KpiCard label="Cta. Corriente"   value={fmt(resumen.total_cuenta_corriente)} color="#0891b2" />
                <KpiCard label="Egresos"          value={fmt(resumen.total_egresos)}          color="#dc2626" />
                <KpiCard label="NETO"             value={fmt(resumen.total_neto)}             color={resumen.total_neto >= 0 ? '#16a34a' : '#dc2626'} />
              </div>

              {/* Ventas del día */}
              {resumen.ventas?.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: '#374151', marginBottom: 10 }}>
                    Ventas del día ({resumen.ventas.length})
                  </h3>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ background: '#f9fafb' }}>
                          {['#', 'Cliente', 'Pago 1', 'Monto 1', 'Pago 2', 'Monto 2', 'Total'].map(h => (
                            <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {resumen.ventas.map(v => (
                          <tr key={v.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                            <td style={{ padding: '7px 10px' }}>{v.id}</td>
                            <td style={{ padding: '7px 10px' }}>{v.cliente ?? '—'}</td>
                            <td style={{ padding: '7px 10px' }}>{v.forma_pago_1 ?? '—'}</td>
                            <td style={{ padding: '7px 10px' }}>{fmt(v.monto_pago_1)}</td>
                            <td style={{ padding: '7px 10px' }}>{v.forma_pago_2 ?? '—'}</td>
                            <td style={{ padding: '7px 10px' }}>{v.monto_pago_2 ? fmt(v.monto_pago_2) : '—'}</td>
                            <td style={{ padding: '7px 10px', fontWeight: 700 }}>{fmt(v.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Egresos del día */}
              {resumen.egresos?.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: '#dc2626', marginBottom: 10 }}>
                    Egresos del día ({resumen.egresos.length})
                  </h3>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ background: '#fef2f2' }}>
                          {['Concepto', 'Categoría', 'Monto'].map(h => (
                            <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: '#6b7280', borderBottom: '1px solid #fecaca' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {resumen.egresos.map(e => (
                          <tr key={e.id} style={{ borderBottom: '1px solid #fef2f2' }}>
                            <td style={{ padding: '7px 10px' }}>{e.concepto}</td>
                            <td style={{ padding: '7px 10px' }}>{e.categoria ?? '—'}</td>
                            <td style={{ padding: '7px 10px', color: '#dc2626', fontWeight: 600 }}>{fmt(e.monto)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Cerrar caja */}
              <div style={{
                background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12,
                padding: '16px 20px',
              }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: '#166534', marginBottom: 12 }}>
                  Cerrar Caja
                </h3>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>
                    Observaciones (opcional)
                  </label>
                  <textarea
                    value={obs}
                    onChange={e => setObs(e.target.value)}
                    rows={2}
                    style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '6px 10px', fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }}
                    placeholder="Notas del cierre..."
                  />
                </div>
                <button
                  onClick={handleCerrar}
                  disabled={cerrando}
                  style={{
                    background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8,
                    padding: '9px 20px', cursor: cerrando ? 'not-allowed' : 'pointer',
                    fontWeight: 700, fontSize: 14, opacity: cerrando ? .6 : 1,
                  }}
                >
                  {cerrando ? 'Guardando...' : 'Registrar cierre de caja'}
                </button>
              </div>
            </>
          )}
        </>
      )}

      {tab === 'historial' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Desde:</label>
            <input type="date" value={filtroDesde} onChange={e => setFiltroDesde(e.target.value)}
              style={{ border: '1px solid #d1d5db', borderRadius: 8, padding: '6px 10px', fontSize: 13 }} />
            <label style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Hasta:</label>
            <input type="date" value={filtroHasta} onChange={e => setFiltroHasta(e.target.value)}
              style={{ border: '1px solid #d1d5db', borderRadius: 8, padding: '6px 10px', fontSize: 13 }} />
            <button
              onClick={cargarHistorial}
              style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8,
                       padding: '7px 16px', cursor: 'pointer', fontWeight: 600, fontSize: 14 }}
            >
              Buscar
            </button>
          </div>

          {cargando && <div style={{ color: '#6b7280' }}>Cargando...</div>}

          {historial.length === 0 && !cargando && (
            <div style={{ color: '#9ca3af', textAlign: 'center', padding: 40 }}>No hay cierres en el período seleccionado.</div>
          )}

          {historial.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f9fafb' }}>
                    {['Fecha', 'Efectivo', 'Tarjeta', 'Transfer.', 'Cta. Cte.', 'Egresos', 'Neto', 'Usuario'].map(h => (
                      <th key={h} style={{ padding: '9px 10px', textAlign: 'right', fontWeight: 600, color: '#6b7280', borderBottom: '2px solid #e5e7eb', whiteSpace: 'nowrap' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {historial.map(c => (
                    <tr key={c.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '8px 10px', fontWeight: 600 }}>{c.fecha}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right' }}>{fmt(c.total_efectivo)}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right' }}>{fmt(c.total_tarjeta)}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right' }}>{fmt(c.total_transferencia)}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right' }}>{fmt(c.total_cuenta_corriente)}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', color: '#dc2626' }}>{fmt(c.total_egresos)}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: parseFloat(c.total_neto) >= 0 ? '#16a34a' : '#dc2626' }}>
                        {fmt(c.total_neto)}
                      </td>
                      <td style={{ padding: '8px 10px', color: '#6b7280' }}>{c.usuario ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
