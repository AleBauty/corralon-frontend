import { useState, useEffect, useCallback } from 'react';
import Modal from './Modal';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3000';

function fmt(n) { return parseFloat(n ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 2 }); }
function fmtFecha(f) {
  if (!f) return '—';
  const s = String(f).substring(0, 10);
  const [y, m, d] = s.split('-');
  return `${d}/${m}/${y}`;
}

const BADGE = {
  Pendiente:  { background: '#fef9c3', color: '#854d0e' },
  Autorizado: { background: '#e6f9f0', color: '#1a8a4a' },
};

export default function Egresos() {
  const [egresos,       setEgresos]       = useState([]);
  const [cargando,      setCargando]      = useState(true);
  const [error,         setError]         = useState(null);
  const [modalNuevo,    setModalNuevo]    = useState(false);
  const [modalAutorizar, setModalAutorizar] = useState(false);
  const [egresoSel,    setEgresoSel]     = useState(null);

  // Form nuevo egreso
  const [concepto,  setConcepto]  = useState('');
  const [monto,     setMonto]     = useState('');
  const [guardando, setGuardando] = useState(false);
  const [errGuardar, setErrGuardar] = useState('');

  // Form autorizar
  const [passGerente,  setPassGerente]  = useState('');
  const [autorizando,  setAutorizando]  = useState(false);
  const [errAutorizar, setErrAutorizar] = useState('');

  const cargar = useCallback(() => {
    setCargando(true);
    fetch(`${API}/api/egresos`)
      .then(r => r.ok ? r.json() : Promise.reject(`Error ${r.status}`))
      .then(data => { setEgresos(data); setCargando(false); })
      .catch(err => { setError(String(err)); setCargando(false); });
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const abrirNuevo = () => {
    setConcepto(''); setMonto(''); setErrGuardar(''); setModalNuevo(true);
  };
  const abrirAutorizar = eg => {
    setEgresoSel(eg); setPassGerente(''); setErrAutorizar(''); setModalAutorizar(true);
  };

  const guardarEgreso = async () => {
    if (!concepto.trim()) return setErrGuardar('El concepto es obligatorio');
    const m = parseFloat(monto);
    if (isNaN(m) || m <= 0) return setErrGuardar('El monto debe ser mayor a 0');
    setGuardando(true); setErrGuardar('');
    try {
      const res  = await fetch(`${API}/api/egresos`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ concepto: concepto.trim(), monto: m }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
      setModalNuevo(false); cargar();
    } catch (err) { setErrGuardar(err.message); }
    finally       { setGuardando(false); }
  };

  const confirmarAutorizar = async () => {
    if (!passGerente) return setErrAutorizar('Ingresá la contraseña del gerente');
    setAutorizando(true); setErrAutorizar('');
    try {
      const res  = await fetch(`${API}/api/egresos/${egresoSel.id}/autorizar`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ password: passGerente }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
      setModalAutorizar(false); cargar();
    } catch (err) { setErrAutorizar(err.message); }
    finally       { setAutorizando(false); }
  };

  const totalPendiente   = egresos.filter(e => e.estado === 'Pendiente').reduce((s, e) => s + parseFloat(e.monto), 0);
  const totalAutorizado  = egresos.filter(e => e.estado === 'Autorizado').reduce((s, e) => s + parseFloat(e.monto), 0);

  if (cargando) return <p className="estado-carga">Cargando egresos...</p>;
  if (error)    return <p className="estado-error">Error: {error}</p>;

  return (
    <div>
      <div className="seccion-header">
        <h2>Egresos de Caja <span className="total-registros">{egresos.length}</span></h2>
        <button className="btn-nuevo" onClick={abrirNuevo}>+ Nuevo egreso</button>
      </div>

      {/* KPIs */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
        <div style={kpiStyle('#fef9c3', '#854d0e')}>
          <div style={{ fontSize: 12, fontWeight: 600 }}>Pendientes</div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>${fmt(totalPendiente)}</div>
        </div>
        <div style={kpiStyle('#e6f9f0', '#1a8a4a')}>
          <div style={{ fontSize: 12, fontWeight: 600 }}>Autorizados</div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>${fmt(totalAutorizado)}</div>
        </div>
      </div>

      {egresos.length === 0 ? (
        <p className="estado-carga">No hay egresos registrados.</p>
      ) : (
        <div className="tabla-wrapper">
          <table>
            <thead><tr>
              <th>Fecha</th><th>Concepto</th><th style={{ textAlign: 'right' }}>Monto</th>
              <th>Estado</th><th></th>
            </tr></thead>
            <tbody>
              {egresos.map(e => (
                <tr key={e.id}>
                  <td>{fmtFecha(e.fecha)}</td>
                  <td>{e.concepto}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>${fmt(e.monto)}</td>
                  <td>
                    <span className="badge" style={BADGE[e.estado] ?? BADGE.Pendiente}>
                      {e.estado}
                    </span>
                  </td>
                  <td>
                    {e.estado === 'Pendiente' && (
                      <button className="btn-editar" onClick={() => abrirAutorizar(e)}>
                        Autorizar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal nuevo egreso */}
      {modalNuevo && (
        <Modal titulo="Nuevo egreso" onCerrar={() => setModalNuevo(false)} ancho={480}>
          <div className="form-grid">
            <div className="form-group span-2">
              <label>Concepto *</label>
              <input value={concepto} onChange={e => setConcepto(e.target.value)}
                placeholder="Descripción del egreso" autoFocus />
            </div>
            <div className="form-group span-2">
              <label>Monto ($) *</label>
              <input type="number" min="0.01" step="0.01" value={monto}
                onChange={e => setMonto(e.target.value)} placeholder="0.00" />
            </div>
          </div>
          {errGuardar && <p className="error-msg" style={{ marginTop: 12 }}>{errGuardar}</p>}
          <div className="modal-footer">
            <button className="btn btn-secundario" onClick={() => setModalNuevo(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={guardarEgreso} disabled={guardando}>
              {guardando ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </Modal>
      )}

      {/* Modal autorizar */}
      {modalAutorizar && egresoSel && (
        <Modal titulo="Autorizar egreso" onCerrar={() => setModalAutorizar(false)} ancho={420}>
          <div style={{ marginBottom: 16 }}>
            <p style={{ margin: '0 0 4px', fontWeight: 600 }}>{egresoSel.concepto}</p>
            <p style={{ margin: 0, color: 'var(--texto-suave)', fontSize: 14 }}>
              Monto: <strong style={{ color: 'var(--texto)' }}>${fmt(egresoSel.monto)}</strong>
            </p>
          </div>
          <div className="form-group">
            <label>Contraseña del gerente de finanzas</label>
            <input type="password" value={passGerente}
              onChange={e => setPassGerente(e.target.value)}
              placeholder="Ingresá la contraseña" autoFocus />
          </div>
          {errAutorizar && (
            <p style={{ color: '#dc2626', fontSize: 13, fontWeight: 600, marginTop: 10 }}>
              {errAutorizar}
            </p>
          )}
          <div className="modal-footer">
            <button className="btn btn-secundario" onClick={() => setModalAutorizar(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={confirmarAutorizar} disabled={autorizando}>
              {autorizando ? 'Verificando...' : 'Confirmar autorización'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function kpiStyle(bg, color) {
  return {
    background: bg, color, borderRadius: 12, padding: '14px 20px',
    minWidth: 160, border: `1px solid ${color}33`,
  };
}
