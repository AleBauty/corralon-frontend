import { useEffect, useState } from 'react';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3000';

const ESTADO_ESTILO = {
  Activo:   { background: '#e6f9f0', color: '#1a8a4a' },
  Inactivo: { background: '#f0f0f0', color: '#666' },
};

export default function Proveedores() {
  const [proveedores, setProveedores] = useState([]);
  const [cargando, setCargando]       = useState(true);
  const [error, setError]             = useState(null);
  const [busqueda, setBusqueda]       = useState('');

  useEffect(() => {
    fetch(`${API}/api/proveedores`)
      .then(r => r.ok ? r.json() : Promise.reject(`Error ${r.status}`))
      .then(data => { setProveedores(data); setCargando(false); })
      .catch(err  => { setError(String(err)); setCargando(false); });
  }, []);

  const filtrados = proveedores.filter(p =>
    p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    p.cuit.includes(busqueda) ||
    (p.provincia ?? '').toLowerCase().includes(busqueda.toLowerCase())
  );

  if (cargando) return <p className="estado-carga">Cargando proveedores...</p>;
  if (error)    return <p className="estado-error">Error: {error}</p>;

  return (
    <div>
      <div className="seccion-header">
        <h2>Proveedores <span className="total-registros">{proveedores.length}</span></h2>
      </div>

      <input
        type="text"
        placeholder="Buscar por nombre, CUIT o provincia..."
        value={busqueda}
        onChange={e => setBusqueda(e.target.value)}
        className="buscador"
      />

      {filtrados.length === 0 ? (
        <p className="estado-carga">No se encontraron proveedores.</p>
      ) : (
        <div className="tabla-wrapper">
          <table>
            <thead>
              <tr>
                <th>CUIT</th>
                <th>Nombre</th>
                <th>Teléfono</th>
                <th>Email</th>
                <th>Provincia</th>
                <th>Contacto</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map(p => (
                <tr key={p.cuit}>
                  <td><code>{p.cuit}</code></td>
                  <td style={{ fontWeight: 500 }}>{p.nombre}</td>
                  <td>{p.telefono ?? '—'}</td>
                  <td>{p.email ?? '—'}</td>
                  <td>{p.provincia ?? '—'}</td>
                  <td>{p.contacto ?? '—'}</td>
                  <td>
                    <span
                      className="badge"
                      style={ESTADO_ESTILO[p.estado] ?? ESTADO_ESTILO.Activo}
                    >
                      {p.estado}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
