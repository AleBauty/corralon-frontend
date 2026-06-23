import { useState } from 'react';
import {
  Menu, X, LogOut,
  LayoutDashboard, ShoppingCart, FileText, Package,
  Users, Boxes, Truck, Navigation, BarChart2,
  CreditCard, Banknote, UserCheck, Clock,
} from 'lucide-react';
import Login           from './components/Login';
import Dashboard       from './components/Dashboard';
import Productos       from './components/Productos';
import Clientes        from './components/Clientes';
import Proveedores     from './components/Proveedores';
import Ventas          from './components/Ventas';
import Pedidos         from './components/Pedidos';
import Presupuestos    from './components/Presupuestos';
import Empleados       from './components/Empleados';
import Asistencias     from './components/Asistencias';
import Vehiculos       from './components/Vehiculos';
import CuentaCorriente from './components/CuentaCorriente';
import Reportes        from './components/Reportes';
import Egresos         from './components/Egresos';
import './App.css';

const TODAS_SECCIONES = [
  { id: 'dashboard',       label: 'Dashboard',       Icon: LayoutDashboard },
  { id: 'ventas',          label: 'Ventas',           Icon: ShoppingCart },
  { id: 'presupuestos',    label: 'Presupuestos',     Icon: FileText },
  { id: 'pedidos',         label: 'Pedidos',          Icon: Package },
  { id: 'clientes',        label: 'Clientes',         Icon: Users },
  { id: 'productos',       label: 'Productos',        Icon: Boxes },
  { id: 'proveedores',     label: 'Proveedores',      Icon: Truck },
  { id: 'vehiculos',       label: 'Logística',        Icon: Navigation },
  { id: 'reportes',        label: 'Reportes',         Icon: BarChart2 },
  { id: 'cuentaCorriente', label: 'Cta. Corriente',   Icon: CreditCard },
  { id: 'egresos',         label: 'Egresos',          Icon: Banknote },
  { id: 'empleados',       label: 'Empleados',        Icon: UserCheck },
  { id: 'asistencias',     label: 'Asistencias',      Icon: Clock },
];

const NAV_GRUPOS = [
  { grupo: 'Comercial',      ids: ['ventas', 'presupuestos', 'pedidos', 'clientes'] },
  { grupo: 'Inventario',     ids: ['productos', 'proveedores'] },
  { grupo: 'Logística',      ids: ['vehiculos'] },
  { grupo: 'Administración', ids: ['reportes', 'cuentaCorriente', 'egresos'] },
  { grupo: 'Personal',       ids: ['empleados', 'asistencias'] },
];

const SECCIONES_POR_ROL = {
  admin:            ['dashboard', 'ventas', 'presupuestos', 'pedidos', 'clientes', 'productos', 'proveedores', 'vehiculos', 'reportes', 'cuentaCorriente', 'egresos', 'empleados', 'asistencias'],
  vendedor:         ['ventas', 'clientes', 'asistencias', 'presupuestos', 'cuentaCorriente'],
  gerente_finanzas: ['ventas', 'reportes', 'cuentaCorriente', 'egresos', 'vehiculos'],
  logistica:        ['vehiculos', 'asistencias'],
};

const ETIQUETA_ROL = {
  admin:            'Administrador',
  vendedor:         'Vendedor',
  gerente_finanzas: 'Gerente Finanzas',
  logistica:        'Encargado Logística',
};

const MAPA_SECCIONES = Object.fromEntries(TODAS_SECCIONES.map(s => [s.id, s]));

function iniciales(nombre) {
  return nombre.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

function renderContenido(seccion) {
  switch (seccion) {
    case 'dashboard':       return <Dashboard />;
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
  const [sidebarAbierto, setSidebarAbierto] = useState(false);

  const handleLogin = data => {
    const permitidos = SECCIONES_POR_ROL[data.rol] ?? [];
    setSeccion(permitidos[0] ?? 'ventas');
    setUsuario(data);
  };

  const handleLogout = () => {
    sessionStorage.removeItem('usuario');
    setUsuario(null);
    setSidebarAbierto(false);
  };

  if (!usuario) return <Login onLogin={handleLogin} />;

  const permitidosSet  = new Set(SECCIONES_POR_ROL[usuario.rol] ?? []);
  const seccionVisible = permitidosSet.has(seccion) ? seccion : ([...permitidosSet][0] ?? 'ventas');
  const seccionInfo    = MAPA_SECCIONES[seccionVisible];

  const navegar = id => { setSeccion(id); setSidebarAbierto(false); };

  return (
    <div className="app-shell">

      {/* ── Header ── */}
      <header className="app-header">
        <button className="hamburger" onClick={() => setSidebarAbierto(true)} aria-label="Abrir menú">
          <Menu size={22} />
        </button>
        <div className="header-titulo">
          {seccionInfo && <seccionInfo.Icon size={20} strokeWidth={2} />}
          <span>{seccionInfo?.label ?? ''}</span>
        </div>
        <div className="header-usuario">
          <div className="header-usuario-info">
            <span className="header-usuario-nombre">{usuario.nombre}</span>
            <span className="header-usuario-rol">{ETIQUETA_ROL[usuario.rol] ?? usuario.rol}</span>
          </div>
          <div className="avatar">{iniciales(usuario.nombre)}</div>
        </div>
      </header>

      {/* ── Backdrop ── */}
      {sidebarAbierto && (
        <div className="sidebar-backdrop" onClick={() => setSidebarAbierto(false)} />
      )}

      {/* ── Sidebar panel ── */}
      <aside className={`sidebar-panel${sidebarAbierto ? ' sidebar-panel--abierto' : ''}`}>

        <div className="sidebar-top">
          <div className="sidebar-logo">
            <span className="sidebar-logo-icon">🧱</span>
            <div>
              <div className="sidebar-logo-nombre">Corralón</div>
              <div className="sidebar-logo-sub">Virgen de Punta Corral</div>
            </div>
          </div>
          <button className="sidebar-cerrar" onClick={() => setSidebarAbierto(false)} aria-label="Cerrar menú">
            <X size={20} />
          </button>
        </div>

        <nav className="sidebar-nav">
          {/* Dashboard (solo admin) */}
          {permitidosSet.has('dashboard') && (
            <button
              className={`sidebar-nav-item${seccionVisible === 'dashboard' ? ' activo' : ''}`}
              onClick={() => navegar('dashboard')}
            >
              <LayoutDashboard size={18} strokeWidth={2} />
              <span>Dashboard</span>
            </button>
          )}

          {/* Grupos temáticos */}
          {NAV_GRUPOS.map(({ grupo, ids }) => {
            const items = ids.filter(id => permitidosSet.has(id)).map(id => MAPA_SECCIONES[id]);
            if (!items.length) return null;
            return (
              <div key={grupo} className="sidebar-grupo">
                <span className="sidebar-grupo-label">{grupo}</span>
                {items.map(s => (
                  <button
                    key={s.id}
                    className={`sidebar-nav-item${seccionVisible === s.id ? ' activo' : ''}`}
                    onClick={() => navegar(s.id)}
                  >
                    <s.Icon size={18} strokeWidth={2} />
                    <span>{s.label}</span>
                  </button>
                ))}
              </div>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-footer-user">
            <div className="avatar">{iniciales(usuario.nombre)}</div>
            <div className="sidebar-footer-info">
              <span className="sidebar-footer-nombre">{usuario.nombre}</span>
              <span className="sidebar-footer-rol">{ETIQUETA_ROL[usuario.rol] ?? usuario.rol}</span>
            </div>
          </div>
          <button className="sidebar-logout" onClick={handleLogout} aria-label="Cerrar sesión">
            <LogOut size={18} strokeWidth={2} />
          </button>
        </div>
      </aside>

      {/* ── Contenido principal ── */}
      <main className="app-contenido">
        {renderContenido(seccionVisible)}
      </main>
    </div>
  );
}

export default App;
