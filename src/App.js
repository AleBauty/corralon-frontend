import { useState, useEffect } from 'react';
import {
  Menu, X, LogOut,
  LayoutDashboard, ShoppingCart, FileText, Package,
  Users, Boxes, Truck, Navigation, BarChart2,
  CreditCard, Banknote, UserCheck, Clock, Lock, Bell,
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
import CierreCaja      from './components/CierreCaja';
import './App.css';

const API = process.env.REACT_APP_API_URL ?? 'https://corralon-backend-production.up.railway.app';

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
  { id: 'cierreCaja',      label: 'Cierre de Caja',   Icon: Lock },
];

const NAV_GRUPOS = [
  { grupo: 'Comercial',      ids: ['ventas', 'presupuestos', 'pedidos', 'clientes'] },
  { grupo: 'Inventario',     ids: ['productos', 'proveedores'] },
  { grupo: 'Logística',      ids: ['vehiculos'] },
  { grupo: 'Administración', ids: ['reportes', 'cuentaCorriente', 'egresos', 'cierreCaja'] },
  { grupo: 'Personal',       ids: ['empleados', 'asistencias'] },
];

const SECCIONES_POR_ROL = {
  admin:            ['dashboard', 'ventas', 'presupuestos', 'pedidos', 'clientes', 'productos', 'proveedores', 'vehiculos', 'reportes', 'cuentaCorriente', 'egresos', 'empleados', 'asistencias', 'cierreCaja'],
  vendedor:         ['ventas', 'clientes', 'asistencias', 'presupuestos', 'cuentaCorriente'],
  gerente_finanzas: ['ventas', 'reportes', 'cuentaCorriente', 'egresos', 'vehiculos', 'cierreCaja'],
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
    case 'cierreCaja':      return <CierreCaja />;
    default:                return null;
  }
}

function StockBadge({ onClick }) {
  const [alertas, setAlertas] = useState([]);
  const [open, setOpen]       = useState(false);

  useEffect(() => {
    fetch(`${API}/api/reportes/stock-alertas`)
      .then(r => r.json())
      .then(d => setAlertas(Array.isArray(d) ? d : []))
      .catch(() => {});
    const t = setInterval(() => {
      fetch(`${API}/api/reportes/stock-alertas`)
        .then(r => r.json())
        .then(d => setAlertas(Array.isArray(d) ? d : []))
        .catch(() => {});
    }, 120000);
    return () => clearInterval(t);
  }, []);

  if (!alertas.length) return null;

  const bajos   = alertas.filter(a => a.nivel_alerta === 'bajo');
  const proximos = alertas.filter(a => a.nivel_alerta === 'proximo');

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          position: 'relative', background: 'none', border: 'none',
          cursor: 'pointer', color: bajos.length ? '#dc2626' : '#d97706',
          padding: '4px 6px', borderRadius: 6,
          display: 'flex', alignItems: 'center', gap: 4,
        }}
        title="Alertas de stock"
      >
        <Bell size={20} />
        <span style={{
          position: 'absolute', top: 0, right: 0,
          background: bajos.length ? '#dc2626' : '#d97706',
          color: '#fff', fontSize: 10, fontWeight: 700,
          borderRadius: 999, padding: '1px 5px', lineHeight: 1.4,
        }}>
          {alertas.length}
        </span>
      </button>

      {open && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 999 }}
            onClick={() => setOpen(false)}
          />
          <div style={{
            position: 'absolute', right: 0, top: '100%', zIndex: 1000,
            background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10,
            boxShadow: '0 4px 16px rgba(0,0,0,.12)', width: 300, maxHeight: 400,
            overflowY: 'auto', padding: '8px 0',
          }}>
            {bajos.length > 0 && (
              <>
                <div style={{ padding: '4px 14px', fontSize: 11, fontWeight: 700, color: '#dc2626', textTransform: 'uppercase', letterSpacing: '.05em' }}>
                  🔴 Bajo stock ({bajos.length})
                </div>
                {bajos.map(p => (
                  <div key={p.codigo} style={{ padding: '5px 14px', fontSize: 13, borderBottom: '1px solid #f3f4f6' }}>
                    <strong>{p.nombre}</strong>
                    <span style={{ float: 'right', color: '#dc2626' }}>{p.stock_actual} / {p.stock_minimo}</span>
                  </div>
                ))}
              </>
            )}
            {proximos.length > 0 && (
              <>
                <div style={{ padding: '4px 14px', fontSize: 11, fontWeight: 700, color: '#d97706', textTransform: 'uppercase', letterSpacing: '.05em', marginTop: 4 }}>
                  ⚠ Próximo a mínimo ({proximos.length})
                </div>
                {proximos.map(p => (
                  <div key={p.codigo} style={{ padding: '5px 14px', fontSize: 13, borderBottom: '1px solid #f3f4f6' }}>
                    <strong>{p.nombre}</strong>
                    <span style={{ float: 'right', color: '#d97706' }}>{p.stock_actual} / {p.stock_minimo}</span>
                  </div>
                ))}
              </>
            )}
            <div style={{ padding: '8px 14px 4px', textAlign: 'center' }}>
              <button
                onClick={() => { setOpen(false); onClick && onClick('productos'); }}
                style={{ fontSize: 12, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                Ver productos →
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
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
        <div className="header-usuario" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {(usuario.rol === 'admin' || usuario.rol === 'gerente_finanzas') && (
            <StockBadge onClick={navegar} />
          )}
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
          {permitidosSet.has('dashboard') && (
            <button
              className={`sidebar-nav-item${seccionVisible === 'dashboard' ? ' activo' : ''}`}
              onClick={() => navegar('dashboard')}
            >
              <LayoutDashboard size={18} strokeWidth={2} />
              <span>Dashboard</span>
            </button>
          )}

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
