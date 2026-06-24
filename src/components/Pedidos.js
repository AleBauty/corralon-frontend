import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import Modal from './Modal';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3000';

const ESTADO_PEDIDO = {
  Pendiente:               'badge-pendiente',
  Recibido:                'badge-recibido',
  'Parcialmente entregado':'badge-vigente',
  Cancelado:               'badge-cancelado',
};

function fmt(n) {
  return parseFloat(n).toLocaleString('es-AR', { minimumFractionDigits: 2 });
}

function formatFecha(iso) {
  return new Date(iso).toLocaleString('es-AR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
}

export default function Pedidos() {
  // ─── Lista ───
  const [pedidos, setPedidos]     = useState([]);
  const [cargando, setCargando]   = useState(true);
  const [error, setError]         = useState(null);
  const [expandido, setExpandido] = useState(null);
  const [detalle, setDetalle]     = useState({});

  // ─── Modal recibir ───
  const [modalRecibir, setModalRecibir]           = useState(null);  // pedido obj
  const [itemsRecibir, setItemsRecibir]           = useState([]);    // [{ ...item, cantidad_recibida }]
  const [cargandoItems, setCargandoItems]         = useState(false);
  const [confirmandoRecibir, setConfirmandoRecibir] = useState(false);
  const [errRecibir, setErrRecibir]               = useState(null);

  // ─── Modal nuevo pedido ───
  const [modalPedido, setModalPedido]       = useState(false);
  const [proveedores, setProveedores]       = useState([]);
  const [todosProductos, setTodosProductos] = useState([]);
  const [proveedorCuit, setProveedorCuit]   = useState('');
  const [observaciones, setObservaciones]   = useState('');
  const [items, setItems]                   = useState([]);
  const [busquedaProd, setBusquedaProd]     = useState('');
  const [prodSel, setProdSel]               = useState(null);
  const [cantInput, setCantInput]           = useState('');
  const [precioInput, setPrecioInput]       = useState('');
  const [errItem, setErrItem]               = useState('');
  const [guardando, setGuardando]           = useState(false);
  const [errorGuardado, setErrorGuardado]   = useState(null);
  const searchRef = useRef(null);

  const cargarPedidos = useCallback(() => {
    setCargando(true);
    fetch(`${API}/api/pedidos`)
      .then(r => r.ok ? r.json() : Promise.reject(`Error ${r.status}`))
      .then(data => { setPedidos(data); setCargando(false); })
      .catch(err  => { setError(String(err)); setCargando(false); });
  }, []);

  useEffect(() => { cargarPedidos(); }, [cargarPedidos]);

  useEffect(() => {
    const fn = e => { if (searchRef.current && !searchRef.current.contains(e.target)) setBusquedaProd(''); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  const proveedoresActivos = useMemo(
    () => proveedores.filter(p => p.estado === 'Activo' || p.estado == null),
    [proveedores]
  );

  const productosFiltrados = useMemo(() => {
    const q = busquedaProd.trim().toLowerCase();
    if (!q || prodSel) return [];
    return todosProductos.filter(p => p.nombre.toLowerCase().includes(q) || p.codigo.toLowerCase().includes(q)).slice(0, 7);
  }, [busquedaProd, prodSel, todosProductos]);

  const totalPedido = useMemo(() => items.reduce((acc, i) => acc + i.subtotal, 0), [items]);

  const abrirModal = () => {
    setModalPedido(true);
    if (!proveedores.length)    fetch(`${API}/api/proveedores`).then(r=>r.json()).then(setProveedores).catch(()=>{});
    if (!todosProductos.length) fetch(`${API}/api/productos`).then(r=>r.json()).then(setTodosProductos).catch(()=>{});
  };

  const cerrarModal = () => {
    setModalPedido(false); setItems([]); setProveedorCuit(''); setObservaciones('');
    setBusquedaProd(''); setProdSel(null); setCantInput(''); setPrecioInput('');
    setErrItem(''); setErrorGuardado(null);
  };

  const seleccionarProducto = p => {
    setProdSel(p); setBusquedaProd(p.nombre);
    setPrecioInput(String(parseFloat(p.precio_costo)));
    setCantInput(''); setErrItem('');
  };

  const agregarItem = () => {
    const cant  = parseFloat(cantInput);
    const precio = parseFloat(precioInput);
    if (!cantInput || isNaN(cant) || cant <= 0)     { setErrItem('La cantidad debe ser mayor a 0'); return; }
    if (!precioInput || isNaN(precio) || precio <= 0) { setErrItem('El precio debe ser mayor a 0'); return; }
    const subtotal = cant * precio;
    const yaExiste = items.find(i => i.producto_codigo === prodSel.codigo);
    if (yaExiste) {
      setItems(prev => prev.map(i => i.producto_codigo === prodSel.codigo
        ? { ...i, cantidad: parseFloat(i.cantidad) + cant, subtotal: (parseFloat(i.cantidad) + cant) * precio }
        : i
      ));
    } else {
      setItems(prev => [...prev, { producto_codigo: prodSel.codigo, nombre: prodSel.nombre, cantidad: cant, precio_unitario: precio, subtotal }]);
    }
    setProdSel(null); setBusquedaProd(''); setCantInput(''); setPrecioInput(''); setErrItem('');
  };

  const quitarItem = codigo => setItems(prev => prev.filter(i => i.producto_codigo !== codigo));

  const guardarPedido = async () => {
    if (!items.length) { setErrorGuardado('Debe agregar al menos un producto'); return; }
    setGuardando(true); setErrorGuardado(null);
    try {
      const res  = await fetch(`${API}/api/pedidos`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proveedor_cuit: proveedorCuit || null,
          observaciones: observaciones.trim() || null,
          items: items.map(i => ({ producto_codigo: i.producto_codigo, cantidad: i.cantidad, precio_unitario: i.precio_unitario })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
      cerrarModal(); cargarPedidos();
    } catch (err) { setErrorGuardado(err.message); }
    finally      { setGuardando(false); }
  };

  // ─── Modal recibir pedido ───
  const abrirModalRecibir = async (pedido) => {
    setModalRecibir(pedido);
    setErrRecibir(null);
    setCargandoItems(true);
    try {
      const data = await fetch(`${API}/api/pedidos/${pedido.id}`).then(r => r.json());
      const its = (data.items ?? []).map(item => ({
        ...item,
        cantidad_recibida: String(parseFloat(item.cantidad)),
      }));
      setItemsRecibir(its);
    } catch { setItemsRecibir([]); setErrRecibir('No se pudieron cargar los items del pedido.'); }
    finally { setCargandoItems(false); }
  };

  const actualizarCantRecibida = (id, valor) => {
    setItemsRecibir(prev => prev.map(it => it.id === id ? { ...it, cantidad_recibida: valor } : it));
  };

  const confirmarRecepcion = async () => {
    if (!modalRecibir) return;
    setConfirmandoRecibir(true); setErrRecibir(null);
    try {
      const payload = itemsRecibir.map(it => ({
        id:                 it.id,
        cantidad_recibida:  Math.max(0, parseFloat(it.cantidad_recibida) || 0),
      }));
      const res  = await fetch(`${API}/api/pedidos/${modalRecibir.id}/recibir`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: payload }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
      setModalRecibir(null); setItemsRecibir([]);
      cargarPedidos();
    } catch (err) { setErrRecibir(err.message); }
    finally      { setConfirmandoRecibir(false); }
  };

  const toggleDetalle = async id => {
    if (expandido === id) { setExpandido(null); return; }
    setExpandido(id);
    if (detalle[id]) return;
    try {
      const data = await fetch(`${API}/api/pedidos/${id}`).then(r => r.json());
      setDetalle(d => ({ ...d, [id]: data.items ?? [] }));
    } catch { setDetalle(d => ({ ...d, [id]: [] })); }
  };

  if (cargando) return <p className="estado-carga">Cargando pedidos...</p>;
  if (error)    return <p className="estado-error">Error: {error}</p>;

  return (
    <div>
      <div className="seccion-header">
        <h2>Pedidos a proveedores <span className="total-registros">{pedidos.length}</span></h2>
        <button className="btn-nuevo" onClick={abrirModal}>+ Nuevo pedido</button>
      </div>

      {pedidos.length === 0 ? <p className="estado-carga">No hay pedidos registrados.</p> : (
        <div className="tabla-wrapper">
          <table>
            <thead><tr><th>#</th><th>Proveedor</th><th>Fecha</th><th>Fecha recepción</th><th style={{textAlign:'right'}}>Total</th><th>Estado</th><th></th></tr></thead>
            <tbody>
              {pedidos.map(p => (
                <React.Fragment key={p.id}>
                  <tr>
                    <td style={{color:'#aaa',fontSize:12}}>#{p.id}</td>
                    <td style={{fontWeight:500}}>{p.proveedor ?? '—'}</td>
                    <td style={{whiteSpace:'nowrap'}}>{formatFecha(p.fecha)}</td>
                    <td style={{color:'#aaa'}}>{p.fecha_recepcion ? formatFecha(p.fecha_recepcion) : '—'}</td>
                    <td style={{textAlign:'right',fontWeight:700}}>${fmt(p.total)}</td>
                    <td><span className={`badge ${ESTADO_PEDIDO[p.estado] ?? 'badge-pendiente'}`}>{p.estado}</span></td>
                    <td style={{display:'flex',gap:6}}>
                      <button className="btn-editar" onClick={() => toggleDetalle(p.id)}>{expandido===p.id?'Ocultar':'Ver items'}</button>
                      {p.estado === 'Pendiente' && (
                        <button
                          className="btn-editar" style={{background:'#e9f7ef',color:'#27ae60',borderColor:'rgba(39,174,96,0.3)'}}
                          onClick={() => abrirModalRecibir(p)}
                        >
                          ✓ Recibir
                        </button>
                      )}
                    </td>
                  </tr>
                  {expandido === p.id && (
                    <tr><td colSpan={7} style={{background:'#f7f8fa',padding:'0 24px 12px'}}>
                      {!detalle[p.id] ? <p style={{color:'#999',padding:'8px 0'}}>Cargando...</p>
                        : detalle[p.id].length === 0 ? <p style={{color:'#999',padding:'8px 0'}}>Sin items.</p>
                        : <table className="tabla-items"><thead><tr><th>Producto</th><th style={{textAlign:'right'}}>Cantidad</th><th style={{textAlign:'right'}}>Precio unit.</th><th style={{textAlign:'right'}}>Subtotal</th></tr></thead>
                            <tbody>{detalle[p.id].map(item => (
                              <tr key={item.id}>
                                <td>{item.producto ?? item.producto_codigo}</td>
                                <td style={{textAlign:'right'}}>{parseFloat(item.cantidad).toLocaleString('es-AR')}</td>
                                <td style={{textAlign:'right'}}>${fmt(item.precio_unitario)}</td>
                                <td style={{textAlign:'right',fontWeight:600}}>${fmt(item.subtotal)}</td>
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

      {/* ─── Modal nuevo pedido ─── */}
      {modalPedido && (
        <Modal titulo="Nuevo pedido a proveedor" onCerrar={cerrarModal} ancho={700}>

          <p className="form-section-titulo">Proveedor</p>
          <div className="form-group">
            <label>Seleccionar proveedor (solo activos)</label>
            <select value={proveedorCuit} onChange={e => setProveedorCuit(e.target.value)}>
              <option value="">— Sin proveedor específico —</option>
              {proveedoresActivos.map(p => <option key={p.cuit} value={p.cuit}>{p.nombre} ({p.cuit})</option>)}
            </select>
          </div>

          <p className="form-section-titulo">Agregar productos</p>
          <div className="search-container" ref={searchRef}>
            <input
              className="buscador" style={{maxWidth:'100%',marginBottom:0}}
              placeholder="🔍  Buscar producto por nombre o código..."
              value={busquedaProd}
              onChange={e => { setBusquedaProd(e.target.value); setProdSel(null); }}
              autoComplete="off"
            />
            {productosFiltrados.length > 0 && (
              <div className="search-resultados">
                {productosFiltrados.map(p => (
                  <div key={p.codigo} className="search-result-item" onMouseDown={() => seleccionarProducto(p)}>
                    <span className="search-result-nombre">{p.nombre}</span>
                    <span className="search-result-codigo"><code>{p.codigo}</code></span>
                    <span className="search-result-stock">Stock: {parseFloat(p.stock_actual).toLocaleString('es-AR')}</span>
                    <span className="search-result-precio">Costo: ${fmt(p.precio_costo)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {prodSel && (
            <div className="prod-seleccionado-card">
              <div className="prod-sel-info">
                <span className="prod-sel-nombre">{prodSel.nombre}</span>
                <span className="prod-sel-stock">Stock actual: {parseFloat(prodSel.stock_actual).toLocaleString('es-AR')}</span>
              </div>
              <div className="prod-sel-controles">
                <input type="number" placeholder="Cantidad" value={cantInput} onChange={e => { setCantInput(e.target.value); setErrItem(''); }} min="0.01" step="0.01" autoFocus onKeyDown={e => { if(e.key==='Enter') agregarItem(); }} style={{width:90}} />
                <input type="number" placeholder="Precio costo" value={precioInput} onChange={e => { setPrecioInput(e.target.value); setErrItem(''); }} min="0.01" step="0.01" onKeyDown={e => { if(e.key==='Enter') agregarItem(); }} style={{width:120}} />
                <button className="btn btn-primary" onClick={agregarItem} type="button">Agregar</button>
                <button className="btn btn-secundario" onClick={() => { setProdSel(null); setBusquedaProd(''); }} type="button">✕</button>
              </div>
              {errItem && <span className="error-msg" style={{width:'100%'}}>{errItem}</span>}
            </div>
          )}

          {items.length > 0 && (
            <>
              <p className="form-section-titulo">Items del pedido</p>
              <div className="venta-items-lista">
                <table>
                  <thead><tr><th>Producto</th><th style={{textAlign:'right'}}>Cantidad</th><th style={{textAlign:'right'}}>Precio unit.</th><th style={{textAlign:'right'}}>Subtotal</th><th></th></tr></thead>
                  <tbody>
                    {items.map(i => (
                      <tr key={i.producto_codigo}>
                        <td style={{fontWeight:500}}>{i.nombre}</td>
                        <td style={{textAlign:'right'}}>{i.cantidad.toLocaleString('es-AR')}</td>
                        <td style={{textAlign:'right'}}>${fmt(i.precio_unitario)}</td>
                        <td style={{textAlign:'right',fontWeight:700}}>${fmt(i.subtotal)}</td>
                        <td><button className="btn-quitar" onClick={() => quitarItem(i.producto_codigo)}>✕</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="venta-total-box">
                <span className="venta-total-label">Total del pedido</span>
                <span className="venta-total-monto">${fmt(totalPedido)}</span>
              </div>
            </>
          )}

          <div className="form-group" style={{marginTop:16}}>
            <label>Observaciones</label>
            <textarea value={observaciones} onChange={e => setObservaciones(e.target.value)} rows={2} placeholder="Notas opcionales..." />
          </div>

          {errorGuardado && <p className="error-msg" style={{marginTop:14}}>Error: {errorGuardado}</p>}

          <div className="modal-footer">
            <button className="btn btn-secundario" onClick={cerrarModal} type="button">Cancelar</button>
            <button className="btn btn-primary" onClick={guardarPedido} disabled={!items.length || guardando} type="button">
              {guardando ? 'Guardando...' : `Crear pedido${items.length ? ` — $${fmt(totalPedido)}` : ''}`}
            </button>
          </div>
        </Modal>
      )}

      {/* ─── Modal recibir pedido ─── */}
      {modalRecibir && (
        <Modal titulo={`Recibir pedido #${modalRecibir.id}`} onCerrar={() => { setModalRecibir(null); setItemsRecibir([]); }} ancho={680}>
          <p style={{ fontSize: 14, color: 'var(--texto-suave)', marginBottom: 18 }}>
            Ingresá la cantidad realmente recibida de cada producto. El stock se actualiza solo con lo recibido efectivamente.
            Si recibís menos que lo pedido, el pedido quedará como <strong>Parcialmente entregado</strong>.
          </p>

          {cargandoItems ? (
            <p className="estado-carga">Cargando items...</p>
          ) : itemsRecibir.length === 0 ? (
            <p className="estado-carga">Sin items.</p>
          ) : (
            <div className="tabla-wrapper" style={{ marginBottom: 20 }}>
              <table>
                <thead><tr>
                  <th>Producto</th>
                  <th style={{ textAlign: 'right' }}>Cantidad pedida</th>
                  <th style={{ textAlign: 'right', minWidth: 160 }}>Cantidad recibida</th>
                  <th>Estado</th>
                </tr></thead>
                <tbody>
                  {itemsRecibir.map(it => {
                    const pedida   = parseFloat(it.cantidad);
                    const recibida = parseFloat(it.cantidad_recibida) || 0;
                    const estadoItem = recibida <= 0 ? 'No recibido' : recibida < pedida ? 'Parcial' : 'Completo';
                    const colorEstado = estadoItem === 'Completo' ? '#166534' : estadoItem === 'Parcial' ? '#854d0e' : '#c0392b';
                    const bgEstado    = estadoItem === 'Completo' ? '#dcfce7'  : estadoItem === 'Parcial' ? '#fef9c3'  : '#fff0f0';
                    return (
                      <tr key={it.id}>
                        <td style={{ fontWeight: 500 }}>{it.producto ?? it.producto_codigo}</td>
                        <td style={{ textAlign: 'right' }}>{pedida.toLocaleString('es-AR')}</td>
                        <td style={{ textAlign: 'right' }}>
                          <input
                            type="number"
                            min="0"
                            max={pedida}
                            step="0.01"
                            value={it.cantidad_recibida}
                            onChange={e => actualizarCantRecibida(it.id, e.target.value)}
                            style={{
                              width: 110, textAlign: 'right',
                              border: '1.5px solid var(--borde)', borderRadius: 6,
                              padding: '4px 8px', fontSize: 14, fontWeight: 600,
                              background: recibida < pedida ? '#fffbeb' : 'var(--blanco)',
                            }}
                          />
                        </td>
                        <td>
                          <span className="badge" style={{ background: bgEstado, color: colorEstado, border: `1px solid ${colorEstado}22` }}>
                            {estadoItem}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {errRecibir && <p className="error-msg" style={{ marginBottom: 12 }}>{errRecibir}</p>}
          <div className="modal-footer">
            <button className="btn btn-secundario" type="button"
              onClick={() => { setModalRecibir(null); setItemsRecibir([]); }}>
              Cancelar
            </button>
            <button className="btn btn-primary" type="button"
              onClick={confirmarRecepcion}
              disabled={confirmandoRecibir || cargandoItems || itemsRecibir.length === 0}>
              {confirmandoRecibir ? 'Registrando...' : '✓ Confirmar recepción'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
