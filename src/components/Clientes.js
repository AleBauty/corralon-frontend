import { useEffect, useState, useMemo, useCallback } from 'react';
import Modal from './Modal';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3000';

const TIPOS = ['Normal', 'Mayorista', 'VIP', 'Cuenta corriente'];

const TIPO_ESTILO = {
  Normal:              { background: '#eef2ff', color: '#3730a3' },
  Mayorista:           { background: '#fef9c3', color: '#854d0e' },
  VIP:                 { background: '#fdf2f8', color: '#86198f' },
  'Cuenta corriente':  { background: '#e8f5e9', color: '#2e7d32' },
};

const FORM_VACIO = {
  dni: '', nombre_apellido: '', telefono: '', email: '', domicilio: '',
  tipo: 'Normal', limite_credito: '50000',
  codigo_postal: '', localidad: '',
};

function validar(form, esEdicion) {
  const e = {};
  if (!esEdicion) {
    if (!form.dni.trim())
      e.dni = 'El DNI es obligatorio';
    else if (!/^\d{7,15}$/.test(form.dni.trim()))
      e.dni = 'El DNI debe tener entre 7 y 15 dígitos (solo números)';
  }
  if (!form.nombre_apellido.trim())
    e.nombre_apellido = 'El nombre y apellido es obligatorio';
  else if (form.nombre_apellido.trim().length < 3)
    e.nombre_apellido = 'Mínimo 3 caracteres';
  else if (form.nombre_apellido.trim().length > 150)
    e.nombre_apellido = 'Máximo 150 caracteres';
  if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
    e.email = 'El formato del email no es válido';
  if (form.telefono.trim() && form.telefono.trim().length < 6)
    e.telefono = 'El teléfono debe tener al menos 6 caracteres';
  if (form.tipo === 'Cuenta corriente') {
    if (form.limite_credito === '' || isNaN(parseFloat(form.limite_credito)) || parseFloat(form.limite_credito) <= 0)
      e.limite_credito = 'El límite de crédito debe ser mayor a 0';
  }
  return e;
}

function fmt(n) { return parseFloat(n ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 2 }); }

export default function Clientes() {
  const [clientes, setClientes]           = useState([]);
  const [cargando, setCargando]           = useState(true);
  const [error, setError]                 = useState(null);
  const [busqueda, setBusqueda]           = useState('');
  const [modalAbierto, setModalAbierto]   = useState(false);
  const [esEdicion, setEsEdicion]         = useState(false);
  const [form, setForm]                   = useState(FORM_VACIO);
  const [guardando, setGuardando]         = useState(false);
  const [errorGuardado, setErrorGuardado] = useState(null);

  // CP lookup
  const [cpBuscando, setCpBuscando] = useState(false);
  const [cpInfo,     setCpInfo]     = useState('');

  const errores    = useMemo(() => validar(form, esEdicion), [form, esEdicion]);
  const hayErrores = Object.values(errores).some(Boolean);

  const cargarClientes = useCallback(() => {
    setCargando(true);
    fetch(`${API}/api/clientes`)
      .then(r => r.ok ? r.json() : Promise.reject(`Error ${r.status}`))
      .then(data => { setClientes(data); setCargando(false); })
      .catch(err  => { setError(String(err)); setCargando(false); });
  }, []);

  useEffect(() => { cargarClientes(); }, [cargarClientes]);

  // Autocompletar CP
  useEffect(() => {
    const cp = form.codigo_postal.trim();
    if (cp.length < 4) { setCpInfo(''); return; }
    const timer = setTimeout(async () => {
      setCpBuscando(true); setCpInfo('');
      try {
        const res  = await fetch(`https://apis.datos.gob.ar/georef/api/localidades?codigo_postal=${cp}&max=1`);
        const data = await res.json();
        if (data.localidades?.length) {
          const loc = data.localidades[0];
          setForm(f => ({ ...f, localidad: loc.nombre }));
          setCpInfo(`${loc.nombre}, ${loc.provincia.nombre}`);
        } else {
          setCpInfo('CP no encontrado');
        }
      } catch { setCpInfo('Error al consultar el CP'); }
      finally   { setCpBuscando(false); }
    }, 700);
    return () => clearTimeout(timer);
  }, [form.codigo_postal]);

  const filtrados = clientes.filter(c =>
    c.nombre_apellido.toLowerCase().includes(busqueda.toLowerCase()) ||
    c.dni.includes(busqueda)
  );

  const abrirCrear = () => {
    setForm(FORM_VACIO); setEsEdicion(false); setErrorGuardado(null); setCpInfo(''); setModalAbierto(true);
  };
  const abrirEditar = c => {
    setForm({
      dni: c.dni, nombre_apellido: c.nombre_apellido, telefono: c.telefono ?? '',
      email: c.email ?? '', domicilio: c.domicilio ?? '', tipo: c.tipo ?? 'Normal',
      limite_credito: c.limite_credito != null ? String(parseFloat(c.limite_credito)) : '50000',
      codigo_postal: c.codigo_postal ?? '', localidad: c.localidad ?? '',
    });
    setCpInfo('');
    setEsEdicion(true); setErrorGuardado(null); setModalAbierto(true);
  };
  const cerrar  = () => { setModalAbierto(false); setErrorGuardado(null); setCpInfo(''); };
  const cambiar = (campo, valor) => setForm(f => ({ ...f, [campo]: valor }));

  const guardar = async () => {
    if (hayErrores) return;
    setGuardando(true); setErrorGuardado(null);
    const body = {
      nombre_apellido: form.nombre_apellido.trim(),
      telefono:  form.telefono.trim()  || null,
      email:     form.email.trim()     || null,
      domicilio: form.domicilio.trim() || null,
      tipo:      form.tipo,
      limite_credito: form.tipo === 'Cuenta corriente' ? parseFloat(form.limite_credito) : null,
      codigo_postal: form.codigo_postal.trim() || null,
      localidad:     form.localidad.trim()     || null,
    };
    if (!esEdicion) body.dni = form.dni.trim();
    const url = esEdicion ? `${API}/api/clientes/${form.dni}` : `${API}/api/clientes`;
    try {
      const res  = await fetch(url, { method: esEdicion ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
      cerrar(); cargarClientes();
    } catch (err) { setErrorGuardado(err.message); }
    finally      { setGuardando(false); }
  };

  if (cargando) return <p className="estado-carga">Cargando clientes...</p>;
  if (error)    return <p className="estado-error">Error: {error}</p>;

  return (
    <div>
      <div className="seccion-header">
        <h2>Clientes <span className="total-registros">{clientes.length}</span></h2>
        <button className="btn-nuevo" onClick={abrirCrear}>+ Nuevo cliente</button>
      </div>
      <input type="text" placeholder="Buscar por nombre o DNI..." value={busqueda}
        onChange={e => setBusqueda(e.target.value)} className="buscador" />
      {filtrados.length === 0 ? <p className="estado-carga">No se encontraron clientes.</p> : (
        <div className="tabla-wrapper">
          <table>
            <thead><tr>
              <th>DNI</th><th>Nombre y Apellido</th><th>Teléfono</th>
              <th>Localidad</th><th>Tipo</th><th>Límite CC</th><th></th>
            </tr></thead>
            <tbody>
              {filtrados.map(c => (
                <tr key={c.dni}>
                  <td><code>{c.dni}</code></td>
                  <td style={{ fontWeight: 500 }}>{c.nombre_apellido}</td>
                  <td>{c.telefono ?? '—'}</td>
                  <td style={{ fontSize: 13 }}>
                    {c.localidad ? c.localidad : (c.domicilio ?? '—')}
                    {c.codigo_postal && <span style={{ color: 'var(--texto-suave)', marginLeft: 4 }}>({c.codigo_postal})</span>}
                  </td>
                  <td><span className="badge" style={TIPO_ESTILO[c.tipo] ?? TIPO_ESTILO.Normal}>{c.tipo}</span></td>
                  <td style={{ textAlign: 'right', fontSize: 13 }}>
                    {c.tipo === 'Cuenta corriente' ? `$${fmt(c.limite_credito)}` : '—'}
                  </td>
                  <td><button className="btn-editar" onClick={() => abrirEditar(c)}>Editar</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalAbierto && (
        <Modal titulo={esEdicion ? `Editar — ${form.nombre_apellido}` : 'Nuevo cliente'} onCerrar={cerrar} ancho={600}>
          <div className="form-grid">
            {!esEdicion && (
              <div className="form-group span-2">
                <label>DNI *</label>
                <input value={form.dni} onChange={e => cambiar('dni', e.target.value.replace(/\D/g, ''))}
                  className={errores.dni ? 'error-campo' : ''} placeholder="Ej: 38000001" maxLength={15} autoFocus />
                {errores.dni && <span className="error-msg">{errores.dni}</span>}
              </div>
            )}
            <div className="form-group span-2">
              <label>Nombre y Apellido *</label>
              <input value={form.nombre_apellido} onChange={e => cambiar('nombre_apellido', e.target.value)}
                className={errores.nombre_apellido ? 'error-campo' : ''} placeholder="Ej: Juan Pérez" autoFocus={esEdicion} />
              {errores.nombre_apellido && <span className="error-msg">{errores.nombre_apellido}</span>}
            </div>
            <div className="form-group">
              <label>Teléfono</label>
              <input value={form.telefono} onChange={e => cambiar('telefono', e.target.value)}
                className={errores.telefono ? 'error-campo' : ''} placeholder="Ej: 0388-4123456" />
              {errores.telefono && <span className="error-msg">{errores.telefono}</span>}
            </div>
            <div className="form-group">
              <label>Email</label>
              <input type="email" value={form.email} onChange={e => cambiar('email', e.target.value)}
                className={errores.email ? 'error-campo' : ''} placeholder="Ej: juan@mail.com" />
              {errores.email && <span className="error-msg">{errores.email}</span>}
            </div>
            <div className="form-group span-2">
              <label>Domicilio</label>
              <input value={form.domicilio} onChange={e => cambiar('domicilio', e.target.value)}
                placeholder="Ej: Av. Independencia 123" />
            </div>

            {/* CP + Localidad */}
            <div className="form-group">
              <label>Código Postal</label>
              <input value={form.codigo_postal} onChange={e => cambiar('codigo_postal', e.target.value.replace(/\D/g, ''))}
                placeholder="Ej: 4600" maxLength={6} />
              {cpBuscando && <span style={{ fontSize: 12, color: 'var(--texto-suave)' }}>Buscando...</span>}
              {!cpBuscando && cpInfo && (
                <span style={{ fontSize: 12, color: cpInfo === 'CP no encontrado' ? '#dc2626' : 'var(--verde)' }}>
                  {cpInfo}
                </span>
              )}
            </div>
            <div className="form-group">
              <label>Localidad</label>
              <input value={form.localidad} onChange={e => cambiar('localidad', e.target.value)}
                placeholder="Se completa automáticamente" />
            </div>

            <div className="form-group">
              <label>Tipo de cliente</label>
              <select value={form.tipo} onChange={e => cambiar('tipo', e.target.value)}>
                {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            {form.tipo === 'Cuenta corriente' && (
              <div className="form-group">
                <label>Límite de crédito ($) *</label>
                <input type="number" min="1" step="100" value={form.limite_credito}
                  onChange={e => cambiar('limite_credito', e.target.value)}
                  className={errores.limite_credito ? 'error-campo' : ''}
                  placeholder="Ej: 50000" />
                {errores.limite_credito
                  ? <span className="error-msg">{errores.limite_credito}</span>
                  : <span style={{ fontSize: 12, color: 'var(--texto-suave)' }}>Default: $50.000</span>}
              </div>
            )}
          </div>
          {errorGuardado && <p className="error-msg" style={{ marginTop: 14 }}>Error al guardar: {errorGuardado}</p>}
          <div className="modal-footer">
            <button className="btn btn-secundario" onClick={cerrar} type="button">Cancelar</button>
            <button className="btn btn-primary" onClick={guardar} disabled={hayErrores || guardando} type="button">
              {guardando ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
