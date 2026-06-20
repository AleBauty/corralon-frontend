import { useState } from 'react';
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
import './App.css';

const SECCIONES = [
  { id: 'productos',        label: 'Productos',        icono: '🧱' },
  { id: 'clientes',         label: 'Clientes',         icono: '👤' },
  { id: 'proveedores',      label: 'Proveedores',      icono: '🚛' },
  { id: 'ventas',           label: 'Ventas',           icono: '🧾' },
  { id: 'presupuestos',     label: 'Presupuestos',     icono: '📄' },
  { id: 'pedidos',          label: 'Pedidos',          icono: '📦' },
  { id: 'empleados',        label: 'Empleados',        icono: '👷' },
  { id: 'asistencias',      label: 'Asistencias',      icono: '🕐' },
  { id: 'vehiculos',        label: 'Logística',        icono: '🚚' },
  { id: 'cuentaCorriente',  label: 'Cta. Corriente',  icono: '💳' },
  { id: 'reportes',         label: 'Reportes',         icono: '📈' },
];

function App() {
  const [seccion, setSeccion] = useState('productos');

  const renderContenido = () => {
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
      default:                return null;
    }
  };

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
        <nav>
          {SECCIONES.map(s => (
            <button key={s.id} className={`nav-item ${seccion === s.id ? 'activo' : ''}`} onClick={() => setSeccion(s.id)}>
              <span className="nav-icono">{s.icono}</span>
              <span className="nav-label">{s.label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-footer"><span>Sistema de Gestión v1.0</span></div>
      </aside>
      <main className="contenido">{renderContenido()}</main>
    </div>
  );
}

export default App;
