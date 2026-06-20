import { useEffect, useState, useMemo, useCallback } from 'react';
import Modal from './Modal';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3000';

const ESTADO_ESTILO = {
  Activo:   { background: '#e6f9f0', color: '#1a8a4a' },
  Inactivo: { background: '#f0f0f0', color: '#666' },
};

const FORM_VACIO = {
  cuit: '', nombre: '', telefono: '', email: '',
  direccion: '', provincia: '', contacto: '', cbu: '',
  observaciones: '', estado: 'Activo',
};

function validar(form, esEdicion) {
  const e = {};
  if (!esEdicion) {
    if (!form.cuit.trim())
      e.cuit = 'El CUIT es obligatorio';
    else if (!/^[\d\-]{10,13}$/.test(form.cuit.trim()))
      e.cuit = 'Formato inválido (ej: 20-11111111-1)';
  }
  if (!form.nombre.trim())
    e.nombre = 'El nombre es obligatorio';
  else if (form.nombre.trim().length < 3)
    e.nombre = 'Mínimo 3 caracteres';
  if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
    e.email = 'Email inválido';
  return e;
}

export default function Proveedores() {
  const [proveedores, setProveedores]     = useState([]);
  const [cargando, setCargando]           = useState(true);
  const [error, setError]                 = useState(null);
  const [busqueda, setBusqueda]           = useState('');
  const [modalAbierto, setModalAbierto]   = useState(false);
  const [esEdicion, setEsEdicion]         = useState(false);
  const [form, setForm]                   = useState(FORM_VACIO);
  const [guardando, setGuardando]         = useState(false);
  const [errorGuardado, setErrorGuardado] = useState(null);

  const errores    = useMemo(() => validar(form, esEdicion), [form, esEdicion]);
  const hayErrores = Object.values(errores).some(Boolean);

  const cargarProveedores = useCallback(() => {
    setCargando(true);
    fetch(`${API}/api/proveedores`)
      .then(r => r.ok ? r.json() : Promise.reject(`Error ${r.status}`))
      .then(data => { setProveedores(data); setCargando(false); })
      .catch(err  => { setError(String(err)); setCargando(false); });
  }, []);

  useEffect(() => { cargarProveedores(); }, [cargarProveedores]);

  const filtrados = proveedores.filter(p =>
    p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    p.cuit.includes(busqueda) ||
    (p.provincia ?? '').toLowerCase().includes(busqueda.toLowerCase())
  );

  const abrirCrear = () => {
    setForm(FORM_VACIO); setEsEdicion(false); setErrorGuardado(null); setModalAbierto(true);
  };
  const abrirEditar = p => {
    setForm({
      cuit:         p.cuit,
      nombre:       p.nombre,
      telefono:     p.telefono    ?? '',
      email:        p.email       ?? '',
      direccion:    p.direccion   ?? '',
      provincia:    p.provincia   ?? '',
      contacto:     p.contacto    ?? '',
      cbu:          p.cbu         ?? '',
      observaciones: p.observaciones ?? '',
      estado:       p.estado      ?? 'Activo',
    });
    setEsEdicion(true); setErrorGuardado(null); setModalAbierto(true);
  };
  const cerrar  = () => { setModalAbierto(false); setErrorGuardado(null); };
  const cambiar = (campo, valor) => setForm(f => ({ ...f, [campo]: valor }));

  const guardar = async () => {
    if (hayErrores) return;
    setGuardando(true); setErrorGuardado(null);
    const body = {
      nombre:        form.nombre.trim(),
      telefono:      form.telefono.trim()      || null,
      email:         form.email.trim()         || null,
      direccion:     form.direccion.trim()     || null,
      provincia:     form.provincia.trim()     || null,
      contacto:      form.contacto.trim()      || null,
      cbu:           form.cbu.trim()           || null,
      observaciones: form.observaciones.trim() || null,
      estado:        form.estado,
    };
    if (!esEdicion) body.cuit = form.cuit.trim();
    const url    = esEdicion ? `${API}/api/proveedores/${form.cuit}` : `${API}/api/proveedores`;
    const method = esEdicion ? 'PUT' : 'POST';
    try {
      const res  = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
      cerrar(); cargarProveedores();
    } catch (err) { setErrorGuardado(err.message); }
    finally      { setGuardando(false); }
  };

  if (cargando) return <p className="estado-carga">Cargando proveedores...</p>;
  if (error)    return <p className="estado-error">Error: {error}</p>;

  return (
    <div>
      <div className="seccion-header">
        <h2>Proveedores <span className="total-registros">{proveedores.length}</span></h2>
        <button className="btn-nuevo" onClick={abrirCrear}>+ Nuevo proveedor</button>
      </div>

      <input type="text" placeholder="Buscar por nombre, CUIT o provincia..."
        value={busqueda} onChange={e => setBusqueda(e.target.value)} className="buscador" />

      {filtrados.length === 0 ? (
        <p className="estado-carga">No se encontraron proveedores.</p>
      ) : (
        <div className="tabla-wrapper">
          <table>
            <thead><tr>
              <th>CUIT</th><th>Nombre</th><th>Teléfono</th>
              <th>Email</th><th>Provincia</th><th>Contacto</th><th>Estado</th><th></th>
            </tr></thead>
            <tbody>
              {filtrados.map(p => (
                <tr key={p.cuit}>
                  <td><code>{p.cuit}</code></td>
                  <td style={{ fontWeight: 500 }}>{p.nombre}</td>
                  <td>{p.telefono  ?? '—'}</td>
                  <td>{p.email     ?? '—'}</td>
                  <td>{p.provincia ?? '—'}</td>
                  <td>{p.contacto  ?? '—'}</td>
                  <td><span className="badge" style={ESTADO_ESTILO[p.estado] ?? ESTADO_ESTILO.Activo}>{p.estado}</span></td>
                  <td><button className="btn-editar" onClick={() => abrirEditar(p)}>Editar</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalAbierto && (
        <Modal titulo={esEdicion ? `Editar — ${form.nombre}` : 'Nuevo proveedor'} onCerrar={cerrar} ancho={620}>
          <div className="form-grid">
            {!esEdicion && (
              <div className="form-group span-2">
                <label>CUIT *</label>
                <input value={form.cuit} onChange={e => cambiar('cuit', e.target.value)}
                  className={errores.cuit ? 'error-campo' : ''} placeholder="Ej: 20-11111111-1" autoFocus />
                {errores.cuit && <span className="error-msg">{errores.cuit}</span>}
              </div>
            )}
            <div className="form-group span-2">
              <label>Nombre / Razón social *</label>
              <input value={form.nombre} onChange={e => cambiar('nombre', e.target.value)}
                className={errores.nombre ? 'error-campo' : ''} placeholder="Nombre del proveedor"
                autoFocus={esEdicion} />
              {errores.nombre && <span className="error-msg">{errores.nombre}</span>}
            </div>
            <div className="form-group">
              <label>Teléfono</label>
              <input value={form.telefono} onChange={e => cambiar('telefono', e.target.value)}
                placeholder="Ej: 388-4001234" />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input type="email" value={form.email} onChange={e => cambiar('email', e.target.value)}
                className={errores.email ? 'error-campo' : ''} placeholder="Ej: proveedor@mail.com" />
              {errores.email && <span className="error-msg">{errores.email}</span>}
            </div>
            <div className="form-group">
              <label>Provincia</label>
              <input value={form.provincia} onChange={e => cambiar('provincia', e.target.value)}
                placeholder="Ej: Jujuy" />
            </div>
            <div className="form-group">
              <label>Contacto</label>
              <input value={form.contacto} onChange={e => cambiar('contacto', e.target.value)}
                placeholder="Nombre del contacto" />
            </div>
            <div className="form-group span-2">
              <label>Dirección</label>
              <input value={form.direccion} onChange={e => cambiar('direccion', e.target.value)}
                placeholder="Ej: Av. Independencia 123" />
            </div>
            <div className="form-group">
              <label>CBU</label>
              <input value={form.cbu} onChange={e => cambiar('cbu', e.target.value)}
                placeholder="CBU para transferencias" />
            </div>
            <div className="form-group">
              <label>Estado</label>
              <select value={form.estado} onChange={e => cambiar('estado', e.target.value)}>
                <option value="Activo">Activo</option>
                <option value="Inactivo">Inactivo</option>
              </select>
            </div>
            <div className="form-group span-2">
              <label>Observaciones</label>
              <textarea value={form.observaciones} onChange={e => cambiar('observaciones', e.target.value)}
                rows={2} placeholder="Notas adicionales..." />
            </div>
          </div>
          {errorGuardado && <p className="error-msg" style={{ marginTop: 14 }}>Error: {errorGuardado}</p>}
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
