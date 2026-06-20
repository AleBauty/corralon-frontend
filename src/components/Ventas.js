import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import Modal       from './Modal';
import Comprobante from './Comprobante';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3000';

const FORMAS_PAGO    = ['Efectivo', 'Tarjeta', 'Transferencia', 'Cuenta corriente'];
const FORMAS_ENTREGA = ['Depósito', 'Domicilio'];

const ESTADO_VENTA = {
  Activa:    { background: '#e6f9f0', color: '#1a8a4a' },
  Entregada: { background: '#eef2ff', color: '#3730a3' },
  Cancelada: { background: '#fff0f0', color: '#c0392b' },
};

function fmt(n)        { return parseFloat(n ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 2 }); }
function formatFecha(iso) {
  return new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

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
  const [direccionEntrega, setDireccionEntrega] = useState('');
  const [observaciones, setObservaciones]   = useState('');
  const [items, setItems]                   = useState([]);
  const [busquedaProd, setBusquedaProd]     = useState('');
  const [prodSel, setProdSel]               = useState(null);
  const [cantInput, setCantInput]           = useState('');
  const [guardando, setGuardando]           = useState(false);
  const [errorGuardado, setErrorGuardado]   = useState(null);
  const searchRef = useRef(null);

  // ─── Pago (dual) ───
  const [formaPago1, setFormaPago1]       = useState('Efectivo');
  const [usarDosFormas, setUsarDosFormas] = useState(false);
  const [formaPago2, setFormaPago2]       = useState('Efectivo');
  const [montoPago1, setMontoPago1]       = useState('');
  const [montoPago2, setMontoPago2]       = useState('');

  // ─── Info CC en tiempo real ───
  const [infoCC, setInfoCC]   = useState(null);

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

  // Auto-completar dirección cuando cambia el cliente
  useEffect(() => {
    if (!dniCliente) { setDireccionEntrega(''); return; }
    const cli = clientes.find(c => c.dni === dniCliente);
    if (cli?.domicilio) setDireccionEntrega(cli.domicilio);
  }, [dniCliente, clientes]);

  // Fetch saldo CC cuando se selecciona cliente + forma CC
  useEffect(() => {
    const esCC = formaPago1 === 'Cuenta corriente' || (usarDosFormas && formaPago2 === 'Cuenta corriente');
    if (!dniCliente || !esCC) { setInfoCC(null); return; }
    const cli   = clientes.find(c => c.dni === dniCliente);
    const limite = parseFloat(cli?.limite_credito ?? 50000);
    fetch(`${API}/api/cuenta-corriente/${dniCliente}/movimientos`)
      .then(r => r.json())
      .then(data => setInfoCC({ saldo: parseFloat(data.saldo ?? 0), limite }))
      .catch(() => setInfoCC(null));
  }, [dniCliente, formaPago1, formaPago2, usarDosFormas, clientes]);

  const productosFiltrados = useMemo(() => {
    const q = busquedaProd.trim().toLowerCase();
    if (!q || prodSel) return [];
    return todosProductos.filter(p => p.nombre.toLowerCase().includes(q) || p.codigo.toLowerCase().includes(q)).slice(0, 7);
  }, [busquedaProd, prodSel, todosProductos]);

  const stockEfectivo = prod => {
    const en = items.find(i => i.producto_codigo === prod.codigo);
    return parseFloat(prod.stock_actual) - (en ? parseFloat(en.cantidad) : 0);
  };

  const totalVenta = useMemo(() => items.reduce((acc, i) => acc + i.subtotal, 0), [items]);

  const disponibleProdSel = prodSel ? stockEfectivo(prodSel) : 0;
  const cantParseada      = parseFloat(cantInput);
  const errCantVivo = prodSel && cantInput
    ? (isNaN(cantParseada) || cantParseada <= 0)
      ? 'La cantidad debe ser mayor a 0'
      : cantParseada > disponibleProdSel
        ? `Stock insuficiente: disponible ${disponibleProdSel.toLocaleString('es-AR')}, solicitado ${cantParseada.toLocaleString('es-AR')}`
        : null
    : null;
  const puedeAgregarItem = Boolean(prodSel && cantInput && !errCantVivo);

  // Validaciones de CC
  const esCC1     = formaPago1 === 'Cuenta corriente';
  const esCC2     = usarDosFormas && formaPago2 === 'Cuenta corriente';
  const requiereCC = esCC1 || esCC2;
  const errCC = requiereCC && !dniCliente
    ? 'Para pago en Cuenta Corriente debe seleccionar un cliente'
    : null;

  // Monto CC efectivo para verificar límite
  const montoCC = useMemo(() => {
    if (!requiereCC) return 0;
    if (!usarDosFormas) return totalVenta;
    return esCC1 ? (parseFloat(montoPago1) || 0) : (parseFloat(montoPago2) || 0);
  }, [requiereCC, usarDosFormas, esCC1, montoPago1, montoPago2, totalVenta]);

  const excedeLimite = infoCC && montoCC > 0 && (infoCC.saldo + montoCC > infoCC.limite);

  // Validación split de pago
  const mp1Num  = parseFloat(montoPago1) || 0;
  const mp2Num  = parseFloat(montoPago2) || 0;
  const errSplit = usarDosFormas && items.length > 0 && totalVenta > 0
    ? Math.abs(mp1Num + mp2Num - totalVenta) > 0.01
      ? mp1Num + mp2Num < totalVenta
        ? `Faltan $${fmt(totalVenta - mp1Num - mp2Num)} para cubrir el total de $${fmt(totalVenta)}`
        : `Exceso de $${fmt(mp1Num + mp2Num - totalVenta)} sobre el total de $${fmt(totalVenta)}`
      : null
    : null;

  const errDireccion = formaEntrega === 'Domicilio' && !direccionEntrega.trim()
    ? 'La dirección de entrega es obligatoria'
    : null;

  const puedeGuardar = items.length > 0 && !errDireccion && !errCC && !errSplit && !excedeLimite
    && (!usarDosFormas || (mp1Num > 0 && mp2Num > 0));

  const abrirModal = () => {
    setModalVenta(true);
    if (!clientes.length)       fetch(`${API}/api/clientes`).then(r => r.json()).then(setClientes).catch(() => {});
    if (!todosProductos.length) fetch(`${API}/api/productos`).then(r => r.json()).then(setTodosProductos).catch(() => {});
  };

  const cerrarModal = () => {
    setModalVenta(false); setItems([]); setDniCliente('');
    setFormaPago1('Efectivo'); setUsarDosFormas(false); setFormaPago2('Efectivo');
    setMontoPago1(''); setMontoPago2('');
    setFormaEntrega('Depósito'); setDireccionEntrega(''); setObservaciones('');
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
      setItems(prev => [...prev, { producto_codigo: prodSel.codigo, nombre: prodSel.nombre, cantidad: cant, precio_unitario: precio, subtotal }]);
    }
    setProdSel(null); setBusquedaProd(''); setCantInput('');
  };

  const quitarItem = codigo => setItems(prev => prev.filter(i => i.producto_codigo !== codigo));

  const guardarVenta = async () => {
    if (!puedeGuardar) return;
    setGuardando(true); setErrorGuardado(null);
    try {
      const body = {
        dni_cliente:       dniCliente || null,
        forma_entrega:     formaEntrega,
        direccion_entrega: formaEntrega === 'Domicilio' ? direccionEntrega.trim() : null,
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

          <p className="form-section-titulo">Cliente</p>
          <div className="form-group">
            <label>Seleccionar cliente</label>
            <select value={dniCliente} onChange={e => setDniCliente(e.target.value)}>
              <option value="">— Consumidor final —</option>
              {clientes.map(c => <option key={c.dni} value={c.dni}>{c.nombre_apellido} ({c.dni})</option>)}
            </select>
          </div>

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

          {prodSel && (
            <div className="prod-seleccionado-card">
              <div className="prod-sel-info">
                <span className="prod-sel-nombre">{prodSel.nombre}</span>
                <span className="prod-sel-stock">
                  Stock disponible: <strong style={{ color: disponibleProdSel <= 0 ? 'var(--rojo)' : disponibleProdSel <= parseFloat(prodSel.stock_minimo) ? 'var(--amarillo)' : 'var(--verde)' }}>{disponibleProdSel.toLocaleString('es-AR')}</strong>
                  {' — '}Precio: ${fmt(prodSel.precio_venta)}
                </span>
              </div>
              <div className="prod-sel-controles">
                <input type="number" placeholder="Cantidad" value={cantInput}
                  onChange={e => setCantInput(e.target.value)}
                  className={errCantVivo ? 'error-campo' : ''} min="0.01" step="0.01" autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') agregarItem(); }} />
                <button className="btn btn-primary" onClick={agregarItem} disabled={!puedeAgregarItem} type="button">Agregar</button>
                <button className="btn btn-secundario" onClick={() => { setProdSel(null); setBusquedaProd(''); }} type="button">✕</button>
              </div>
              {errCantVivo && <span className="error-msg" style={{ width: '100%' }}>{errCantVivo}</span>}
            </div>
          )}

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
                        <td style={{ textAlign: 'right' }}>{i.cantidad.toLocaleString('es-AR')}</td>
                        <td style={{ textAlign: 'right' }}>${fmt(i.precio_unitario)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>${fmt(i.subtotal)}</td>
                        <td><button className="btn-quitar" onClick={() => quitarItem(i.producto_codigo)}>✕</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="venta-total-box">
                <span className="venta-total-label">Total de la venta</span>
                <span className="venta-total-monto">${fmt(totalVenta)}</span>
              </div>
            </>
          )}

          <p className="form-section-titulo">Pago y entrega</p>
          <div className="form-grid">

            {/* Forma de pago principal */}
            <div className="form-group">
              <label>Forma de pago principal</label>
              <select value={formaPago1}
                onChange={e => { setFormaPago1(e.target.value); setUsarDosFormas(false); setMontoPago1(''); setMontoPago2(''); }}>
                {FORMAS_PAGO.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>

            {/* Forma de entrega */}
            <div className="form-group">
              <label>Forma de entrega</label>
              <select value={formaEntrega}
                onChange={e => { setFormaEntrega(e.target.value); if (e.target.value !== 'Domicilio') setDireccionEntrega(''); }}>
                {FORMAS_ENTREGA.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>

            {/* Opción segundo medio */}
            <div className="form-group span-2">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 400 }}>
                <input type="checkbox" checked={usarDosFormas}
                  onChange={e => {
                    setUsarDosFormas(e.target.checked);
                    setMontoPago1(''); setMontoPago2('');
                  }} />
                Agregar segundo medio de pago
              </label>
            </div>

            {/* Montos si doble pago */}
            {usarDosFormas && (
              <>
                <div className="form-group">
                  <label>Monto — {formaPago1}</label>
                  <input type="number" min="0.01" step="0.01" value={montoPago1}
                    onChange={e => setMontoPago1(e.target.value)} placeholder="$0.00" />
                </div>
                <div className="form-group">
                  <label>Segundo medio de pago</label>
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
                  <div className="form-group" style={{ display: 'flex', alignItems: 'center' }}>
                    <p style={{ fontSize: 13, color: 'var(--texto-suave)' }}>
                      Total: <strong style={{ color: 'var(--texto)' }}>${fmt(totalVenta)}</strong>
                      {mp1Num + mp2Num > 0 && Math.abs(mp1Num + mp2Num - totalVenta) <= 0.01 && (
                        <span style={{ color: 'var(--verde)', marginLeft: 8 }}>✓ Cubierto</span>
                      )}
                    </p>
                  </div>
                )}
              </>
            )}

            {/* Dirección de entrega */}
            {formaEntrega === 'Domicilio' && (
              <div className="form-group span-2">
                <label>Dirección de entrega *</label>
                <input value={direccionEntrega} onChange={e => setDireccionEntrega(e.target.value)}
                  className={errDireccion ? 'error-campo' : ''}
                  placeholder="Ej: Av. Independencia 350" />
                {errDireccion && <span className="error-msg">{errDireccion}</span>}
              </div>
            )}

            <div className="form-group span-2">
              <label>Observaciones</label>
              <textarea value={observaciones} onChange={e => setObservaciones(e.target.value)} rows={2} placeholder="Notas opcionales..." />
            </div>
          </div>

          {/* Errores de pago */}
          {errCC     && <p className="error-msg" style={{ marginTop: 8 }}>{errCC}</p>}
          {errSplit  && <p className="error-msg" style={{ marginTop: 8 }}>{errSplit}</p>}

          {/* Info CC en tiempo real */}
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
                  Total resultante: ${fmt(infoCC.saldo + montoCC)} / Límite: ${fmt(infoCC.limite)}
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

      {/* ─── Comprobante ─── */}
      {comprobante && <Comprobante datos={comprobante} tipo="venta" onCerrar={() => setComprobante(null)} />}
    </div>
  );
}
