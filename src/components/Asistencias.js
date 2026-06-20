import { useEffect, useState, useCallback } from 'react';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3000';

function formatHora(h) { return h ? h.slice(0, 5) : '—'; }
function formatFecha(s) {
  if (!s) return '—';
  // Tomar solo los primeros 10 chars (YYYY-MM-DD) sin importar si llega con zona horaria
  const [y, m, d] = String(s).substring(0, 10).split('-').map(Number);
  if (!y || !m || !d) return String(s);
  return new Date(y, m - 1, d).toLocaleDateString('es-AR', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function Asistencias() {
  const [asistencias, setAsistencias] = useState([]);
  const [cargando, setCargando]       = useState(false);
  const [error, setError]             = useState(null);

  // Filtros
  const [filtroDni, setFiltroDni]         = useState('');
  const [filtroDesde, setFiltroDesde]     = useState('');
  const [filtroHasta, setFiltroHasta]     = useState('');

  // Registro
  const [regDni, setRegDni]       = useState('');
  const [regFecha, setRegFecha]   = useState(new Date().toISOString().split('T')[0]);
  const [regMsg, setRegMsg]       = useState(null);
  const [regOp, setRegOp]         = useState(null); // 'entrada' | 'salida'

  const hoyStr = new Date().toISOString().split('T')[0];

  const cargar = useCallback((params = {}) => {
    setCargando(true); setError(null);
    const q = new URLSearchParams();
    if (params.dni)          q.set('dni', params.dni);
    if (params.fecha_desde)  q.set('fecha_desde', params.fecha_desde);
    if (params.fecha_hasta)  q.set('fecha_hasta', params.fecha_hasta);
    fetch(`${API}/api/asistencias?${q}`)
      .then(r => r.ok ? r.json() : Promise.reject(`Error ${r.status}`))
      .then(data => { setAsistencias(data); setCargando(false); })
      .catch(err  => { setError(String(err)); setCargando(false); });
  }, []);

  useEffect(() => { cargar({ fecha_desde: hoyStr, fecha_hasta: hoyStr }); }, [cargar, hoyStr]);

  const buscar = () => cargar({ dni: filtroDni.trim() || undefined, fecha_desde: filtroDesde || undefined, fecha_hasta: filtroHasta || undefined });

  const registrar = async tipo => {
    if (!regDni.trim()) { setRegMsg({ ok: false, texto: 'Ingresá el DNI del empleado' }); return; }
    setRegOp(tipo); setRegMsg(null);
    try {
      const res  = await fetch(`${API}/api/asistencias/${tipo}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dni_empleado: regDni.trim(), fecha: regFecha }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
      const accion = tipo === 'entrada' ? 'Entrada' : 'Salida';
      setRegMsg({ ok: true, texto: `${accion} registrada para ${data.empleado} (${formatHora(tipo === 'entrada' ? data.hora_entrada : data.hora_salida)})${data.horas_trabajadas ? ` — ${data.horas_trabajadas}h trabajadas` : ''}` });
      cargar({ fecha_desde: hoyStr, fecha_hasta: hoyStr });
    } catch (err) { setRegMsg({ ok: false, texto: err.message }); }
    finally      { setRegOp(null); }
  };

  const totalHoras = asistencias.reduce((acc, a) => acc + parseFloat(a.horas_trabajadas ?? 0), 0);

  return (
    <div>
      <div className="seccion-header">
        <h2>Asistencias <span className="total-registros">{asistencias.length}</span></h2>
      </div>

      {/* ─── Panel de registro ─── */}
      <div className="asist-registro-panel">
        <p className="form-section-titulo" style={{ marginTop: 0 }}>Registrar asistencia</p>
        <div className="asist-registro-row">
          <div className="form-group" style={{ flex: 2 }}>
            <label>DNI del empleado</label>
            <input value={regDni} onChange={e => setRegDni(e.target.value.replace(/\D/g, ''))}
              placeholder="Ej: 38000001" maxLength={15} />
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label>Fecha</label>
            <input type="date" value={regFecha} onChange={e => setRegFecha(e.target.value)} />
          </div>
          <div className="asist-botones">
            <button className="btn btn-primary" onClick={() => registrar('entrada')} disabled={regOp === 'entrada'} type="button">
              {regOp === 'entrada' ? '...' : '▶ Entrada'}
            </button>
            <button className="btn btn-secundario" onClick={() => registrar('salida')} disabled={regOp === 'salida'} type="button">
              {regOp === 'salida' ? '...' : '◼ Salida'}
            </button>
          </div>
        </div>
        {regMsg && (
          <div className={`asist-msg ${regMsg.ok ? 'asist-msg-ok' : 'asist-msg-error'}`}>
            {regMsg.ok ? '✓' : '!'} {regMsg.texto}
          </div>
        )}
      </div>

      {/* ─── Filtros ─── */}
      <div className="asist-filtros">
        <div className="form-group" style={{ flex: 2 }}>
          <label>DNI empleado</label>
          <input value={filtroDni} onChange={e => setFiltroDni(e.target.value.replace(/\D/g, ''))}
            placeholder="Filtrar por DNI" maxLength={15} />
        </div>
        <div className="form-group" style={{ flex: 1 }}>
          <label>Desde</label>
          <input type="date" value={filtroDesde} onChange={e => setFiltroDesde(e.target.value)} />
        </div>
        <div className="form-group" style={{ flex: 1 }}>
          <label>Hasta</label>
          <input type="date" value={filtroHasta} onChange={e => setFiltroHasta(e.target.value)} />
        </div>
        <div className="asist-botones">
          <button className="btn btn-primary" onClick={buscar} type="button">Buscar</button>
          <button className="btn btn-secundario" onClick={() => { setFiltroDni(''); setFiltroDesde(''); setFiltroHasta(''); cargar({ fecha_desde: hoyStr, fecha_hasta: hoyStr }); }} type="button">Hoy</button>
        </div>
      </div>

      {/* ─── Tabla ─── */}
      {cargando ? <p className="estado-carga">Cargando...</p>
        : error   ? <p className="estado-error">Error: {error}</p>
        : asistencias.length === 0 ? <p className="estado-carga">No hay asistencias para los filtros seleccionados.</p>
        : (
          <>
            {totalHoras > 0 && (
              <p style={{ marginBottom: 12, color: '#555', fontSize: 14 }}>
                Total horas trabajadas en el período: <strong style={{ color: 'var(--naranja-oscuro)' }}>{totalHoras.toLocaleString('es-AR', { minimumFractionDigits: 1 })}h</strong>
              </p>
            )}
            <div className="tabla-wrapper">
              <table>
                <thead><tr><th>Empleado</th><th>DNI</th><th>Fecha</th><th>Entrada</th><th>Salida</th><th style={{ textAlign: 'right' }}>Hs. trabajadas</th><th>Estado</th></tr></thead>
                <tbody>
                  {asistencias.map(a => (
                    <tr key={a.id}>
                      <td style={{ fontWeight: 500 }}>{a.empleado ?? a.dni_empleado}</td>
                      <td><code>{a.dni_empleado}</code></td>
                      <td style={{ whiteSpace: 'nowrap' }}>{formatFecha(a.fecha)}</td>
                      <td className="asist-hora-entrada">{formatHora(a.hora_entrada)}</td>
                      <td className="asist-hora-salida">{formatHora(a.hora_salida)}</td>
                      <td style={{ textAlign: 'right', fontWeight: a.horas_trabajadas ? 700 : 400 }}>
                        {a.horas_trabajadas != null ? `${parseFloat(a.horas_trabajadas).toLocaleString('es-AR', { minimumFractionDigits: 1 })}h` : '—'}
                      </td>
                      <td>
                        {!a.hora_salida
                          ? <span className="badge badge-pendiente">En curso</span>
                          : <span className="badge badge-recibido">Completada</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )
      }
    </div>
  );
}
