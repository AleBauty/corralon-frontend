import { useEffect, useState, useCallback } from 'react';
import Modal from './Modal';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3000';

const ESTADOS_VEH = ['Disponible', 'En reparto', 'En mantenimiento'];

const FORM_VACIO = { patente: '', tipo: '', marca: '', modelo: '', anio: '', estado: 'Disponible', kilometraje_actual: '' };
const FORM_MANT  = { tipo: '', descripcion: '', fecha: new Date().toISOString().substring(0, 10), costo: '', kilometraje: '', proximo_service: '', estado: 'Realizado' };
const TIPOS_MANT = ['Service', 'Reparación', 'Cambio de aceite', 'Cambio de neumáticos', 'Revisión técnica', 'Otro'];

const ESTADO_ESTILO = {
  'Disponible':       { background: '#e6f9f0', color: '#1a8a4a' },
  'En reparto':       { background: '#eef2ff', color: '#3730a3' },
  'En mantenimiento': { background: '#FEF9E7', color: '#B7770D' },
};

function fmt(n) { return parseFloat(n ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 2 }); }
function formatFecha(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function formatFechaCorta(iso) {
  if (!iso) return '—';
  const [y, m, d] = String(iso).substring(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es-AR');
}

export default function Vehiculos() {
  const [tab, setTab]                   = useState('flota');

  // ── Flota state ────────────────────────────────────────────────
  const [vehiculos, setVehiculos]       = useState([]);
  const [pendientes, setPendientes]     = useState([]);
  const [cargando, setCargando]         = useState(true);
  const [error, setError]               = useState(null);

  const [modalAbierto, setModalAbierto] = useState(false);
  const [esEdicion, setEsEdicion]       = useState(false);
  const [form, setForm]                 = useState(FORM_VACIO);
  const [editId, setEditId]             = useState(null);
  const [guardando, setGuardando]       = useState(false);
  const [errGuardado, setErrGuardado]   = useState(null);

  const [asignando, setAsignando]       = useState(null);
  const [vehAsignar, setVehAsignar]     = useState('');
  const [errAsignar, setErrAsignar]     = useState(null);

  const [detalleEntrega, setDetalleEntrega]         = useState(null);
  const [cargandoDetalle, setCargandoDetalle]       = useState(false);
  const [marcandoEntregada, setMarcandoEntregada]   = useState(false);
  const [errDetalle, setErrDetalle]                 = useState(null);

  // ── Mantenimiento state ────────────────────────────────────────
  const [vehSelMant, setVehSelMant]         = useState('');
  const [historial, setHistorial]           = useState([]);
  const [cargandoMant, setCargandoMant]     = useState(false);
  const [modalMant, setModalMant]           = useState(false);
  const [formMant, setFormMant]             = useState(FORM_MANT);
  const [guardandoMant, setGuardandoMant]   = useState(false);
  const [errMant, setErrMant]               = useState(null);

  // ── Cargar flota ───────────────────────────────────────────────
  const cargarVehiculos = useCallback(() => {
    fetch(`${API}/api/vehiculos`)
      .then(r => r.ok ? r.json() : Promise.reject(`Error ${r.status}`))
      .then(data => { setVehiculos(data); setCargando(false); })
      .catch(err => { setError(String(err)); setCargando(false); });
  }, []);

  const cargarPendientes = useCallback(() => {
    fetch(`${API}/api/vehiculos/ventas-pendientes`)
      .then(r => r.ok ? r.json() : [])
      .then(setPendientes)
      .catch(() => {});
  }, []);

  useEffect(() => { cargarVehiculos(); cargarPendientes(); }, [cargarVehiculos, cargarPendientes]);

  // ── Cargar historial mantenimiento ─────────────────────────────
  const cargarHistorial = useCallback(async (vid) => {
    if (!vid) { setHistorial([]); return; }
    setCargandoMant(true);
    try {
      const data = await fetch(`${API}/api/mantenimiento?vehiculo_id=${vid}`).then(r => r.json());
      setHistorial(Array.isArray(data) ? data : []);
    } catch { setHistorial([]); }
    finally { setCargandoMant(false); }
  }, []);

  useEffect(() => {
    if (vehSelMant) cargarHistorial(vehSelMant);
    else setHistorial([]);
  }, [vehSelMant, cargarHistorial]);

  // ── Flota CRUD ─────────────────────────────────────────────────
  const abrirCrear = () => {
    setForm(FORM_VACIO); setEsEdicion(false); setEditId(null); setErrGuardado(null); setModalAbierto(true);
  };
  const abrirEditar = v => {
    setForm({
      patente: v.patente, tipo: v.tipo ?? '', marca: v.marca ?? '', modelo: v.modelo ?? '',
      anio: v.anio ?? '', estado: v.estado,
      kilometraje_actual: v.kilometraje_actual != null ? String(v.kilometraje_actual) : '',
    });
    setEsEdicion(true); setEditId(v.id); setErrGuardado(null); setModalAbierto(true);
  };
  const cerrar  = () => setModalAbierto(false);
  const cambiar = (campo, val) => setForm(f => ({ ...f, [campo]: val }));

  const guardar = async () => {
    if (!form.patente.trim()) { setErrGuardado('La patente es obligatoria'); return; }
    setGuardando(true); setErrGuardado(null);
    const body = {
      tipo: form.tipo.trim() || null, marca: form.marca.trim() || null,
      modelo: form.modelo.trim() || null, anio: form.anio ? parseInt(form.anio, 10) : null,
      estado: form.estado,
      kilometraje_actual: form.kilometraje_actual ? parseInt(form.kilometraje_actual, 10) : null,
    };
    if (!esEdicion) body.patente = form.patente.trim();
    const url    = esEdicion ? `${API}/api/vehiculos/${editId}` : `${API}/api/vehiculos`;
    const method = esEdicion ? 'PUT' : 'POST';
    try {
      const res  = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
      cerrar(); cargarVehiculos();
    } catch (err) { setErrGuardado(err.message); }
    finally       { setGuardando(false); }
  };

  // ── Asignación ─────────────────────────────────────────────────
  const confirmarAsignar = async (venta_id) => {
    if (!vehAsignar) { setErrAsignar('Seleccioná un vehículo'); return; }
    setErrAsignar(null);
    try {
      const res  = await fetch(`${API}/api/vehiculos/${vehAsignar}/asignar`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ venta_id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
      setAsignando(null); setVehAsignar('');
      cargarVehiculos(); cargarPendientes();
    } catch (err) { setErrAsignar(err.message); }
  };

  const liberar = async id => {
    if (!window.confirm('¿Marcar el vehículo como Disponible?')) return;
    try {
      const res = await fetch(`${API}/api/vehiculos/${id}/liberar`, { method: 'PUT' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      cargarVehiculos();
    } catch (err) { alert('Error: ' + err.message); }
  };

  // ── Detalle de entrega ─────────────────────────────────────────
  const verDetalle = async (venta) => {
    setCargandoDetalle(true); setDetalleEntrega(null); setErrDetalle(null);
    try {
      const data = await fetch(`${API}/api/ventas/${venta.id}`).then(r => r.json());
      setDetalleEntrega(data);
    } catch { setErrDetalle('No se pudo cargar el detalle de la venta'); }
    finally   { setCargandoDetalle(false); }
  };

  const marcarEntregada = async () => {
    if (!detalleEntrega) return;
    setMarcandoEntregada(true); setErrDetalle(null);
    try {
      const res  = await fetch(`${API}/api/ventas/${detalleEntrega.id}/entregar`, { method: 'PUT' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
      setDetalleEntrega(null);
      cargarVehiculos(); cargarPendientes();
    } catch (err) { setErrDetalle(err.message); }
    finally       { setMarcandoEntregada(false); }
  };

  // ── Mantenimiento CRUD ─────────────────────────────────────────
  const abrirNuevoMant = () => {
    setFormMant({ ...FORM_MANT, fecha: new Date().toISOString().substring(0, 10) });
    setErrMant(null); setModalMant(true);
  };
  const cerrarMant  = () => setModalMant(false);
  const cambiarMant = (campo, val) => setFormMant(f => ({ ...f, [campo]: val }));

  const guardarMant = async () => {
    if (!vehSelMant)        { setErrMant('Seleccioná un vehículo'); return; }
    if (!formMant.tipo)     { setErrMant('Seleccioná el tipo de mantenimiento'); return; }
    setGuardandoMant(true); setErrMant(null);
    const body = {
      vehiculo_id:    parseInt(vehSelMant, 10),
      tipo:           formMant.tipo,
      descripcion:    formMant.descripcion.trim() || null,
      fecha:          formMant.fecha || null,
      costo:          formMant.costo ? parseFloat(formMant.costo) : null,
      kilometraje:    formMant.kilometraje ? parseInt(formMant.kilometraje, 10) : null,
      proximo_service: formMant.proximo_service ? parseInt(formMant.proximo_service, 10) : null,
      estado:         formMant.estado,
    };
    try {
      const res  = await fetch(`${API}/api/mantenimiento`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
      cerrarMant(); cargarHistorial(vehSelMant); cargarVehiculos();
    } catch (err) { setErrMant(err.message); }
    finally       { setGuardandoMant(false); }
  };

  const disponibles = vehiculos.filter(v => v.estado === 'Disponible');

  // Vehículo seleccionado para mantenimiento
  const vehMantObj = vehiculos.find(v => String(v.id) === String(vehSelMant));
  const ultimoServiceKm = historial.find(h => h.proximo_service != null)?.proximo_service;
  const kmActual = vehMantObj?.kilometraje_actual;
  const alertaKm = kmActual != null && ultimoServiceKm != null && kmActual >= ultimoServiceKm;

  if (cargando) return <p className="estado-carga">Cargando vehículos...</p>;
  if (error)    return <p className="estado-error">Error: {error}</p>;

  return (
    <div>
      <div className="seccion-header">
        <h2>Logística</h2>
        {tab === 'flota'        && <button className="btn-nuevo" onClick={abrirCrear}>+ Nuevo vehículo</button>}
        {tab === 'mantenimiento' && vehSelMant && (
          <button className="btn-nuevo" onClick={abrirNuevoMant}>+ Registrar mantenimiento</button>
        )}
      </div>

      <div className="seccion-tabs">
        <button className={`seccion-tab ${tab === 'flota'         ? 'activo' : ''}`} onClick={() => setTab('flota')}>🚚 Flota</button>
        <button className={`seccion-tab ${tab === 'mantenimiento' ? 'activo' : ''}`} onClick={() => setTab('mantenimiento')}>🔧 Mantenimiento</button>
      </div>

      {/* ══ TAB: FLOTA ══════════════════════════════════════════════ */}
      {tab === 'flota' && (
        <>
          {vehiculos.length === 0 ? <p className="estado-carga">No hay vehículos registrados.</p> : (
            <div className="tabla-wrapper">
              <table>
                <thead><tr>
                  <th>Patente</th><th>Tipo</th><th>Marca / Modelo</th><th>Año</th><th>Km actual</th><th>Estado</th><th></th>
                </tr></thead>
                <tbody>
                  {vehiculos.map(v => (
                    <tr key={v.id}>
                      <td><code style={{ fontWeight: 700, fontSize: 15, letterSpacing: 1 }}>{v.patente}</code></td>
                      <td>{v.tipo ?? '—'}</td>
                      <td>{[v.marca, v.modelo].filter(Boolean).join(' ') || '—'}</td>
                      <td>{v.anio ?? '—'}</td>
                      <td>{v.kilometraje_actual != null ? v.kilometraje_actual.toLocaleString('es-AR') + ' km' : '—'}</td>
                      <td><span className="badge" style={ESTADO_ESTILO[v.estado] ?? ESTADO_ESTILO['Disponible']}>{v.estado}</span></td>
                      <td style={{ display: 'flex', gap: 6 }}>
                        <button className="btn-editar" onClick={() => abrirEditar(v)}>Editar</button>
                        {v.estado === 'En reparto' && (
                          <button className="btn-editar"
                            style={{ background: '#e6f9f0', color: '#1a8a4a', borderColor: 'rgba(39,174,96,0.3)' }}
                            onClick={() => liberar(v.id)}>✓ Liberar</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Panel de entregas pendientes */}
          <div style={{ marginTop: 32 }}>
            <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--texto)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>Entregas domicilio pendientes</span>
              {pendientes.length > 0 && (
                <span style={{ background: 'var(--rojo-fondo)', color: 'var(--rojo)', borderRadius: 20, padding: '2px 10px', fontSize: 12, fontWeight: 700 }}>
                  {pendientes.length}
                </span>
              )}
            </h3>
            {cargandoDetalle && <p className="estado-carga">Cargando detalle...</p>}
            {pendientes.length === 0 ? <p className="estado-carga">No hay entregas pendientes. ✓</p> : (
              <div className="tabla-wrapper">
                <table>
                  <thead><tr>
                    <th>N° Venta</th><th>Fecha</th><th>Cliente</th><th>Dirección de entrega</th><th style={{ textAlign: 'right' }}>Total</th><th>Acciones</th>
                  </tr></thead>
                  <tbody>
                    {pendientes.map(v => (
                      <tr key={v.id}>
                        <td><code>#{String(v.id).padStart(4, '0')}</code></td>
                        <td style={{ whiteSpace: 'nowrap' }}>{formatFechaCorta(v.fecha)}</td>
                        <td>{v.cliente ?? 'Consumidor final'}</td>
                        <td><strong style={{ color: 'var(--naranja-oscuro)' }}>📍 {v.direccion_entrega ?? '—'}</strong></td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>${fmt(v.total)}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                            <button className="btn-editar"
                              style={{ background: '#f0f4ff', color: '#3730a3', borderColor: 'rgba(55,48,163,0.25)' }}
                              onClick={() => verDetalle(v)}>🔍 Detalle</button>
                            {asignando === v.id ? (
                              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                <select value={vehAsignar} onChange={e => setVehAsignar(e.target.value)}
                                  style={{ padding: '5px 8px', borderRadius: 6, border: '1.5px solid var(--borde)', fontSize: 13 }}>
                                  <option value="">-- Vehículo --</option>
                                  {disponibles.map(veh => <option key={veh.id} value={veh.id}>{veh.patente}{veh.marca ? ` — ${veh.marca}` : ''}</option>)}
                                </select>
                                <button className="btn btn-primary" style={{ fontSize: 12, padding: '5px 12px' }} onClick={() => confirmarAsignar(v.id)}>OK</button>
                                <button className="btn btn-secundario" style={{ fontSize: 12, padding: '5px 10px' }} onClick={() => { setAsignando(null); setVehAsignar(''); setErrAsignar(null); }}>✕</button>
                                {errAsignar && <span className="error-msg" style={{ fontSize: 12 }}>{errAsignar}</span>}
                              </div>
                            ) : (
                              <button className="btn-editar"
                                style={disponibles.length === 0 ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                                onClick={() => disponibles.length > 0 && setAsignando(v.id)}
                                title={disponibles.length === 0 ? 'No hay vehículos disponibles' : 'Asignar vehículo'}
                              >🚚 Asignar</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ══ TAB: MANTENIMIENTO ══════════════════════════════════════ */}
      {tab === 'mantenimiento' && (
        <>
          {/* Selector de vehículo */}
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', marginBottom: 24, flexWrap: 'wrap' }}>
            <div className="form-group" style={{ marginBottom: 0, minWidth: 260 }}>
              <label>Vehículo</label>
              <select value={vehSelMant} onChange={e => setVehSelMant(e.target.value)}>
                <option value="">— Seleccioná un vehículo —</option>
                {vehiculos.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.patente}{v.marca ? ` — ${v.marca}` : ''}{v.modelo ? ` ${v.modelo}` : ''}
                  </option>
                ))}
              </select>
            </div>
            {vehMantObj && kmActual != null && (
              <div style={{ fontSize: 13, color: 'var(--texto-suave)' }}>
                Km actual: <strong style={{ color: 'var(--texto)' }}>{kmActual.toLocaleString('es-AR')} km</strong>
              </div>
            )}
          </div>

          {/* Alerta km service */}
          {alertaKm && (
            <div style={{ background: '#FEF9E7', border: '2px solid rgba(184,138,0,0.35)', borderRadius: 'var(--radio)', padding: '12px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 22 }}>⚠</span>
              <div>
                <p style={{ fontWeight: 800, color: '#B7770D', margin: 0 }}>Service vencido</p>
                <p style={{ fontSize: 13, color: '#B7770D', margin: 0 }}>
                  El vehículo tiene {kmActual.toLocaleString('es-AR')} km y el próximo service estaba previsto a los {ultimoServiceKm.toLocaleString('es-AR')} km.
                </p>
              </div>
            </div>
          )}

          {!vehSelMant ? (
            <p className="estado-carga">Seleccioná un vehículo para ver su historial de mantenimiento.</p>
          ) : cargandoMant ? (
            <p className="estado-carga">Cargando historial...</p>
          ) : historial.length === 0 ? (
            <p className="estado-carga">Sin registros de mantenimiento para este vehículo.</p>
          ) : (
            <div className="tabla-wrapper">
              <table>
                <thead><tr>
                  <th>Fecha</th><th>Tipo</th><th>Descripción</th>
                  <th style={{ textAlign: 'right' }}>Km</th>
                  <th style={{ textAlign: 'right' }}>Prox. service (km)</th>
                  <th style={{ textAlign: 'right' }}>Costo</th>
                  <th>Estado</th>
                </tr></thead>
                <tbody>
                  {historial.map(h => (
                    <tr key={h.id}>
                      <td style={{ whiteSpace: 'nowrap' }}>{formatFechaCorta(h.fecha)}</td>
                      <td><strong>{h.tipo}</strong></td>
                      <td style={{ fontSize: 13, color: 'var(--texto-suave)' }}>{h.descripcion ?? '—'}</td>
                      <td style={{ textAlign: 'right' }}>{h.kilometraje != null ? h.kilometraje.toLocaleString('es-AR') : '—'}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{h.proximo_service != null ? h.proximo_service.toLocaleString('es-AR') : '—'}</td>
                      <td style={{ textAlign: 'right' }}>{h.costo != null ? `$${fmt(h.costo)}` : '—'}</td>
                      <td><span className="badge" style={{ background: '#e6f9f0', color: '#1a8a4a' }}>{h.estado}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ── Modal crear vehículo ───────────────────────────────────── */}
      {modalAbierto && (
        <Modal titulo={esEdicion ? `Editar — ${form.patente}` : 'Nuevo vehículo'} onCerrar={cerrar} ancho={520}>
          <div className="form-grid">
            {!esEdicion && (
              <div className="form-group span-2">
                <label>Patente *</label>
                <input value={form.patente} onChange={e => cambiar('patente', e.target.value.toUpperCase())}
                  placeholder="Ej: AB123CD" autoFocus maxLength={10}
                  style={{ textTransform: 'uppercase', letterSpacing: 2, fontWeight: 700 }} />
              </div>
            )}
            <div className="form-group">
              <label>Tipo</label>
              <input value={form.tipo} onChange={e => cambiar('tipo', e.target.value)} placeholder="Ej: Camión, Utilitario" />
            </div>
            <div className="form-group">
              <label>Año</label>
              <input type="number" value={form.anio} onChange={e => cambiar('anio', e.target.value)}
                placeholder="Ej: 2018" min={1980} max={new Date().getFullYear() + 1} />
            </div>
            <div className="form-group">
              <label>Marca</label>
              <input value={form.marca} onChange={e => cambiar('marca', e.target.value)} placeholder="Ej: Ford" />
            </div>
            <div className="form-group">
              <label>Modelo</label>
              <input value={form.modelo} onChange={e => cambiar('modelo', e.target.value)} placeholder="Ej: Transit" />
            </div>
            <div className="form-group">
              <label>Km actual</label>
              <input type="number" min="0" value={form.kilometraje_actual}
                onChange={e => cambiar('kilometraje_actual', e.target.value)} placeholder="Ej: 85000" />
            </div>
            {esEdicion && (
              <div className="form-group">
                <label>Estado</label>
                <select value={form.estado} onChange={e => cambiar('estado', e.target.value)}>
                  {ESTADOS_VEH.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            )}
          </div>
          {errGuardado && <p className="error-msg" style={{ marginTop: 14 }}>Error: {errGuardado}</p>}
          <div className="modal-footer">
            <button className="btn btn-secundario" onClick={cerrar}>Cancelar</button>
            <button className="btn btn-primary" onClick={guardar} disabled={guardando}>
              {guardando ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </Modal>
      )}

      {/* ── Modal nuevo mantenimiento ──────────────────────────────── */}
      {modalMant && (
        <Modal titulo="Registrar mantenimiento" onCerrar={cerrarMant} ancho={560}>
          {vehMantObj && (
            <p style={{ fontSize: 13, color: 'var(--texto-suave)', marginBottom: 16 }}>
              Vehículo: <strong style={{ color: 'var(--texto)' }}>{vehMantObj.patente}{vehMantObj.marca ? ` — ${vehMantObj.marca} ${vehMantObj.modelo ?? ''}` : ''}</strong>
            </p>
          )}
          <div className="form-grid">
            <div className="form-group">
              <label>Tipo *</label>
              <select value={formMant.tipo} onChange={e => cambiarMant('tipo', e.target.value)}>
                <option value="">— Seleccioná —</option>
                {TIPOS_MANT.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Fecha</label>
              <input type="date" value={formMant.fecha} onChange={e => cambiarMant('fecha', e.target.value)} />
            </div>
            <div className="form-group span-2">
              <label>Descripción</label>
              <input value={formMant.descripcion} onChange={e => cambiarMant('descripcion', e.target.value)}
                placeholder="Detalles del servicio / reparación" />
            </div>
            <div className="form-group">
              <label>Costo ($)</label>
              <input type="number" min="0" step="0.01" value={formMant.costo}
                onChange={e => cambiarMant('costo', e.target.value)} placeholder="0.00" />
            </div>
            <div className="form-group">
              <label>Kilometraje al realizar</label>
              <input type="number" min="0" value={formMant.kilometraje}
                onChange={e => cambiarMant('kilometraje', e.target.value)} placeholder="Ej: 85000" />
            </div>
            <div className="form-group span-2">
              <label>Próximo service (km)</label>
              <input type="number" min="0" value={formMant.proximo_service}
                onChange={e => cambiarMant('proximo_service', e.target.value)} placeholder="Ej: 95000" />
            </div>
          </div>
          {errMant && <p className="error-msg" style={{ marginTop: 14 }}>Error: {errMant}</p>}
          <div className="modal-footer">
            <button className="btn btn-secundario" onClick={cerrarMant}>Cancelar</button>
            <button className="btn btn-primary" onClick={guardarMant} disabled={guardandoMant}>
              {guardandoMant ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </Modal>
      )}

      {/* ── Modal detalle de entrega ───────────────────────────────── */}
      {detalleEntrega && (
        <Modal titulo={`Detalle entrega — Venta #${String(detalleEntrega.id).padStart(4, '0')}`}
          onCerrar={() => { setDetalleEntrega(null); setErrDetalle(null); }} ancho={620}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 24px', marginBottom: 20 }}>
            <div>
              <span className="comp-label">Fecha de venta</span>
              <span className="comp-valor">{formatFecha(detalleEntrega.fecha)}</span>
            </div>
            <div>
              <span className="comp-label">Total</span>
              <span className="comp-valor" style={{ fontWeight: 800, fontSize: 17, color: 'var(--naranja-oscuro)' }}>${fmt(detalleEntrega.total)}</span>
            </div>
            <div>
              <span className="comp-label">Cliente</span>
              <span className="comp-valor">{detalleEntrega.cliente ?? 'Consumidor final'}</span>
            </div>
            {detalleEntrega.cliente_telefono && (
              <div>
                <span className="comp-label">Teléfono</span>
                <span className="comp-valor">{detalleEntrega.cliente_telefono}</span>
              </div>
            )}
          </div>
          <div style={{ background: 'var(--naranja-claro)', border: '2px solid rgba(230,126,34,0.35)', borderRadius: 'var(--radio)', padding: '14px 18px', marginBottom: 20 }}>
            <p style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--naranja-oscuro)', marginBottom: 4 }}>📍 Dirección de entrega</p>
            <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--texto)', margin: 0 }}>{detalleEntrega.direccion_entrega ?? '—'}</p>
          </div>
          <p className="form-section-titulo">Productos a entregar</p>
          {(!detalleEntrega.items || detalleEntrega.items.length === 0) ? <p className="estado-carga">Sin items registrados.</p> : (
            <div className="tabla-wrapper" style={{ marginBottom: 20 }}>
              <table>
                <thead><tr><th>Producto</th><th style={{ textAlign: 'right' }}>Cantidad</th><th style={{ textAlign: 'right' }}>Subtotal</th></tr></thead>
                <tbody>
                  {detalleEntrega.items.map(item => (
                    <tr key={item.id}>
                      <td style={{ fontWeight: 500 }}>{item.producto ?? item.producto_codigo}</td>
                      <td style={{ textAlign: 'right' }}><strong style={{ fontSize: 15 }}>{parseFloat(item.cantidad).toLocaleString('es-AR')}</strong></td>
                      <td style={{ textAlign: 'right' }}>${fmt(item.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {errDetalle && <p className="error-msg" style={{ marginBottom: 12 }}>{errDetalle}</p>}
          <div className="modal-footer">
            <button className="btn btn-secundario" onClick={() => { setDetalleEntrega(null); setErrDetalle(null); }}>Cerrar</button>
            <button className="btn btn-primary" style={{ background: 'var(--verde)', boxShadow: '0 4px 12px rgba(39,174,96,0.35)' }}
              onClick={marcarEntregada} disabled={marcandoEntregada}>
              {marcandoEntregada ? 'Registrando...' : '✓ Marcar como entregado'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
