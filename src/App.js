import { useState } from 'react';
import Login          from './components/Login';
import Productos      from './components/Productos';
import Clientes       from './components/Clientes';
import Proveedores    from './components/Proveedores';
import Ventas         from './components/Ventas';
import Pedidos        from './components/Pedidos';
import Presupuestos   from './components/Presupuestos';
import Empleados      from './components/Empleados';
import Asistencias    from './components/Asistencias';
import Vehiculos      from './components/Vehiculos';
import CuentaCorriente from './components/CuentaCorriente';
import Reportes       from './components/Reportes';
import Egresos        from './components/Egresos';
import './App.css';

const TODAS_SECCIONES = [
  { id: 'productos',       label: 'Productos',      icono: '🧱' },
  { id: 'clientes',        label: 'Clientes',       icono: '👤' },
  { id: 'proveedores',     label: 'Proveedores',    icono: '🚛' },
  { id: 'ventas',          label: 'Ventas',         icono: '🧾' },
  { id: 'presupuestos',    label: 'Presupuestos',   icono: '📄' },
  { id: 'pedidos',         label: 'Pedidos',        icono: '📦' },
  { id: 'empleados',       label: 'Empleados',      icono: '👷' },
  { id: 'asistencias',     label: 'Asistencias',    icono: '🕐' },
  { id: 'vehiculos',       label: 'Logística',      icono: '🚚' },
  { id: 'cuentaCorriente', label: 'Cta. Corriente', icono: '💳' },
  { id: 'reportes',        label: 'Reportes',       icono: '📈' },
  { id: 'egresos',         label: 'Egresos',        icono: '💰' },
];

const SECCIONES_POR_ROL = {
  admin:            ['productos', 'clientes', 'proveedores', 'ventas', 'presupuestos', 'pedidos', 'empleados', 'asistencias', 'vehiculos', 'cuentaCorriente', 'reportes', 'egresos'],
  vendedor:         ['ventas', 'clientes', 'asistencias', 'presupuestos'],
  gerente_finanzas: ['ventas', 'reportes', 'cuentaCorriente', 'egresos'],
};

const ETIQUETA_ROL = {
  admin:            'Administrador',
  vendedor:         'Vendedor',
  gerente_finanzas: 'Gerente Finanzas',
};

function seccionesParaRol(rol) {
  const ids = SECCIONES_POR_ROL[rol] ?? [];
  return TODAS_SECCIONES.filter(s => ids.includes(s.id));
}

function renderContenido(seccion) {
  switch (seccion) {
    case 'productos':       return <Productos />;
    case 'clientes':        return <Clientes />;
    case 'proveedores':     return <Proveedores />;
    case 'ventas':          return <Ventas />;
    case 'presupuestos':    return <Presupuestos />;
    case 'pedidos':         return <Pedidos />;
    case 'empleados':       return <Empleados />;
    case 'asistencias':     return <Asistencias />;
    case 'vehiculos':       return <Vehiculos />;
    case 'cuentaCorriente': return <CuentaCorriente />;
    case 'reportes':        return <Reportes />;
    case 'egresos':         return <Egresos />;
    default:                return null;
  }
}

function App() {
  const [usuario, setUsuario] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('usuario')); }
    catch { return null; }
  });
  const [seccion, setSeccion] = useState('ventas');

  const handleLogin = data => {
    const primera = seccionesParaRol(data.rol)[0]?.id ?? 'ventas';
    setSeccion(primera);
    setUsuario(data);
  };

  const handleLogout = () => {
    sessionStorage.removeItem('usuario');
    setUsuario(null);
  };

  if (!usuario) return <Login onLogin={handleLogin} />;

  const secciones      = seccionesParaRol(usuario.rol);
  const seccionVisible = secciones.find(s => s.id === seccion) ? seccion : (secciones[0]?.id ?? 'ventas');

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <span className="sidebar-brick">🧱</span>
          <div className="sidebar-brand">
            <span className="sidebar-nombre">Corralón</span>
            <span className="sidebar-subtitulo">Virgen de Punta Corral</span>
          </div>
        </div>
        <div className="sidebar-divider" />

        {/* Info usuario */}
        <div style={{ padding: '8px 16px 12px', fontSize: 12 }}>
          <div style={{ fontWeight: 700, color: 'var(--texto)', fontSize: 13 }}>{usuario.nombre}</div>
          <div style={{ color: 'var(--texto-suave)', marginTop: 2 }}>{ETIQUETA_ROL[usuario.rol] ?? usuario.rol}</div>
        </div>
        <div className="sidebar-divider" />

        <nav>
          {secciones.map(s => (
            <button
              key={s.id}
              className={`nav-item ${seccionVisible === s.id ? 'activo' : ''}`}
              onClick={() => setSeccion(s.id)}
            >
              <span className="nav-icono">{s.icono}</span>
              <span className="nav-label">{s.label}</span>
            </button>
          ))}
        </nav>

        <div style={{ marginTop: 'auto' }}>
          <div className="sidebar-divider" />
          <button
            className="nav-item"
            onClick={handleLogout}
            style={{ width: '100%', color: '#ef4444' }}
          >
            <span className="nav-icono">🚪</span>
            <span className="nav-label">Cerrar sesión</span>
          </button>
          <div className="sidebar-footer"><span>Sistema de Gestión v1.0</span></div>
        </div>
      </aside>
      <main className="contenido">{renderContenido(seccionVisible)}</main>
    </div>
  );
}

export default App;
