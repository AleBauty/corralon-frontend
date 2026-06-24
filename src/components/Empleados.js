import { useEffect, useState, useMemo, useCallback } from 'react';
import Modal from './Modal';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3000';
const ESTADOS_EMP = ['Activo', 'Inactivo'];
const ESTADOS_CAT = ['Activo', 'Inactivo'];

const FORM_VACIO = {
  dni: '', nombre: '', telefono: '', domicilio: '', categoria: '',
  usuario: '', fecha_incorporacion: '', estado: 'Activo', tarifa_hora: '',
};
const FORM_CAT_VACIO = { nombre: '', tarifa_hora: '', descripcion: '', estado: 'Activo' };

function validarEmp(form, esEdicion) {
  const e = {};
  if (!esEdicion) {
    if (!form.dni.trim()) e.dni = 'El DNI es obligatorio';
    else if (!/^\d{7,15}$/.test(form.dni.trim())) e.dni = 'El DNI debe tener entre 7 y 15 dígitos';
  }
  if (!form.nombre.trim())               e.nombre = 'El nombre es obligatorio';
  else if (form.nombre.trim().length < 3) e.nombre = 'Mínimo 3 caracteres';
  if (form.usuario.trim() && form.usuario.trim().length < 3)
    e.usuario = 'Mínimo 3 caracteres';
  if (form.tarifa_hora && isNaN(parseFloat(form.tarifa_hora)))
    e.tarifa_hora = 'Debe ser un número válido';
  return e;
}

const ESTADO_ESTILO = {
  Activo:   { background: '#e6f9f0', color: '#1a8a4a' },
  Inactivo: { background: '#fff0f0', color: '#c0392b' },
};
const TH = { padding: '8px 12px', color: 'rgba(255,255,255,0.85)', textAlign: 'left', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' };
const TD = { padding: '9px 12px', borderBottom: '1px solid var(--borde)' };

export default function Empleados() {
  const [tab, setTab] = useState('empleados');

  // ── Empleados state ──────────────────────────────────────────────
  const [empleados, setEmpleados]         = useState([]);
  const [cargando, setCargando]           = useState(true);
  const [error, setError]                 = useState(null);
  const [busqueda, setBusqueda]           = useState('');
  const [modalAbierto, setModalAbierto]   = useState(false);
  const [esEdicion, setEsEdicion]         = useState(false);
  const [form, setForm]                   = useState(FORM_VACIO);
  const [guardando, setGuardando]         = useState(false);
  const [errorGuardado, setErrorGuardado] = useState(null);

  // ── Categorías empleado state ────────────────────────────────────
  const [categorias, setCategorias]       = useState([]);
  const [modalCat, setModalCat]           = useState(false);
  const [editandoCat, setEditandoCat]     = useState(null);
  const [formCat, setFormCat]             = useState(FORM_CAT_VACIO);
  const [guardandoCat, setGuardandoCat]   = useState(false);
  const [errCat, setErrCat]               = useState(null);

  // ── Remuneraciones state ─────────────────────────────────────────
  const [modalRemun, setModalRemun]       = useState(null);
  const [remuneraciones, setRemunList]    = useState([]);
  const [cargandoRemun, setCargandoRemun] = useState(false);
  const [calcPeriodo, setCalcPeriodo]     = useState('');
  const [calcDesde, setCalcDesde]         = useState('');
  const [calcHasta, setCalcHasta]         = useState('');
  const [calculando, setCalculando]       = useState(false);
  const [errRemun, setErrRemun]           = useState(null);

  const errores    = useMemo(() => validarEmp(form, esEdicion), [form, esEdicion]);
  const hayErrores = Object.values(errores).some(Boolean);

  // ── Cargar datos ─────────────────────────────────────────────────
  const cargar = useCallback(() => {
    setCargando(true);
    fetch(`${API}/api/empleados`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => { setEmpleados(d); setCargando(false); })
      .catch(() => { setError('Error al cargar empleados'); setCargando(false); });
  }, []);

  const cargarCategorias = useCallback(() => {
    fetch(`${API}/api/categorias-empleado`)
      .then(r => r.ok ? r.json() : [])
      .then(setCategorias)
      .catch(() => {});
  }, []);

  useEffect(() => { cargar(); cargarCategorias(); }, [cargar, cargarCategorias]);

  const filtrados = empleados.filter(e =>
    e.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    e.dni.includes(busqueda) ||
    (e.categoria ?? '').toLowerCase().includes(busqueda.toLowerCase())
  );

  // ── Empleados CRUD ───────────────────────────────────────────────
  const cambiar = (campo, val) => setForm(f => ({ ...f, [campo]: val }));

  const cambiarCategoria = nombre => {
    const cat = categorias.find(c => c.nombre === nombre);
    setForm(f => ({
      ...f,
      categoria: nombre,
      tarifa_hora: cat ? String(cat.tarifa_hora) : f.tarifa_hora,
    }));
  };

  const abrirCrear = () => {
    setForm(FORM_VACIO); setEsEdicion(false); setErrorGuardado(null); setModalAbierto(true);
  };
  const abrirEditar = emp => {
    setForm({
      dni: emp.dni, nombre: emp.nombre, telefono: emp.telefono ?? '',
      domicilio: emp.domicilio ?? '', categoria: emp.categoria ?? '',
      usuario: emp.usuario ?? '',
      fecha_incorporacion: emp.fecha_incorporacion ? emp.fecha_incorporacion.split('T')[0] : '',
      estado: emp.estado ?? 'Activo',
      tarifa_hora: emp.tarifa_hora != null ? String(emp.tarifa_hora) : '',
    });
    setEsEdicion(true); setErrorGuardado(null); setModalAbierto(true);
  };
  const cerrar  = () => { setModalAbierto(false); setErrorGuardado(null); };

  const guardar = async () => {
    if (hayErrores) return;
    setGuardando(true); setErrorGuardado(null);
    const body = {
      nombre: form.nombre.trim(), telefono: form.telefono.trim() || null,
      domicilio: form.domicilio.trim() || null, categoria: form.categoria.trim() || null,
      usuario: form.usuario.trim() || null, fecha_incorporacion: form.fecha_incorporacion || null,
      estado: form.estado, tarifa_hora: form.tarifa_hora ? parseFloat(form.tarifa_hora) : null,
    };
    if (!esEdicion) body.dni = form.dni.trim();
    const url = esEdicion ? `${API}/api/empleados/${form.dni}` : `${API}/api/empleados`;
    const method = esEdicion ? 'PUT' : 'POST';
    try {
      const res  = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
      cerrar(); cargar();
    } catch (err) { setErrorGuardado(err.message); }
    finally      { setGuardando(false); }
  };

  // ── Categorías CRUD ──────────────────────────────────────────────
  const abrirCrearCat = () => {
    setFormCat(FORM_CAT_VACIO); setEditandoCat(null); setErrCat(null); setModalCat(true);
  };
  const abrirEditarCat = cat => {
    setFormCat({ nombre: cat.nombre, tarifa_hora: String(cat.tarifa_hora), descripcion: cat.descripcion ?? '', estado: cat.estado });
    setEditandoCat(cat.id); setErrCat(null); setModalCat(true);
  };
  const cerrarCat = () => setModalCat(false);
  const cambiarCat = (campo, val) => setFormCat(f => ({ ...f, [campo]: val }));

  const guardarCat = async () => {
    if (!formCat.nombre.trim()) { setErrCat('El nombre es obligatorio'); return; }
    if (!formCat.tarifa_hora || parseFloat(formCat.tarifa_hora) <= 0) { setErrCat('La tarifa debe ser mayor a 0'); return; }
    setGuardandoCat(true); setErrCat(null);
    const body = { nombre: formCat.nombre.trim(), tarifa_hora: parseFloat(formCat.tarifa_hora), descripcion: formCat.descripcion.trim() || null, estado: formCat.estado };
    const url    = editandoCat ? `${API}/api/categorias-empleado/${editandoCat}` : `${API}/api/categorias-empleado`;
    const method = editandoCat ? 'PUT' : 'POST';
    try {
      const res  = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
      cerrarCat(); cargarCategorias();
    } catch (err) { setErrCat(err.message); }
    finally      { setGuardandoCat(false); }
  };

  // ── Remuneraciones ───────────────────────────────────────────────
  const abrirRemun = async emp => {
    setModalRemun(emp); setRemunList([]); setCargandoRemun(true);
    setErrRemun(null); setCalcPeriodo(''); setCalcDesde(''); setCalcHasta('');
    try {
      const data = await fetch(`${API}/api/remuneraciones?dni=${emp.dni}`).then(r => r.json());
      setRemunList(Array.isArray(data) ? data : []);
    } catch { setErrRemun('Error al cargar remuneraciones'); }
    finally { setCargandoRemun(false); }
  };

  const calcularRemun = async () => {
    if (!calcDesde || !calcHasta) { setErrRemun('Ingresá las fechas desde y hasta'); return; }
    setCalculando(true); setErrRemun(null);
    try {
      const res = await fetch(`${API}/api/remuneraciones/calcular`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dni_empleado: modalRemun.dni, periodo: calcPeriodo || `${calcDesde} al ${calcHasta}`, fecha_desde: calcDesde, fecha_hasta: calcHasta }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
      setRemunList(prev => [data, ...prev]);
      setCalcPeriodo(''); setCalcDesde(''); setCalcHasta('');
    } catch (err) { setErrRemun(err.message); }
    finally { setCalculando(false); }
  };

  const pagarRemun = async id => {
    try {
      const res  = await fetch(`${API}/api/remuneraciones/${id}/pagar`, { method: 'PUT' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRemunList(prev => prev.map(r => r.id === id ? data : r));
    } catch (err) { alert('Error: ' + err.message); }
  };

  // ── Liquidaciones state ──────────────────────────────────────────
  const [liqEmpDni, setLiqEmpDni]         = useState('');
  const [liqMes, setLiqMes]               = useState(() => {
    const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [liqResultado, setLiqResultado]   = useState(null);
  const [liqCalculando, setLiqCalculando] = useState(false);
  const [liqGuardando, setLiqGuardando]   = useState(false);
  const [liqErr, setLiqErr]               = useState(null);
  const [liqMsg, setLiqMsg]               = useState(null);

  const calcularLiquidacion = async () => {
    if (!liqEmpDni || !liqMes) { setLiqErr('Seleccioná un empleado y un período'); return; }
    const emp = empleados.find(e => e.dni === liqEmpDni);
    if (!emp?.tarifa_hora) { setLiqErr('El empleado no tiene tarifa por hora'); return; }
    setLiqCalculando(true); setLiqErr(null); setLiqResultado(null); setLiqMsg(null);
    try {
      const [year, month] = liqMes.split('-');
      const desde = `${year}-${month}-01`;
      const diasMes = new Date(parseInt(year), parseInt(month), 0).getDate();
      const hasta   = `${year}-${month}-${String(diasMes).padStart(2, '0')}`;
      const data = await fetch(`${API}/api/asistencias?dni=${emp.dni}&desde=${desde}&hasta=${hasta}`).then(r => r.json());
      const asists = Array.isArray(data) ? data : (data.asistencias ?? []);
      const tarifa = parseFloat(emp.tarifa_hora);
      let horasNormales = 0, horasExtra = 0, diasTrabajados = 0;
      for (const a of asists) {
        const horas = parseFloat(a.horas_trabajadas ?? 0);
        if (horas > 0) {
          diasTrabajados++;
          const normales = Math.min(horas, 9);
          const extra    = Math.max(horas - 9, 0);
          horasNormales += normales;
          horasExtra    += extra;
        }
      }
      const montoNormal = horasNormales * tarifa;
      const montoExtra  = horasExtra * tarifa * 1.5;
      const totalLiq    = montoNormal + montoExtra;
      setLiqResultado({ emp, desde, hasta, diasTrabajados, horasNormales, horasExtra, montoNormal, montoExtra, totalLiq, tarifa, asists });
    } catch (err) { setLiqErr('Error al calcular: ' + err.message); }
    finally { setLiqCalculando(false); }
  };

  const guardarLiquidacion = async () => {
    if (!liqResultado) return;
    setLiqGuardando(true); setLiqErr(null);
    try {
      const { emp, desde, hasta, horasNormales, horasExtra, totalLiq, tarifa } = liqResultado;
      const [year, month] = liqMes.split('-');
      const periodoLabel  = new Date(parseInt(year), parseInt(month) - 1, 1)
        .toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
      const body = {
        dni_empleado:   emp.dni,
        periodo:        periodoLabel,
        fecha_desde:    desde,
        fecha_hasta:    hasta,
        horas_trabajadas: (horasNormales + horasExtra).toFixed(2),
        tarifa_hora:    tarifa,
        total:          totalLiq.toFixed(2),
        horas_extra:    horasExtra.toFixed(2),
        estado:         'Pendiente',
      };
      const res  = await fetch(`${API}/api/remuneraciones`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
      setLiqMsg(`Liquidación guardada. Total: $${parseFloat(totalLiq).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`);
      setLiqResultado(null);
    } catch (err) { setLiqErr(err.message); }
    finally { setLiqGuardando(false); }
  };

  if (cargando) return <p className="estado-carga">Cargando empleados...</p>;
  if (error)    return <p className="estado-error">Error: {error}</p>;

  return (
    <div>
      <div className="seccion-header">
        <h2>Empleados</h2>
        {tab === 'empleados'  && <button className="btn-nuevo" onClick={abrirCrear}>+ Nuevo empleado</button>}
        {tab === 'categorias' && <button className="btn-nuevo" onClick={abrirCrearCat}>+ Nueva categoría</button>}
      </div>

      <div className="seccion-tabs">
        <button className={`seccion-tab ${tab === 'empleados'    ? 'activo' : ''}`} onClick={() => setTab('empleados')}>👷 Empleados</button>
        <button className={`seccion-tab ${tab === 'categorias'   ? 'activo' : ''}`} onClick={() => setTab('categorias')}>📋 Categorías</button>
        <button className={`seccion-tab ${tab === 'liquidaciones'? 'activo' : ''}`} onClick={() => setTab('liquidaciones')}>💵 Liquidaciones</button>
      </div>

      {/* ══ TAB: EMPLEADOS ══════════════════════════════════════════ */}
      {tab === 'empleados' && (
        <>
          <input type="text" placeholder="Buscar por nombre, DNI o categoría..."
            value={busqueda} onChange={e => setBusqueda(e.target.value)} className="buscador" />

          {filtrados.length === 0 ? <p className="estado-carga">No se encontraron empleados.</p> : (
            <div className="tabla-wrapper">
              <table>
                <thead><tr>
                  <th>DNI</th><th>Nombre</th><th>Categoría</th><th>Tarifa/h</th>
                  <th>Teléfono</th><th>Incorporación</th><th>Estado</th><th></th>
                </tr></thead>
                <tbody>
                  {filtrados.map(emp => (
                    <tr key={emp.dni}>
                      <td><code>{emp.dni}</code></td>
                      <td style={{ fontWeight: 500 }}>{emp.nombre}</td>
                      <td>{emp.categoria ?? '—'}</td>
                      <td>{emp.tarifa_hora != null ? `$${parseFloat(emp.tarifa_hora).toLocaleString('es-AR', { minimumFractionDigits: 2 })}` : '—'}</td>
                      <td>{emp.telefono ?? '—'}</td>
                      <td>{emp.fecha_incorporacion ? new Date(emp.fecha_incorporacion).toLocaleDateString('es-AR') : '—'}</td>
                      <td><span className="badge" style={ESTADO_ESTILO[emp.estado] ?? ESTADO_ESTILO.Activo}>{emp.estado}</span></td>
                      <td style={{ display: 'flex', gap: 6 }}>
                        <button className="btn-editar" onClick={() => abrirEditar(emp)}>Editar</button>
                        <button className="btn-editar" style={{ background: '#eef2ff', color: '#3730a3', borderColor: 'rgba(55,48,163,0.3)' }}
                          onClick={() => abrirRemun(emp)}>💰 Remun.</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ══ TAB: CATEGORÍAS ═════════════════════════════════════════ */}
      {tab === 'categorias' && (
        <>
          {categorias.length === 0 ? <p className="estado-carga">No hay categorías registradas.</p> : (
            <div className="tabla-wrapper">
              <table>
                <thead><tr>
                  <th>Nombre</th><th style={{ textAlign: 'right' }}>Tarifa/hora</th><th>Descripción</th><th>Estado</th><th></th>
                </tr></thead>
                <tbody>
                  {categorias.map(cat => (
                    <tr key={cat.id}>
                      <td style={{ fontWeight: 600 }}>{cat.nombre}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>${parseFloat(cat.tarifa_hora).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                      <td style={{ color: 'var(--texto-medio)', fontSize: 13 }}>{cat.descripcion ?? '—'}</td>
                      <td><span className="badge" style={ESTADO_ESTILO[cat.estado] ?? ESTADO_ESTILO.Activo}>{cat.estado}</span></td>
                      <td><button className="btn-editar" onClick={() => abrirEditarCat(cat)}>Editar</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ══ TAB: LIQUIDACIONES ═════════════════════════════════════ */}
      {tab === 'liquidaciones' && (
        <div style={{ maxWidth: 680 }}>
          <p style={{ fontSize: 13, color: 'var(--texto-suave)', marginBottom: 20 }}>
            Calculá el sueldo mensual de un empleado según sus asistencias. Horas extra (&gt;9h/día) se pagan al 150%.
          </p>

          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 20 }}>
            <div className="form-group" style={{ flex: 2, minWidth: 200, marginBottom: 0 }}>
              <label>Empleado</label>
              <select value={liqEmpDni} onChange={e => setLiqEmpDni(e.target.value)}>
                <option value="">— Seleccionar —</option>
                {empleados.filter(e => e.estado === 'Activo').map(e => (
                  <option key={e.dni} value={e.dni}>{e.nombre}</option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ flex: 1, minWidth: 140, marginBottom: 0 }}>
              <label>Mes / Año</label>
              <input type="month" value={liqMes} onChange={e => setLiqMes(e.target.value)} />
            </div>
            <button className="btn btn-primary" onClick={calcularLiquidacion} disabled={liqCalculando} style={{ alignSelf: 'flex-end' }}>
              {liqCalculando ? 'Calculando...' : 'Calcular'}
            </button>
          </div>

          {liqErr && <p className="error-msg" style={{ marginBottom: 12 }}>{liqErr}</p>}
          {liqMsg && <p style={{ background: 'var(--verde-fondo)', color: 'var(--verde)', padding: '10px 14px', borderRadius: 8, marginBottom: 12, fontWeight: 600 }}>{liqMsg}</p>}

          {liqResultado && (
            <div style={{ background: '#fff', border: '1px solid var(--borde)', borderRadius: 12, padding: '20px 24px' }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>
                Liquidación: {liqResultado.emp.nombre}
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                {[
                  ['Días trabajados', liqResultado.diasTrabajados],
                  ['Horas normales (≤9h/día)', `${liqResultado.horasNormales.toFixed(1)}h`],
                  ['Horas extra (>9h/día)', `${liqResultado.horasExtra.toFixed(1)}h`],
                  ['Tarifa normal', `$${parseFloat(liqResultado.tarifa).toLocaleString('es-AR', { minimumFractionDigits: 2 })}/h`],
                  ['Tarifa extra (×1.5)', `$${(liqResultado.tarifa * 1.5).toLocaleString('es-AR', { minimumFractionDigits: 2 })}/h`],
                  ['Monto normal', `$${liqResultado.montoNormal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`],
                  ['Monto extra', `$${liqResultado.montoExtra.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`],
                ].map(([label, val]) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--borde)', fontSize: 14 }}>
                    <span style={{ color: 'var(--texto-suave)' }}>{label}</span>
                    <span style={{ fontWeight: 600 }}>{val}</span>
                  </div>
                ))}
                <div style={{ gridColumn: '1/-1', display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderTop: '2px solid var(--borde)', fontSize: 18, fontWeight: 700, marginTop: 4 }}>
                  <span>Total a pagar</span>
                  <span style={{ color: 'var(--verde)' }}>${liqResultado.totalLiq.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              {liqResultado.asists.length > 0 && (
                <details style={{ marginBottom: 16 }}>
                  <summary style={{ cursor: 'pointer', fontSize: 13, color: 'var(--texto-suave)', marginBottom: 8 }}>
                    Ver detalle asistencias ({liqResultado.asists.length} registros)
                  </summary>
                  <div className="tabla-wrapper" style={{ margin: 0 }}>
                    <table>
                      <thead><tr><th>Fecha</th><th>Entrada</th><th>Salida</th><th style={{ textAlign: 'right' }}>Horas</th><th style={{ textAlign: 'right' }}>Normales</th><th style={{ textAlign: 'right' }}>Extra</th></tr></thead>
                      <tbody>
                        {liqResultado.asists.map(a => {
                          const h = parseFloat(a.horas_trabajadas ?? 0);
                          const n = Math.min(h, 9), x = Math.max(h - 9, 0);
                          return (
                            <tr key={a.id}>
                              <td>{new Date(a.fecha).toLocaleDateString('es-AR')}</td>
                              <td>{a.hora_entrada ? String(a.hora_entrada).substring(0, 5) : '—'}</td>
                              <td>{a.hora_salida ? String(a.hora_salida).substring(0, 5) : '—'}</td>
                              <td style={{ textAlign: 'right', fontWeight: 600 }}>{h.toFixed(1)}h</td>
                              <td style={{ textAlign: 'right' }}>{n.toFixed(1)}h</td>
                              <td style={{ textAlign: 'right', color: x > 0 ? 'var(--naranja-oscuro)' : undefined }}>{x > 0 ? `${x.toFixed(1)}h` : '—'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </details>
              )}

              <div className="modal-footer" style={{ padding: 0, borderTop: 'none', marginTop: 0 }}>
                <button className="btn btn-secundario" onClick={() => setLiqResultado(null)}>Descartar</button>
                <button className="btn btn-primary" onClick={guardarLiquidacion} disabled={liqGuardando}>
                  {liqGuardando ? 'Guardando...' : 'Guardar liquidación'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Modal empleado ─────────────────────────────────────────── */}
      {modalAbierto && (
        <Modal titulo={esEdicion ? `Editar — ${form.nombre}` : 'Nuevo empleado'} onCerrar={cerrar} ancho={580}>
          <div className="form-grid">
            {!esEdicion && (
              <div className="form-group">
                <label>DNI *</label>
                <input value={form.dni} onChange={e => cambiar('dni', e.target.value.replace(/\D/g, ''))}
                  className={errores.dni ? 'error-campo' : ''} placeholder="Ej: 38000001" maxLength={15} autoFocus />
                {errores.dni && <span className="error-msg">{errores.dni}</span>}
              </div>
            )}
            <div className={`form-group ${!esEdicion ? '' : 'span-2'}`}>
              <label>Nombre completo *</label>
              <input value={form.nombre} onChange={e => cambiar('nombre', e.target.value)}
                className={errores.nombre ? 'error-campo' : ''} placeholder="Ej: Juan Pérez" autoFocus={esEdicion} />
              {errores.nombre && <span className="error-msg">{errores.nombre}</span>}
            </div>
            <div className="form-group">
              <label>Teléfono</label>
              <input value={form.telefono} onChange={e => cambiar('telefono', e.target.value)} placeholder="Ej: 0388-4123456" />
            </div>
            <div className="form-group">
              <label>Categoría / Puesto</label>
              {categorias.length > 0 ? (
                <select value={form.categoria} onChange={e => cambiarCategoria(e.target.value)}>
                  <option value="">— Sin categoría —</option>
                  {categorias.filter(c => c.estado === 'Activo').map(c => (
                    <option key={c.id} value={c.nombre}>{c.nombre}</option>
                  ))}
                </select>
              ) : (
                <input value={form.categoria} onChange={e => cambiar('categoria', e.target.value)} placeholder="Ej: Repositor, Cajero" />
              )}
            </div>
            <div className="form-group span-2">
              <label>Domicilio</label>
              <input value={form.domicilio} onChange={e => cambiar('domicilio', e.target.value)} placeholder="Ej: Av. Independencia 123" />
            </div>
            <div className="form-group">
              <label>Usuario del sistema</label>
              <input value={form.usuario} onChange={e => cambiar('usuario', e.target.value)}
                className={errores.usuario ? 'error-campo' : ''} placeholder="Ej: jperez" />
              {errores.usuario && <span className="error-msg">{errores.usuario}</span>}
            </div>
            <div className="form-group">
              <label>Tarifa por hora ($)</label>
              <input type="number" min="0" step="0.01" value={form.tarifa_hora}
                onChange={e => cambiar('tarifa_hora', e.target.value)}
                className={errores.tarifa_hora ? 'error-campo' : ''} placeholder="Ej: 1500.00" />
              {errores.tarifa_hora && <span className="error-msg">{errores.tarifa_hora}</span>}
            </div>
            <div className="form-group">
              <label>Fecha de incorporación</label>
              <input type="date" value={form.fecha_incorporacion} onChange={e => cambiar('fecha_incorporacion', e.target.value)} />
            </div>
            {esEdicion && (
              <div className="form-group">
                <label>Estado</label>
                <select value={form.estado} onChange={e => cambiar('estado', e.target.value)}>
                  {ESTADOS_EMP.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            )}
          </div>
          {errorGuardado && <p className="error-msg" style={{ marginTop: 14 }}>Error: {errorGuardado}</p>}
          <div className="modal-footer">
            <button className="btn btn-secundario" onClick={cerrar}>Cancelar</button>
            <button className="btn btn-primary" onClick={guardar} disabled={hayErrores || guardando}>
              {guardando ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </Modal>
      )}

      {/* ── Modal categoría ────────────────────────────────────────── */}
      {modalCat && (
        <Modal titulo={editandoCat ? 'Editar categoría' : 'Nueva categoría'} onCerrar={cerrarCat} ancho={480}>
          <div className="form-grid">
            <div className="form-group span-2">
              <label>Nombre *</label>
              <input value={formCat.nombre} onChange={e => cambiarCat('nombre', e.target.value)}
                placeholder="Ej: Repositor, Cajero, Chofer" autoFocus />
            </div>
            <div className="form-group">
              <label>Tarifa por hora ($) *</label>
              <input type="number" min="0" step="0.01" value={formCat.tarifa_hora}
                onChange={e => cambiarCat('tarifa_hora', e.target.value)} placeholder="Ej: 1500.00" />
            </div>
            <div className="form-group">
              <label>Estado</label>
              <select value={formCat.estado} onChange={e => cambiarCat('estado', e.target.value)}>
                {ESTADOS_CAT.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-group span-2">
              <label>Descripción</label>
              <input value={formCat.descripcion} onChange={e => cambiarCat('descripcion', e.target.value)}
                placeholder="Descripción opcional del puesto" />
            </div>
          </div>
          {errCat && <p className="error-msg" style={{ marginTop: 14 }}>Error: {errCat}</p>}
          <div className="modal-footer">
            <button className="btn btn-secundario" onClick={cerrarCat}>Cancelar</button>
            <button className="btn btn-primary" onClick={guardarCat} disabled={guardandoCat}>
              {guardandoCat ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </Modal>
      )}

      {/* ── Modal remuneraciones ────────────────────────────────────── */}
      {modalRemun && (
        <Modal titulo={`Remuneraciones — ${modalRemun.nombre}`} onCerrar={() => setModalRemun(null)} ancho={720}>
          <p className="form-section-titulo">Calcular nueva remuneración</p>
          {!modalRemun.tarifa_hora && (
            <p style={{ fontSize: 13, color: 'var(--rojo)', background: 'var(--rojo-fondo)', padding: '8px 12px', borderRadius: 6, marginBottom: 12 }}>
              Este empleado no tiene tarifa por hora. Editalo y asignale una tarifa antes de calcular.
            </p>
          )}
          <div className="asist-registro-row" style={{ marginBottom: 8 }}>
            <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
              <label>Período</label>
              <input value={calcPeriodo} onChange={e => setCalcPeriodo(e.target.value)} placeholder="Ej: Junio 2026" />
            </div>
            <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
              <label>Desde *</label>
              <input type="date" value={calcDesde} onChange={e => setCalcDesde(e.target.value)} />
            </div>
            <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
              <label>Hasta *</label>
              <input type="date" value={calcHasta} onChange={e => setCalcHasta(e.target.value)} />
            </div>
            <div>
              <button className="btn btn-primary" onClick={calcularRemun}
                disabled={calculando || !modalRemun.tarifa_hora} style={{ whiteSpace: 'nowrap' }}>
                {calculando ? 'Calculando...' : 'Calcular'}
              </button>
            </div>
          </div>
          {modalRemun.tarifa_hora && (
            <p style={{ fontSize: 12, color: 'var(--texto-suave)', marginBottom: 4 }}>
              Tarifa actual: <strong>${parseFloat(modalRemun.tarifa_hora).toLocaleString('es-AR', { minimumFractionDigits: 2 })}/hora</strong>
            </p>
          )}
          {errRemun && <p className="error-msg" style={{ marginTop: 6, marginBottom: 12 }}>{errRemun}</p>}

          <p className="form-section-titulo" style={{ marginTop: 24 }}>Historial</p>
          {cargandoRemun ? <p className="estado-carga" style={{ padding: '12px 0' }}>Cargando...</p>
            : remuneraciones.length === 0 ? <p className="estado-carga" style={{ padding: '12px 0' }}>Sin remuneraciones registradas.</p>
            : (
              <div className="tabla-wrapper" style={{ marginTop: 0 }}>
                <table>
                  <thead><tr style={{ background: 'var(--fondo-th)' }}>
                    <th style={TH}>Período</th>
                    <th style={{ ...TH, textAlign: 'right' }}>Horas</th>
                    <th style={{ ...TH, textAlign: 'right' }}>Tarifa/h</th>
                    <th style={{ ...TH, textAlign: 'right' }}>Total</th>
                    <th style={TH}>Estado</th>
                    <th style={TH}></th>
                  </tr></thead>
                  <tbody>
                    {remuneraciones.map(r => (
                      <tr key={r.id}>
                        <td style={TD}>{r.periodo}</td>
                        <td style={{ ...TD, textAlign: 'right' }}>{parseFloat(r.horas_trabajadas).toLocaleString('es-AR', { minimumFractionDigits: 1 })}h</td>
                        <td style={{ ...TD, textAlign: 'right' }}>${parseFloat(r.tarifa_hora).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                        <td style={{ ...TD, textAlign: 'right', fontWeight: 700 }}>${parseFloat(r.total).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                        <td style={TD}><span className="badge" style={r.estado === 'Pagado' ? { background: '#e6f9f0', color: '#1a8a4a' } : { background: '#FEF9E7', color: '#B7770D' }}>{r.estado}</span></td>
                        <td style={TD}>
                          {r.estado === 'Pendiente' && (
                            <button className="btn-editar" style={{ background: '#e6f9f0', color: '#1a8a4a', borderColor: 'rgba(39,174,96,0.3)' }}
                              onClick={() => pagarRemun(r.id)}>✓ Pagar</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
        </Modal>
      )}
    </div>
  );
}
