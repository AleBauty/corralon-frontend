import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import Modal       from './Modal';
import Comprobante from './Comprobante';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3000';

const FORMAS_PAGO      = ['Efectivo', 'Tarjeta', 'Transferencia', 'Cuenta corriente'];
const FORMAS_ENTREGA   = ['Depósito', 'Domicilio'];
const TIPOS_CLIENTE    = ['Normal', 'Cuenta corriente', 'Empresa'];
const UNIDADES_ENTERAS = ['bolsas', 'unidades'];

const ESTADO_VENTA = {
  Activa:    { background: '#e6f9f0', color: '#1a8a4a' },
  Entregada: { background: '#eef2ff', color: '#3730a3' },
  Cancelada: { background: '#fff0f0', color: '#c0392b' },
};

function fmt(n)        { return parseFloat(n ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 2 }); }
function formatFecha(iso) {
  return new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const FORM_CLI_VACIO = { nombre_apellido: '', dni: '', telefono: '', tipo: 'Normal' };

export default function Ventas() {
  // ─── Lista ───
  const [ventas, setVentas]       = useState([]);
  const [cargando, setCargando]   = useState(true);
  const [error, setError]         = useState(null);
  const [expandida, setExpandida] = useState(null);
  const [detalle, setDetalle]     = useState({});

  // ─── Comprobante ───
  const [comprobante, setComprobante]                 = useState(null);
  const [cargandoComprobante, setCargandoComprobante] = useState(null);

  // ─── Modal nueva venta ───
  const [modalVenta, setModalVenta]         = useState(false);
  const [clientes, setClientes]             = useState([]);
  const [todosProductos, setTodosProductos] = useState([]);
  const [dniCliente, setDniCliente]         = useState('');
  const [formaEntrega, setFormaEntrega]     = useState('Depósito');
  const [direccionCalle, setDireccionCalle] = useState('');
  const [direccionNro, setDireccionNro]     = useState('');
  const [direccionCiudad, setDireccionCiudad] = useState('El Carmen');
  const [descuento, setDescuento]           = useState('');
  const [observaciones, setObservaciones]   = useState('');
  const [items, setItems]                   = useState([]);
  const [busquedaProd, setBusquedaProd]     = useState('');
  const [prodSel, setProdSel]               = useState(null);
  const [cantInput, setCantInput]           = useState('');
  const [guardando, setGuardando]           = useState(false);
  const [errorGuardado, setErrorGuardado]   = useState(null);
  const searchRef = useRef(null);

  // ─── Pago ───
  const [formaPago1, setFormaPago1]       = useState('Efectivo');
  const [montoPago1, setMontoPago1]       = useState('');
  const [usarDosFormas, setUsarDosFormas] = useState(false);
  const [formaPago2, setFormaPago2]       = useState('Transferencia');
  const [montoPago2, setMontoPago2]       = useState('');

  // ─── Info CC ───
  const [infoCC, setInfoCC] = useState(null);

  // ─── Modal nuevo cliente ───
  const [modalNuevoCli, setModalNuevoCli]     = useState(false);
  const [formCli, setFormCli]                 = useState(FORM_CLI_VACIO);
  const [guardandoCli, setGuardandoCli]       = useState(false);
  const [errCli, setErrCli]                   = useState(null);

  const cargarVentas = useCallback(() => {
    setCargando(true);
    fetch(`${API}/api/ventas`)
      .then(r => r.ok ? r.json() : Promise.reject(`Error ${r.status}`))
      .then(data => { setVentas(data); setCargando(false); })
      .catch(err  => { setError(String(err)); setCargando(false); });
  }, []);

  useEffect(() => { cargarVentas(); }, [cargarVentas]);

  useEffect(() => {
    const fn = e => { if (searchRef.current && !searchRef.current.contains(e.target)) setBusquedaProd(''); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  // Auto-completar dirección desde el domicilio del cliente
  useEffect(() => {
    if (!dniCliente) { setDireccionCalle(''); setDireccionNro(''); setDireccionCiudad('El Carmen'); return; }
    const cli = clientes.find(c => c.dni === dniCliente);
    if (cli?.domicilio) setDireccionCalle(cli.domicilio);
  }, [dniCliente, clientes]);

  // Fetch saldo CC
  useEffect(() => {
    const esCC = formaPago1 === 'Cuenta corriente' || (usarDosFormas && formaPago2 === 'Cuenta corriente');
    if (!dniCliente || !esCC) { setInfoCC(null); return; }
    const cli = clientes.find(c => c.dni === dniCliente);
    const limite = parseFloat(cli?.limite_credito ?? 50000);
    fetch(`${API}/api/cuenta-corriente/${dniCliente}/movimientos`)
      .then(r => r.json())
      .then(data => setInfoCC({ saldo: parseFloat(data.saldo ?? 0), limite }))
      .catch(() => setInfoCC(null));
  }, [dniCliente, formaPago1, formaPago2, usarDosFormas, clientes]);

  const subtotalVenta  = useMemo(() => items.reduce((acc, i) => acc + i.subtotal, 0), [items]);
  const descuentoPct   = parseFloat(descuento) || 0;
  const montoDescuento = subtotalVenta * descuentoPct / 100;
  const totalVenta     = subtotalVenta - montoDescuento;

  // Auto-fill montoPago1 con el total cuando es pago simple
  useEffect(() => {
    if (!usarDosFormas) {
      setMontoPago1(totalVenta > 0 ? totalVenta.toFixed(2) : '');
    }
  }, [totalVenta, usarDosFormas]);

  const productosFiltrados = useMemo(() => {
    const q = busquedaProd.trim().toLowerCase();
    if (!q || prodSel) return [];
    return todosProductos.filter(p => p.nombre.toLowerCase().includes(q) || p.codigo.toLowerCase().includes(q)).slice(0, 7);
  }, [busquedaProd, prodSel, todosProductos]);

  const stockEfectivo = prod => {
    const en = items.find(i => i.producto_codigo === prod.codigo);
    return parseFloat(prod.stock_actual) - (en ? parseFloat(en.cantidad) : 0);
  };

  const disponibleProdSel = prodSel ? stockEfectivo(prodSel) : 0;
  const umProdSel         = prodSel?.unidad_medida ?? 'unidades';
  const esEntero          = UNIDADES_ENTERAS.includes(umProdSel);
  const cantParseada      = esEntero ? parseInt(cantInput, 10) : parseFloat(cantInput);

  const errCantVivo = prodSel && cantInput
    ? (isNaN(cantParseada) || cantParseada <= 0)
      ? 'La cantidad debe ser mayor a 0'
      : esEntero && !Number.isInteger(parseFloat(cantInput))
        ? `${umProdSel} solo admite cantidades enteras`
        : cantParseada > disponibleProdSel
          ? `Stock insuficiente: disponible ${disponibleProdSel.toLocaleString('es-AR')}, solicitado ${cantParseada.toLocaleString('es-AR')}`
          : null
    : null;
  const puedeAgregarItem = Boolean(prodSel && cantInput && !errCantVivo);

  // Validaciones CC
  const esCC1      = formaPago1 === 'Cuenta corriente';
  const esCC2      = usarDosFormas && formaPago2 === 'Cuenta corriente';
  const requiereCC = esCC1 || esCC2;
  const errCC = requiereCC && !dniCliente
    ? 'Para pago en Cuenta Corriente debe seleccionar un cliente'
    : null;

  const mp1Num = parseFloat(montoPago1) || 0;
  const mp2Num = parseFloat(montoPago2) || 0;

  const montoCC = useMemo(() => {
    if (!requiereCC) return 0;
    if (!usarDosFormas) return totalVenta;
    return esCC1 ? mp1Num : mp2Num;
  }, [requiereCC, usarDosFormas, esCC1, mp1Num, mp2Num, totalVenta]);

  const excedeLimite = infoCC && montoCC > 0 && (infoCC.saldo + montoCC > infoCC.limite);

  const errSplit = usarDosFormas && items.length > 0 && totalVenta > 0
    ? Math.abs(mp1Num + mp2Num - totalVenta) > 0.01
      ? mp1Num + mp2Num < totalVenta
        ? `Faltan $${fmt(totalVenta - mp1Num - mp2Num)} para cubrir el total de $${fmt(totalVenta)}`
        : `Exceso de $${fmt(mp1Num + mp2Num - totalVenta)} sobre el total de $${fmt(totalVenta)}`
      : null
    : null;

  const errDireccion = formaEntrega === 'Domicilio' && !direccionCalle.trim()
    ? 'La calle de entrega es obligatoria'
    : null;

  const puedeGuardar = items.length > 0 && !errDireccion && !errCC && !errSplit && !excedeLimite
    && (!usarDosFormas || (mp1Num > 0 && mp2Num > 0))
    && (!usarDosFormas ? mp1Num > 0 : true);

  const abrirModal = () => {
    setModalVenta(true);
    if (!clientes.length)       fetch(`${API}/api/clientes`).then(r => r.json()).then(setClientes).catch(() => {});
    if (!todosProductos.length) fetch(`${API}/api/productos`).then(r => r.json()).then(setTodosProductos).catch(() => {});
  };

  const cerrarModal = () => {
    setModalVenta(false); setItems([]); setDniCliente('');
    setFormaPago1('Efectivo'); setUsarDosFormas(false); setFormaPago2('Transferencia');
    setMontoPago1(''); setMontoPago2('');
    setFormaEntrega('Depósito'); setDireccionCalle(''); setDireccionNro(''); setDireccionCiudad('El Carmen');
    setDescuento(''); setObservaciones('');
    setBusquedaProd(''); setProdSel(null); setCantInput(''); setErrorGuardado(null);
    setInfoCC(null);
  };

  const seleccionarProducto = p => { setProdSel(p); setBusquedaProd(p.nombre); setCantInput(''); };

  const agregarItem = () => {
    if (!puedeAgregarItem) return;
    const cant = cantParseada, precio = parseFloat(prodSel.precio_venta), subtotal = cant * precio;
    const yaExiste = items.find(i => i.producto_codigo === prodSel.codigo);
    if (yaExiste) {
      setItems(prev => prev.map(i => i.producto_codigo === prodSel.codigo
        ? { ...i, cantidad: parseFloat(i.cantidad) + cant, subtotal: (parseFloat(i.cantidad) + cant) * precio } : i));
    } else {
      setItems(prev => [...prev, { producto_codigo: prodSel.codigo, nombre: prodSel.nombre, cantidad: cant, precio_unitario: precio, subtotal, unidad_medida: umProdSel }]);
    }
    setProdSel(null); setBusquedaProd(''); setCantInput('');
  };

  const quitarItem = codigo => setItems(prev => prev.filter(i => i.producto_codigo !== codigo));

  const activarSegundaForma = (checked) => {
    setUsarDosFormas(checked);
    if (checked) {
      setMontoPago2((totalVenta - mp1Num > 0 ? totalVenta - mp1Num : 0).toFixed(2));
    } else {
      setMontoPago2('');
      setMontoPago1(totalVenta > 0 ? totalVenta.toFixed(2) : '');
    }
  };

  const guardarVenta = async () => {
    if (!puedeGuardar) return;
    setGuardando(true); setErrorGuardado(null);
    try {
      const body = {
        dni_cliente:       dniCliente || null,
        forma_entrega:     formaEntrega,
        direccion_calle:   formaEntrega === 'Domicilio' ? direccionCalle.trim() : null,
        direccion_nro:     formaEntrega === 'Domicilio' ? direccionNro.trim() || null : null,
        direccion_ciudad:  formaEntrega === 'Domicilio' ? (direccionCiudad.trim() || 'El Carmen') : null,
        descuento:         descuentoPct || null,
        observaciones:     observaciones.trim() || null,
        items:             items.map(i => ({ producto_codigo: i.producto_codigo, cantidad: i.cantidad, precio_unitario: i.precio_unitario })),
        forma_pago_1:      formaPago1,
        monto_pago_1:      usarDosFormas ? mp1Num : totalVenta,
        forma_pago_2:      usarDosFormas ? formaPago2 : null,
        monto_pago_2:      usarDosFormas ? mp2Num    : null,
      };
      const res  = await fetch(`${API}/api/ventas`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
      cerrarModal(); cargarVentas();
    } catch (err) { setErrorGuardado(err.message); }
    finally      { setGuardando(false); }
  };

  // ─── Nuevo cliente desde venta ───
  const abrirNuevoCli = () => {
    setFormCli(FORM_CLI_VACIO); setErrCli(null); setModalNuevoCli(true);
  };

  const guardarNuevoCli = async () => {
    if (!formCli.nombre_apellido.trim()) { setErrCli('El nombre es obligatorio'); return; }
    if (!formCli.dni.trim())             { setErrCli('El DNI es obligatorio'); return; }
    setGuardandoCli(true); setErrCli(null);
    try {
      const res  = await fetch(`${API}/api/clientes`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dni: formCli.dni, nombre_apellido: formCli.nombre_apellido, telefono: formCli.telefono || null, tipo: formCli.tipo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
      setClientes(prev => [...prev, data].sort((a, b) => a.nombre_apellido.localeCompare(b.nombre_apellido)));
      setDniCliente(data.dni);
      setModalNuevoCli(false);
    } catch (err) { setErrCli(err.message); }
    finally      { setGuardandoCli(false); }
  };

  const verComprobante = async id => {
    setCargandoComprobante(id);
    try {
      const data = await fetch(`${API}/api/ventas/${id}`).then(r => r.json());
      setComprobante(data);
    } catch { alert('Error al cargar el comprobante'); }
    finally { setCargandoComprobante(null); }
  };

  const toggleDetalle = async id => {
    if (expandida === id) { setExpandida(null); return; }
    setExpandida(id);
    if (detalle[id]) return;
    try {
      const data = await fetch(`${API}/api/ventas/${id}`).then(r => r.json());
      setDetalle(d => ({ ...d, [id]: data.items ?? [] }));
    } catch { setDetalle(d => ({ ...d, [id]: [] })); }
  };

  const totalGeneral = ventas.filter(v => v.estado !== 'Cancelada').reduce((acc, v) => acc + parseFloat(v.total || 0), 0);

  if (cargando) return <p className="estado-carga">Cargando ventas...</p>;
  if (error)    return <p className="estado-error">Error: {error}</p>;

  return (
    <div>
      <div className="seccion-header">
        <h2>Ventas <span className="total-registros">{ventas.length}</span></h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span className="total-monto">Total facturado: <strong>${fmt(totalGeneral)}</strong></span>
          <button className="btn-nuevo" onClick={abrirModal}>+ Nueva venta</button>
        </div>
      </div>

      {ventas.length === 0 ? <p className="estado-carga">No hay ventas registradas.</p> : (
        <div className="tabla-wrapper">
          <table>
            <thead><tr>
              <th>#</th><th>Fecha</th><th>Cliente</th><th>Forma de pago</th>
              <th>Entrega</th><th style={{ textAlign: 'right' }}>Total</th><th>Estado</th><th></th>
            </tr></thead>
            <tbody>
              {ventas.map(v => (
                <React.Fragment key={v.id}>
                  <tr>
                    <td style={{ color: '#aaa', fontSize: 12 }}>#{v.id}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{formatFecha(v.fecha)}</td>
                    <td style={{ fontWeight: 500 }}>{v.cliente ?? 'Consumidor final'}</td>
                    <td>
                      {v.forma_pago ?? '—'}
                      {v.forma_pago_2 && (
                        <span style={{ display: 'block', fontSize: 11, color: '#888' }}>
                          + {v.forma_pago_2} ${fmt(v.monto_pago_2)}
                        </span>
                      )}
                    </td>
                    <td>
                      {v.forma_entrega ?? '—'}
                      {v.forma_entrega === 'Domicilio' && v.direccion_entrega && (
                        <span style={{ display: 'block', fontSize: 11, color: '#888' }}>📍 {v.direccion_entrega}</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>${fmt(v.total)}</td>
                    <td><span className="badge" style={ESTADO_VENTA[v.estado] ?? ESTADO_VENTA.Activa}>{v.estado}</span></td>
                    <td style={{ display: 'flex', gap: 6, flexWrap: 'nowrap' }}>
                      <button className="btn-editar" onClick={() => toggleDetalle(v.id)}>{expandida === v.id ? 'Ocultar' : 'Items'}</button>
                      <button className="btn-editar" style={{ background: '#f0f4ff', color: '#3730a3', borderColor: 'rgba(55,48,163,0.25)' }}
                        onClick={() => verComprobante(v.id)} disabled={cargandoComprobante === v.id}>
                        {cargandoComprobante === v.id ? '...' : '🧾'}
                      </button>
                    </td>
                  </tr>
                  {expandida === v.id && (
                    <tr><td colSpan={8} style={{ background: '#f7f8fa', padding: '0 24px 12px' }}>
                      {!detalle[v.id] ? <p style={{ color: '#999', padding: '8px 0' }}>Cargando...</p>
                        : detalle[v.id].length === 0 ? <p style={{ color: '#999', padding: '8px 0' }}>Sin items.</p>
                        : <table className="tabla-items">
                            <thead><tr><th>Producto</th><th style={{ textAlign: 'right' }}>Cant.</th><th style={{ textAlign: 'right' }}>Precio unit.</th><th style={{ textAlign: 'right' }}>Subtotal</th></tr></thead>
                            <tbody>{detalle[v.id].map(item => (
                              <tr key={item.id}>
                                <td>{item.producto ?? item.producto_codigo}</td>
                                <td style={{ textAlign: 'right' }}>{parseFloat(item.cantidad).toLocaleString('es-AR')}</td>
                                <td style={{ textAlign: 'right' }}>${fmt(item.precio_unitario)}</td>
                                <td style={{ textAlign: 'right', fontWeight: 600 }}>${fmt(item.subtotal)}</td>
                              </tr>
                            ))}</tbody>
                          </table>}
                    </td></tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ─── Modal nueva venta ─── */}
      {modalVenta && (
        <Modal titulo="Nueva venta" onCerrar={cerrarModal} ancho={700}>

          {/* Cliente */}
          <p className="form-section-titulo">Cliente</p>
          <div className="form-group">
            <label>Seleccionar cliente</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <select value={dniCliente} onChange={e => setDniCliente(e.target.value)} style={{ flex: 1 }}>
                <option value="">— Consumidor final —</option>
                {clientes.map(c => <option key={c.dni} value={c.dni}>{c.nombre_apellido} ({c.dni})</option>)}
              </select>
              <button type="button" className="btn btn-secundario" style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                onClick={abrirNuevoCli}>
                + Nuevo cliente
              </button>
            </div>
          </div>

          {/* Búsqueda de producto */}
          <p className="form-section-titulo">Agregar productos</p>
          <div className="search-container" ref={searchRef}>
            <input className="buscador" style={{ maxWidth: '100%', marginBottom: 0 }}
              placeholder="🔍  Buscar por nombre o código..." value={busquedaProd}
              onChange={e => { setBusquedaProd(e.target.value); setProdSel(null); }} autoComplete="off" />
            {productosFiltrados.length > 0 && (
              <div className="search-resultados">
                {productosFiltrados.map(p => {
                  const stock = parseFloat(p.stock_actual), sinStock = stock <= 0;
                  return (
                    <div key={p.codigo} className={`search-result-item ${sinStock ? 'search-result-sin-stock' : ''}`}
                      onMouseDown={() => seleccionarProducto(p)}>
                      <span className="search-result-nombre">
                        {p.nombre}
                        <span style={{ fontSize: 11, color: 'var(--texto-suave)', marginLeft: 6 }}>
                          ({p.unidad_medida ?? 'unidades'})
                        </span>
                        <span className={`search-result-stock-inline ${stock <= parseFloat(p.stock_minimo) ? 'stock-bajo' : ''}`}>
                          — Stock: {stock.toLocaleString('es-AR')}{sinStock && ' ⚠ Sin stock'}
                        </span>
                      </span>
                      <span className="search-result-codigo"><code>{p.codigo}</code></span>
                      <span className="search-result-precio">${fmt(p.precio_venta)}</span>
                    </div>
                  );
                })}
              </div>
            )}
            {busquedaProd.trim() && !prodSel && productosFiltrados.length === 0 && (
              <div className="search-resultados"><p className="search-sin-resultados">Sin resultados para "{busquedaProd}"</p></div>
            )}
          </div>

          {/* Card producto seleccionado */}
          {prodSel && (
            <div className="prod-seleccionado-card">
              <div className="prod-sel-info">
                <span className="prod-sel-nombre">{prodSel.nombre}</span>
                <span className="prod-sel-stock">
                  Stock disponible: <strong style={{ color: disponibleProdSel <= 0 ? 'var(--rojo)' : disponibleProdSel <= parseFloat(prodSel.stock_minimo) ? 'var(--amarillo)' : 'var(--verde)' }}>
                    {disponibleProdSel.toLocaleString('es-AR')} {umProdSel}
                  </strong>
                  {' — '}Precio: ${fmt(prodSel.precio_venta)}
                </span>
              </div>
              <div className="prod-sel-controles">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--texto-suave)', marginBottom: 0 }}>
                    Cantidad ({umProdSel})
                  </label>
                  <input
                    type="number"
                    placeholder={esEntero ? '0' : '0.00'}
                    value={cantInput}
                    onChange={e => setCantInput(e.target.value)}
                    className={errCantVivo ? 'error-campo' : ''}
                    min={esEntero ? '1' : '0.01'}
                    step={esEntero ? '1' : '0.01'}
                    autoFocus
                    style={{ width: 110 }}
                    onKeyDown={e => { if (e.key === 'Enter') agregarItem(); }}
                  />
                </div>
                <button className="btn btn-primary" onClick={agregarItem} disabled={!puedeAgregarItem} type="button" style={{ alignSelf: 'flex-end' }}>Agregar</button>
                <button className="btn btn-secundario" onClick={() => { setProdSel(null); setBusquedaProd(''); }} type="button" style={{ alignSelf: 'flex-end' }}>✕</button>
              </div>
              {errCantVivo && <span className="error-msg" style={{ width: '100%' }}>{errCantVivo}</span>}
            </div>
          )}

          {/* Items de la venta */}
          {items.length > 0 && (
            <>
              <p className="form-section-titulo">Items de la venta</p>
              <div className="venta-items-lista">
                <table>
                  <thead><tr><th>Producto</th><th style={{ textAlign: 'right' }}>Cantidad</th><th style={{ textAlign: 'right' }}>Precio unit.</th><th style={{ textAlign: 'right' }}>Subtotal</th><th></th></tr></thead>
                  <tbody>
                    {items.map(i => (
                      <tr key={i.producto_codigo}>
                        <td style={{ fontWeight: 500 }}>{i.nombre}</td>
                        <td style={{ textAlign: 'right' }}>
                          {i.cantidad.toLocaleString('es-AR')}
                          {i.unidad_medida && <span style={{ fontSize: 11, color: 'var(--texto-suave)', marginLeft: 4 }}>{i.unidad_medida}</span>}
                        </td>
                        <td style={{ textAlign: 'right' }}>${fmt(i.precio_unitario)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>${fmt(i.subtotal)}</td>
                        <td><button className="btn-quitar" onClick={() => quitarItem(i.producto_codigo)}>✕</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Descuento y totales */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'flex-end', marginTop: 8 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--texto-suave)' }}>Descuento (%)</label>
                <input type="number" min="0" max="100" step="0.5" value={descuento}
                  onChange={e => setDescuento(e.target.value)}
                  placeholder="0" style={{ width: 70, textAlign: 'right' }} />
              </div>
              <div className="venta-total-box" style={{ flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                {descuentoPct > 0 && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: 13, color: 'var(--texto-suave)' }}>
                      <span>Subtotal</span><span>${fmt(subtotalVenta)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: 13, color: 'var(--rojo)' }}>
                      <span>Descuento ({descuentoPct}%)</span><span>−${fmt(montoDescuento)}</span>
                    </div>
                  </>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                  <span className="venta-total-label">Total de la venta</span>
                  <span className="venta-total-monto">${fmt(totalVenta)}</span>
                </div>
              </div>
            </>
          )}

          {/* Pago y entrega */}
          <p className="form-section-titulo">Pago y entrega</p>
          <div className="form-grid">

            {/* Forma de pago 1 */}
            <div className="form-group">
              <label>Forma de pago</label>
              <select value={formaPago1}
                onChange={e => { setFormaPago1(e.target.value); setUsarDosFormas(false); setMontoPago2(''); }}>
                {FORMAS_PAGO.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>

            {/* Monto pago 1 — siempre visible */}
            <div className="form-group">
              <label>Monto — {formaPago1}</label>
              <input type="number" min="0.01" step="0.01" value={montoPago1}
                onChange={e => setMontoPago1(e.target.value)}
                placeholder={totalVenta > 0 ? `$${fmt(totalVenta)}` : '$0.00'} />
            </div>

            {/* Forma de entrega */}
            <div className="form-group">
              <label>Forma de entrega</label>
              <select value={formaEntrega}
                onChange={e => { setFormaEntrega(e.target.value); if (e.target.value !== 'Domicilio') { setDireccionCalle(''); setDireccionNro(''); setDireccionCiudad('El Carmen'); } }}>
                {FORMAS_ENTREGA.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>

            {/* Checkbox segunda forma */}
            <div className="form-group" style={{ display: 'flex', alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 400, marginTop: 20 }}>
                <input type="checkbox" checked={usarDosFormas}
                  onChange={e => activarSegundaForma(e.target.checked)} />
                Agregar segunda forma de pago
              </label>
            </div>

            {/* Segunda forma de pago */}
            {usarDosFormas && (
              <>
                <div className="form-group">
                  <label>Segunda forma de pago</label>
                  <select value={formaPago2} onChange={e => setFormaPago2(e.target.value)}>
                    {FORMAS_PAGO.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Monto — {formaPago2}</label>
                  <input type="number" min="0.01" step="0.01" value={montoPago2}
                    onChange={e => setMontoPago2(e.target.value)} placeholder="$0.00" />
                </div>
                {items.length > 0 && (
                  <div className="form-group span-2">
                    <p style={{ fontSize: 13, color: 'var(--texto-suave)', margin: 0 }}>
                      Total: <strong style={{ color: 'var(--texto)' }}>${fmt(totalVenta)}</strong>
                      {' · '}Asignado: <strong>${fmt(mp1Num + mp2Num)}</strong>
                      {Math.abs(mp1Num + mp2Num - totalVenta) <= 0.01 && (
                        <span style={{ color: 'var(--verde)', marginLeft: 8 }}>✓ Cubierto</span>
                      )}
                    </p>
                  </div>
                )}
              </>
            )}

            {/* Dirección de entrega — campos separados */}
            {formaEntrega === 'Domicilio' && (
              <>
                <div className="form-group">
                  <label>Calle *</label>
                  <input value={direccionCalle} onChange={e => setDireccionCalle(e.target.value)}
                    className={errDireccion ? 'error-campo' : ''}
                    placeholder="Ej: Av. Independencia" />
                  {errDireccion && <span className="error-msg">{errDireccion}</span>}
                </div>
                <div className="form-group">
                  <label>Número</label>
                  <input value={direccionNro} onChange={e => setDireccionNro(e.target.value)}
                    placeholder="Ej: 350" />
                </div>
                <div className="form-group span-2">
                  <label>Ciudad</label>
                  <input list="ciudades-jujuy" value={direccionCiudad} onChange={e => setDireccionCiudad(e.target.value)}
                    placeholder="Ej: El Carmen" />
                  <datalist id="ciudades-jujuy">
                    <option value="El Carmen" />
                    <option value="San Salvador de Jujuy" />
                    <option value="Palpalá" />
                    <option value="Perico" />
                  </datalist>
                </div>
              </>
            )}

            <div className="form-group span-2">
              <label>Observaciones</label>
              <textarea value={observaciones} onChange={e => setObservaciones(e.target.value)} rows={2} placeholder="Notas opcionales..." />
            </div>
          </div>

          {errCC    && <p className="error-msg" style={{ marginTop: 8 }}>{errCC}</p>}
          {errSplit && <p className="error-msg" style={{ marginTop: 8 }}>{errSplit}</p>}

          {infoCC && (
            <div style={{
              background: excedeLimite ? 'var(--rojo-fondo)' : 'var(--verde-fondo)',
              border: `1px solid ${excedeLimite ? 'rgba(231,76,60,0.25)' : 'rgba(39,174,96,0.25)'}`,
              borderRadius: 'var(--radio-sm)', padding: '10px 14px', marginTop: 12,
            }}>
              <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', fontSize: 13 }}>
                <span>Deuda actual: <strong style={{ color: 'var(--rojo)' }}>${fmt(infoCC.saldo)}</strong></span>
                <span>Límite: <strong>${fmt(infoCC.limite)}</strong></span>
                <span style={{ color: excedeLimite ? 'var(--rojo)' : 'var(--verde)' }}>
                  Disponible: <strong>${fmt(Math.max(0, infoCC.limite - infoCC.saldo))}</strong>
                </span>
              </div>
              {excedeLimite && (
                <p style={{ color: 'var(--rojo)', fontWeight: 700, marginTop: 6, fontSize: 13 }}>
                  ⚠ Esta compra (${fmt(montoCC)}) excedería el límite.
                </p>
              )}
            </div>
          )}

          {errorGuardado && (
            <div style={{ background: 'var(--rojo-fondo)', border: '1px solid rgba(231,76,60,0.25)', borderRadius: 'var(--radio-sm)', padding: '10px 14px', marginTop: 14 }}>
              <p style={{ color: 'var(--rojo)', fontWeight: 600, margin: 0 }}>Error: {errorGuardado}</p>
            </div>
          )}

          <div className="modal-footer">
            <button className="btn btn-secundario" onClick={cerrarModal} type="button">Cancelar</button>
            <button className="btn btn-primary" onClick={guardarVenta} disabled={!puedeGuardar || guardando} type="button">
              {guardando ? 'Registrando...' : `Registrar venta${items.length ? ` — $${fmt(totalVenta)}` : ''}`}
            </button>
          </div>
        </Modal>
      )}

      {/* ─── Mini-modal nuevo cliente ─── */}
      {modalNuevoCli && (
        <Modal titulo="Nuevo cliente" onCerrar={() => setModalNuevoCli(false)} ancho={460}>
          <div className="form-grid">
            <div className="form-group span-2">
              <label>Nombre y apellido *</label>
              <input value={formCli.nombre_apellido}
                onChange={e => setFormCli(f => ({ ...f, nombre_apellido: e.target.value }))}
                placeholder="Nombre completo" autoFocus />
            </div>
            <div className="form-group">
              <label>DNI / CUIT *</label>
              <input value={formCli.dni}
                onChange={e => setFormCli(f => ({ ...f, dni: e.target.value }))}
                placeholder="Ej: 30123456" />
            </div>
            <div className="form-group">
              <label>Teléfono</label>
              <input value={formCli.telefono}
                onChange={e => setFormCli(f => ({ ...f, telefono: e.target.value }))}
                placeholder="Ej: 3884123456" />
            </div>
            <div className="form-group span-2">
              <label>Tipo</label>
              <select value={formCli.tipo} onChange={e => setFormCli(f => ({ ...f, tipo: e.target.value }))}>
                {TIPOS_CLIENTE.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          {errCli && <p className="error-msg" style={{ marginTop: 14 }}>{errCli}</p>}
          <div className="modal-footer">
            <button className="btn btn-secundario" type="button" onClick={() => setModalNuevoCli(false)}>Cancelar</button>
            <button className="btn btn-primary" type="button" onClick={guardarNuevoCli} disabled={guardandoCli}>
              {guardandoCli ? 'Guardando...' : 'Crear cliente'}
            </button>
          </div>
        </Modal>
      )}

      {comprobante && <Comprobante datos={comprobante} tipo="venta" onCerrar={() => setComprobante(null)} />}
    </div>
  );
}
