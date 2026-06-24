import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import Modal       from './Modal';
import Comprobante from './Comprobante';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3000';
const FORMAS_PAGO    = ['Efectivo', 'Tarjeta', 'Transferencia', 'Cuenta corriente'];
const FORMAS_ENTREGA = ['Depósito', 'Domicilio'];
const TIPOS_CLIENTE  = ['Normal', 'Cuenta corriente', 'Empresa'];

const ESTADO_ESTILO = {
  Vigente:    'badge-vigente',
  Vencido:    'badge-vencido',
  Confirmado: 'badge-confirmado',
  Cancelado:  'badge-cancelado',
};

function fmt(n) { return parseFloat(n ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 2 }); }
function formatFecha(iso) {
  return new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const FORM_CLI_VACIO = { nombre_apellido: '', dni: '', telefono: '', tipo: 'Normal' };

export default function Presupuestos() {
  const [presupuestos, setPresupuestos] = useState([]);
  const [cargando, setCargando]         = useState(true);
  const [error, setError]               = useState(null);
  const [expandido, setExpandido]       = useState(null);
  const [detalle, setDetalle]           = useState({});

  const [comprobante, setComprobante]                 = useState(null);
  const [cargandoComprobante, setCargandoComprobante] = useState(null);

  // ─── Modal crear/editar presupuesto ───
  const [modalNuevo, setModalNuevo]         = useState(false);
  const [editandoId, setEditandoId]         = useState(null);
  const [clientes, setClientes]             = useState([]);
  const [todosProductos, setTodosProductos] = useState([]);
  const [dniCliente, setDniCliente]         = useState('');
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

  // ─── Modal confirmar como venta ───
  const [modalConfirmar, setModalConfirmar] = useState(null);
  const [confPago, setConfPago]             = useState('Efectivo');
  const [confEntrega, setConfEntrega]       = useState('Depósito');
  const [confDireccion, setConfDireccion]   = useState('');
  const [confirmando, setConfirmando]       = useState(false);
  const [errConfirmar, setErrConfirmar]     = useState(null);

  // ─── Nuevo cliente ───
  const [modalNuevoCli, setModalNuevoCli] = useState(false);
  const [formCli, setFormCli]             = useState(FORM_CLI_VACIO);
  const [guardandoCli, setGuardandoCli]   = useState(false);
  const [errCli, setErrCli]               = useState(null);

  const cargar = useCallback(() => {
    setCargando(true);
    fetch(`${API}/api/presupuestos`)
      .then(r => r.ok ? r.json() : Promise.reject(`Error ${r.status}`))
      .then(data => { setPresupuestos(data); setCargando(false); })
      .catch(err  => { setError(String(err)); setCargando(false); });
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  useEffect(() => {
    const fn = e => { if (searchRef.current && !searchRef.current.contains(e.target)) setBusquedaProd(''); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  const totalPresup = useMemo(() => items.reduce((acc, i) => acc + i.subtotal, 0), [items]);

  // Auto-fill montoPago1 cuando es pago simple
  useEffect(() => {
    if (!usarDosFormas) {
      setMontoPago1(totalPresup > 0 ? totalPresup.toFixed(2) : '');
    }
  }, [totalPresup, usarDosFormas]);

  const productosFiltrados = useMemo(() => {
    const q = busquedaProd.trim().toLowerCase();
    if (!q || prodSel) return [];
    return todosProductos.filter(p => p.nombre.toLowerCase().includes(q) || p.codigo.toLowerCase().includes(q)).slice(0, 7);
  }, [busquedaProd, prodSel, todosProductos]);

  const abrirModal = () => {
    setModalNuevo(true);
    if (!clientes.length)       fetch(`${API}/api/clientes`).then(r => r.json()).then(setClientes).catch(() => {});
    if (!todosProductos.length) fetch(`${API}/api/productos`).then(r => r.json()).then(setTodosProductos).catch(() => {});
  };

  const cerrarModal = () => {
    setModalNuevo(false); setEditandoId(null); setItems([]); setDniCliente(''); setObservaciones('');
    setBusquedaProd(''); setProdSel(null); setCantInput(''); setErrorGuardado(null);
    setFormaPago1('Efectivo'); setMontoPago1(''); setUsarDosFormas(false);
    setFormaPago2('Transferencia'); setMontoPago2('');
  };

  const seleccionarProducto = p => { setProdSel(p); setBusquedaProd(p.nombre); setCantInput(''); };

  const cantParseada     = parseFloat(cantInput);
  const errCantVivo      = prodSel && cantInput && (isNaN(cantParseada) || cantParseada <= 0)
    ? 'La cantidad debe ser mayor a 0' : null;
  const puedeAgregarItem = Boolean(prodSel && cantInput && !errCantVivo);

  const agregarItem = () => {
    if (!puedeAgregarItem) return;
    const cant   = cantParseada;
    const precio = parseFloat(prodSel.precio_venta), subtotal = cant * precio;
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

  const mp1Num = parseFloat(montoPago1) || 0;
  const mp2Num = parseFloat(montoPago2) || 0;

  const errSplit = usarDosFormas && items.length > 0 && totalPresup > 0
    ? Math.abs(mp1Num + mp2Num - totalPresup) > 0.01
      ? mp1Num + mp2Num < totalPresup
        ? `Faltan $${fmt(totalPresup - mp1Num - mp2Num)} para cubrir el total`
        : `Exceso de $${fmt(mp1Num + mp2Num - totalPresup)} sobre el total`
      : null
    : null;

  const activarSegundaForma = (checked) => {
    setUsarDosFormas(checked);
    if (checked) {
      setMontoPago2((totalPresup - mp1Num > 0 ? totalPresup - mp1Num : 0).toFixed(2));
    } else {
      setMontoPago2('');
      setMontoPago1(totalPresup > 0 ? totalPresup.toFixed(2) : '');
    }
  };

  const abrirEditar = async p => {
    if (!clientes.length)       fetch(`${API}/api/clientes`).then(r => r.json()).then(setClientes).catch(() => {});
    if (!todosProductos.length) fetch(`${API}/api/productos`).then(r => r.json()).then(setTodosProductos).catch(() => {});
    try {
      const det = await fetch(`${API}/api/presupuestos/${p.id}`).then(r => r.json());
      const mappedItems = (det.items ?? []).map(item => ({
        producto_codigo: item.producto_codigo,
        nombre:          item.producto ?? item.producto_codigo,
        cantidad:        parseFloat(item.cantidad),
        precio_unitario: parseFloat(item.precio_unitario),
        subtotal:        parseFloat(item.subtotal),
      }));
      setDniCliente(det.dni_cliente ?? '');
      setObservaciones(det.observaciones ?? '');
      setItems(mappedItems);
      setFormaPago1(det.forma_pago_1 ?? 'Efectivo');
      setMontoPago1(det.monto_pago_1 != null ? String(parseFloat(det.monto_pago_1)) : '');
      if (det.forma_pago_2) {
        setUsarDosFormas(true);
        setFormaPago2(det.forma_pago_2);
        setMontoPago2(det.monto_pago_2 != null ? String(parseFloat(det.monto_pago_2)) : '');
      } else {
        setUsarDosFormas(false); setFormaPago2('Transferencia'); setMontoPago2('');
      }
      setEditandoId(p.id);
      setErrorGuardado(null);
      setBusquedaProd(''); setProdSel(null); setCantInput('');
      setModalNuevo(true);
    } catch (err) { alert('Error al cargar el presupuesto: ' + err.message); }
  };

  const guardar = async () => {
    if (!items.length) { setErrorGuardado('Debe agregar al menos un producto'); return; }
    if (usarDosFormas && errSplit) { setErrorGuardado(errSplit); return; }
    setGuardando(true); setErrorGuardado(null);
    try {
      const body = {
        dni_cliente:  dniCliente || null,
        observaciones: observaciones.trim() || null,
        items: items.map(i => ({ producto_codigo: i.producto_codigo, cantidad: i.cantidad, precio_unitario: i.precio_unitario })),
        forma_pago_1: formaPago1,
        monto_pago_1: usarDosFormas ? mp1Num : totalPresup,
        forma_pago_2: usarDosFormas ? formaPago2 : null,
        monto_pago_2: usarDosFormas ? mp2Num : null,
      };
      const url    = editandoId ? `${API}/api/presupuestos/${editandoId}/editar` : `${API}/api/presupuestos`;
      const method = editandoId ? 'PUT' : 'POST';
      const res    = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data   = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
      cerrarModal(); cargar();
    } catch (err) { setErrorGuardado(err.message); }
    finally      { setGuardando(false); }
  };

  // ─── Nuevo cliente ───
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

  const abrirConfirmar = p => {
    setModalConfirmar(p); setConfPago('Efectivo'); setConfEntrega('Depósito');
    setConfDireccion(''); setErrConfirmar(null);
  };

  const confirmarVenta = async () => {
    if (confEntrega === 'Domicilio' && !confDireccion.trim()) { setErrConfirmar('La dirección de entrega es obligatoria'); return; }
    setConfirmando(true); setErrConfirmar(null);
    try {
      const res  = await fetch(`${API}/api/presupuestos/${modalConfirmar.id}/confirmar`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forma_pago: confPago, forma_entrega: confEntrega, direccion_entrega: confEntrega === 'Domicilio' ? confDireccion.trim() : null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
      setModalConfirmar(null); cargar();
      alert(`¡Venta #${data.venta.id} creada correctamente!`);
    } catch (err) { setErrConfirmar(err.message); }
    finally      { setConfirmando(false); }
  };

  const verComprobante = async id => {
    setCargandoComprobante(id);
    try {
      const data = await fetch(`${API}/api/presupuestos/${id}`).then(r => r.json());
      setComprobante(data);
    } catch { alert('Error al cargar el presupuesto'); }
    finally { setCargandoComprobante(null); }
  };

  const toggleDetalle = async id => {
    if (expandido === id) { setExpandido(null); return; }
    setExpandido(id);
    if (detalle[id]) return;
    try {
      const data = await fetch(`${API}/api/presupuestos/${id}`).then(r => r.json());
      setDetalle(d => ({ ...d, [id]: data.items ?? [] }));
    } catch { setDetalle(d => ({ ...d, [id]: [] })); }
  };

  if (cargando) return <p className="estado-carga">Cargando presupuestos...</p>;
  if (error)    return <p className="estado-error">Error: {error}</p>;

  return (
    <div>
      <div className="seccion-header">
        <h2>Presupuestos <span className="total-registros">{presupuestos.length}</span></h2>
        <button className="btn-nuevo" onClick={abrirModal}>+ Nuevo presupuesto</button>
      </div>

      {presupuestos.length === 0 ? <p className="estado-carga">No hay presupuestos registrados.</p> : (
        <div className="tabla-wrapper">
          <table>
            <thead><tr><th>#</th><th>Fecha</th><th>Vence</th><th>Cliente</th><th>Pago</th><th style={{ textAlign: 'right' }}>Total</th><th>Estado</th><th></th></tr></thead>
            <tbody>
              {presupuestos.map(p => {
                const estado = p.estado_calculado ?? p.estado;
                return (
                  <React.Fragment key={p.id}>
                    <tr>
                      <td style={{ color: '#aaa', fontSize: 12 }}>#{p.id}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>{formatFecha(p.fecha)}</td>
                      <td style={{ whiteSpace: 'nowrap', color: estado === 'Vencido' ? '#c0392b' : '#888' }}>
                        {p.fecha_vencimiento ? formatFecha(p.fecha_vencimiento) : '—'}
                      </td>
                      <td style={{ fontWeight: 500 }}>{p.cliente ?? 'Sin cliente'}</td>
                      <td style={{ fontSize: 12 }}>
                        {p.forma_pago_1 ?? '—'}
                        {p.forma_pago_2 && <span style={{ display: 'block', color: '#888' }}>+ {p.forma_pago_2}</span>}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>${fmt(p.total)}</td>
                      <td><span className={`badge ${ESTADO_ESTILO[estado] ?? 'badge-vigente'}`}>{estado}</span></td>
                      <td style={{ display: 'flex', gap: 6, flexWrap: 'nowrap' }}>
                        <button className="btn-editar" onClick={() => toggleDetalle(p.id)}>{expandido === p.id ? 'Ocultar' : 'Items'}</button>
                        <button className="btn-editar" style={{ background: '#f0f4ff', color: '#3730a3', borderColor: 'rgba(55,48,163,0.25)' }}
                          onClick={() => verComprobante(p.id)} disabled={cargandoComprobante === p.id}>
                          {cargandoComprobante === p.id ? '...' : '📄 Ver'}
                        </button>
                        {estado === 'Vigente' && (
                          <button className="btn-editar" onClick={() => abrirEditar(p)}>✏ Editar</button>
                        )}
                        {estado === 'Vigente' && (
                          <button className="btn-editar" style={{ background: '#e9f7ef', color: '#27ae60', borderColor: 'rgba(39,174,96,0.3)' }}
                            onClick={() => abrirConfirmar(p)}>✓ Confirmar</button>
                        )}
                      </td>
                    </tr>
                    {expandido === p.id && (
                      <tr><td colSpan={8} style={{ background: '#f7f8fa', padding: '0 24px 12px' }}>
                        {!detalle[p.id] ? <p style={{ color: '#999', padding: '8px 0' }}>Cargando...</p>
                          : detalle[p.id].length === 0 ? <p style={{ color: '#999', padding: '8px 0' }}>Sin items.</p>
                          : <table className="tabla-items"><thead><tr><th>Producto</th><th style={{ textAlign: 'right' }}>Cant.</th><th style={{ textAlign: 'right' }}>Precio unit.</th><th style={{ textAlign: 'right' }}>Subtotal</th></tr></thead>
                              <tbody>{detalle[p.id].map(item => (
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
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ─── Modal nuevo/editar presupuesto ─── */}
      {modalNuevo && (
        <Modal titulo={editandoId ? `Editar presupuesto #${editandoId}` : 'Nuevo presupuesto'} onCerrar={cerrarModal} ancho={700}>

          {/* Cliente */}
          <p className="form-section-titulo">Cliente</p>
          <div className="form-group">
            <label>Seleccionar cliente</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <select value={dniCliente} onChange={e => setDniCliente(e.target.value)} style={{ flex: 1 }}>
                <option value="">— Sin cliente —</option>
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
                {productosFiltrados.map(p => (
                  <div key={p.codigo} className="search-result-item" onMouseDown={() => seleccionarProducto(p)}>
                    <span className="search-result-nombre">
                      {p.nombre}
                      {p.unidad_medida && <span style={{ fontSize: 11, color: 'var(--texto-suave)', marginLeft: 6 }}>({p.unidad_medida})</span>}
                    </span>
                    <span className="search-result-codigo"><code>{p.codigo}</code></span>
                    <span className="search-result-stock">Stock: {parseFloat(p.stock_actual).toLocaleString('es-AR')}</span>
                    <span className="search-result-precio">${fmt(p.precio_venta)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {prodSel && (
            <div className="prod-seleccionado-card">
              <div className="prod-sel-info">
                <span className="prod-sel-nombre">{prodSel.nombre}</span>
                <span className="prod-sel-stock">Precio: ${fmt(prodSel.precio_venta)}</span>
              </div>
              <div className="prod-sel-controles">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--texto-suave)', marginBottom: 0 }}>
                    Cantidad ({prodSel.unidad_medida ?? 'unidades'})
                  </label>
                  <input type="number" placeholder="Cantidad" value={cantInput}
                    onChange={e => setCantInput(e.target.value)}
                    className={errCantVivo ? 'error-campo' : ''} min="0.01" step="0.01" autoFocus
                    style={{ width: 110 }}
                    onKeyDown={e => { if (e.key === 'Enter') agregarItem(); }} />
                </div>
                <button className="btn btn-primary" onClick={agregarItem} disabled={!puedeAgregarItem} type="button" style={{ alignSelf: 'flex-end' }}>Agregar</button>
                <button className="btn btn-secundario" onClick={() => { setProdSel(null); setBusquedaProd(''); }} type="button" style={{ alignSelf: 'flex-end' }}>✕</button>
              </div>
              {errCantVivo && <span className="error-msg" style={{ width: '100%' }}>{errCantVivo}</span>}
            </div>
          )}

          {items.length > 0 && (
            <>
              <p className="form-section-titulo">Productos del presupuesto</p>
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
                <span className="venta-total-label">Total del presupuesto</span>
                <span className="venta-total-monto">${fmt(totalPresup)}</span>
              </div>
            </>
          )}

          {/* Forma de pago */}
          <p className="form-section-titulo">Forma de pago</p>
          <div className="form-grid">
            <div className="form-group">
              <label>Forma de pago</label>
              <select value={formaPago1}
                onChange={e => { setFormaPago1(e.target.value); setUsarDosFormas(false); setMontoPago2(''); }}>
                {FORMAS_PAGO.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Monto — {formaPago1}</label>
              <input type="number" min="0.01" step="0.01" value={montoPago1}
                onChange={e => setMontoPago1(e.target.value)}
                placeholder={totalPresup > 0 ? `$${fmt(totalPresup)}` : '$0.00'} />
            </div>
            <div className="form-group" style={{ display: 'flex', alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 400, marginTop: 20 }}>
                <input type="checkbox" checked={usarDosFormas}
                  onChange={e => activarSegundaForma(e.target.checked)} />
                Agregar segunda forma de pago
              </label>
            </div>

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
                      Total: <strong style={{ color: 'var(--texto)' }}>${fmt(totalPresup)}</strong>
                      {' · '}Asignado: <strong>${fmt(mp1Num + mp2Num)}</strong>
                      {Math.abs(mp1Num + mp2Num - totalPresup) <= 0.01 && (
                        <span style={{ color: 'var(--verde)', marginLeft: 8 }}>✓ Cubierto</span>
                      )}
                    </p>
                  </div>
                )}
              </>
            )}
          </div>

          {errSplit && <p className="error-msg" style={{ marginTop: 8 }}>{errSplit}</p>}

          <div className="form-group" style={{ marginTop: 16 }}>
            <label>Observaciones</label>
            <textarea value={observaciones} onChange={e => setObservaciones(e.target.value)} rows={2} placeholder="Notas opcionales..." />
          </div>

          {!editandoId && (
            <p className="comp-aviso-vencimiento">⏱ Este presupuesto vencerá automáticamente en 5 días.</p>
          )}

          {errorGuardado && <p className="error-msg" style={{ marginTop: 14 }}>Error: {errorGuardado}</p>}
          <div className="modal-footer">
            <button className="btn btn-secundario" onClick={cerrarModal} type="button">Cancelar</button>
            <button className="btn btn-primary" onClick={guardar} disabled={!items.length || guardando} type="button">
              {guardando
                ? 'Guardando...'
                : editandoId
                  ? `Guardar cambios${items.length ? ` — $${fmt(totalPresup)}` : ''}`
                  : `Crear presupuesto${items.length ? ` — $${fmt(totalPresup)}` : ''}`}
            </button>
          </div>
        </Modal>
      )}

      {/* ─── Modal nuevo cliente ─── */}
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

      {/* ─── Modal confirmar como venta ─── */}
      {modalConfirmar && (
        <Modal titulo={`Confirmar presupuesto #${modalConfirmar.id} como venta`} onCerrar={() => setModalConfirmar(null)} ancho={480}>
          <p style={{ marginBottom: 18, color: '#555', fontSize: 14 }}>
            Se creará una venta por <strong>${fmt(modalConfirmar.total)}</strong> descontando el stock correspondiente.
          </p>
          <div className="form-grid">
            <div className="form-group">
              <label>Forma de pago</label>
              <select value={confPago} onChange={e => setConfPago(e.target.value)}>
                {FORMAS_PAGO.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Forma de entrega</label>
              <select value={confEntrega} onChange={e => { setConfEntrega(e.target.value); if (e.target.value !== 'Domicilio') setConfDireccion(''); }}>
                {FORMAS_ENTREGA.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            {confEntrega === 'Domicilio' && (
              <div className="form-group span-2">
                <label>Dirección de entrega *</label>
                <input value={confDireccion} onChange={e => setConfDireccion(e.target.value)}
                  className={errConfirmar?.includes('dirección') ? 'error-campo' : ''}
                  placeholder="Ej: Av. Independencia 350, Tilcara" autoFocus />
              </div>
            )}
          </div>
          {errConfirmar && <p className="error-msg" style={{ marginTop: 14 }}>Error: {errConfirmar}</p>}
          <div className="modal-footer">
            <button className="btn btn-secundario" onClick={() => setModalConfirmar(null)} type="button">Cancelar</button>
            <button className="btn btn-primary" onClick={confirmarVenta} disabled={confirmando} type="button">
              {confirmando ? 'Confirmando...' : '✓ Confirmar venta'}
            </button>
          </div>
        </Modal>
      )}

      {comprobante && <Comprobante datos={comprobante} tipo="presupuesto" onCerrar={() => setComprobante(null)} />}
    </div>
  );
}
