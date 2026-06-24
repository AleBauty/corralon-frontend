import { useEffect, useState, useMemo, useCallback } from 'react';
import Modal   from './Modal';
import Tooltip from './Tooltip';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3000';

const UNIDADES_MEDIDA  = ['bolsas', 'm²', 'm³', 'kg', 'unidades', 'litros', 'metros'];
const UNIDADES_ENTERAS = ['bolsas', 'unidades'];

const FORM_VACIO = {
  codigo: '', nombre: '', descripcion: '', categoria_id: '',
  marca: '', stock_actual: '0', stock_minimo: '0',
  proveedor_principal: '', precio_costo: '', porcentaje_ganancia: '',
  unidad_medida: 'unidades',
};

function validar(form, esEdicion, ingresoStock) {
  const e = {};
  if (!form.nombre.trim())               e.nombre = 'El nombre es obligatorio';
  else if (form.nombre.trim().length < 3) e.nombre = 'Mínimo 3 caracteres';
  if (form.precio_costo === '')           e.precio_costo = 'El precio de costo es obligatorio';
  else if (isNaN(form.precio_costo) || parseFloat(form.precio_costo) <= 0)
    e.precio_costo = 'Debe ser un número mayor a 0';
  if (form.porcentaje_ganancia === '')    e.porcentaje_ganancia = 'El porcentaje es obligatorio';
  else if (isNaN(form.porcentaje_ganancia) || parseFloat(form.porcentaje_ganancia) < 0)
    e.porcentaje_ganancia = 'No puede ser negativo';
  else if (parseFloat(form.porcentaje_ganancia) > 100)
    e.porcentaje_ganancia = 'No puede superar el 100%';
  if (!esEdicion) {
    if (form.stock_actual !== '' && parseFloat(form.stock_actual) < 0)
      e.stock_actual = 'No puede ser negativo';
  }
  if (form.stock_minimo !== '' && parseFloat(form.stock_minimo) < 0)
    e.stock_minimo = 'No puede ser negativo';
  if (esEdicion && ingresoStock !== '' && ingresoStock !== undefined) {
    const n = parseFloat(ingresoStock);
    if (isNaN(n) || n <= 0) e.ingresoStock = 'El ingreso debe ser mayor a 0';
  }
  return e;
}

function badgeStock(p) {
  const actual = parseFloat(p.stock_actual), minimo = parseFloat(p.stock_minimo);
  if (actual <= 0)      return <span className="badge badge-sin-stock">SIN STOCK</span>;
  if (actual <= minimo) return <span className="badge badge-bajo">BAJO STOCK</span>;
  return                       <span className="badge badge-ok">OK</span>;
}

export default function Productos() {
  const [tab, setTab] = useState('productos');
  const [productos, setProductos]         = useState([]);
  const [proveedores, setProveedores]     = useState([]);
  const [categorias, setCategorias]       = useState([]);
  const [cargando, setCargando]           = useState(true);
  const [error, setError]                 = useState(null);
  const [modalAbierto, setModalAbierto]   = useState(false);
  const [esEdicion, setEsEdicion]         = useState(false);
  const [form, setForm]                   = useState(FORM_VACIO);
  const [stockActualBase, setStockActualBase] = useState(0);
  const [ingresoStock, setIngresoStock]   = useState('');
  const [guardando, setGuardando]         = useState(false);
  const [errorGuardado, setErrorGuardado] = useState(null);
  const [generandoCodigo, setGenerandoCodigo] = useState(false);

  // Historial precios modal
  const [modalHistPrecios, setModalHistPrecios]   = useState(null);
  const [histPreciosData, setHistPreciosData]     = useState([]);
  const [cargandoHistPrecios, setCargandoHistPrecios] = useState(false);

  // Movimientos stock modal
  const [modalMovStock, setModalMovStock]   = useState(null);
  const [movStockData, setMovStockData]     = useState([]);
  const [cargandoMovStock, setCargandoMovStock] = useState(false);

  // Inventario físico
  const [inventarios, setInventarios]     = useState([]);
  const [invActual, setInvActual]         = useState(null);
  const [cargandoInv, setCargandoInv]     = useState(false);
  const [iniciandoInv, setIniciandoInv]   = useState(false);
  const [finalizandoInv, setFinalizandoInv] = useState(false);
  const [errInv, setErrInv]               = useState(null);

  const errores    = useMemo(() => validar(form, esEdicion, ingresoStock), [form, esEdicion, ingresoStock]);
  const hayErrores = Object.values(errores).some(Boolean);

  const precioVentaPreview = useMemo(() => {
    const c = parseFloat(form.precio_costo), g = parseFloat(form.porcentaje_ganancia);
    if (!isNaN(c) && !isNaN(g) && c > 0 && g >= 0)
      return { monto: (c * (1 + g / 100)).toFixed(2), costo: c, ganancia: g };
    return null;
  }, [form.precio_costo, form.porcentaje_ganancia]);

  const cargarProductos = useCallback(() => {
    setCargando(true);
    fetch(`${API}/api/productos`)
      .then(r => r.ok ? r.json() : Promise.reject(`Error ${r.status}`))
      .then(data => { setProductos(data); setCargando(false); })
      .catch(err  => { setError(String(err)); setCargando(false); });
  }, []);

  const cargarInventarios = useCallback(() => {
    fetch(`${API}/api/inventario`)
      .then(r => r.json())
      .then(d => setInventarios(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    cargarProductos();
    fetch(`${API}/api/proveedores`).then(r => r.json()).then(setProveedores).catch(() => {});
    fetch(`${API}/api/productos/categorias`).then(r => r.json()).then(setCategorias).catch(() => {});
    cargarInventarios();
  }, [cargarProductos, cargarInventarios]);

  const verHistorialPrecios = async (p) => {
    setModalHistPrecios(p); setHistPreciosData([]); setCargandoHistPrecios(true);
    try {
      const data = await fetch(`${API}/api/productos/${p.codigo}/historial-precios`).then(r => r.json());
      setHistPreciosData(Array.isArray(data) ? data : []);
    } catch { setHistPreciosData([]); }
    finally { setCargandoHistPrecios(false); }
  };

  const verMovimientosStock = async (p) => {
    setModalMovStock(p); setMovStockData([]); setCargandoMovStock(true);
    try {
      const data = await fetch(`${API}/api/productos/${p.codigo}/movimientos-stock`).then(r => r.json());
      setMovStockData(Array.isArray(data) ? data : []);
    } catch { setMovStockData([]); }
    finally { setCargandoMovStock(false); }
  };

  const iniciarInventario = async () => {
    if (!window.confirm('¿Iniciar un nuevo inventario físico? Se cargará la lista completa de productos con el stock actual del sistema.')) return;
    const u = (() => { try { return JSON.parse(sessionStorage.getItem('usuario')); } catch { return null; } })();
    setIniciandoInv(true); setErrInv(null);
    try {
      const res  = await fetch(`${API}/api/inventario/iniciar`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario: u?.nombre }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
      cargarInventarios(); cargarInvActual(data.id);
    } catch (err) { setErrInv(err.message); }
    finally { setIniciandoInv(false); }
  };

  const cargarInvActual = async (id) => {
    setCargandoInv(true); setErrInv(null);
    try {
      const data = await fetch(`${API}/api/inventario/${id}`).then(r => r.json());
      setInvActual(data);
    } catch (err) { setErrInv(err.message); }
    finally { setCargandoInv(false); }
  };

  const actualizarItemInv = async (invId, itemId, stock_contado) => {
    try {
      await fetch(`${API}/api/inventario/${invId}/items/${itemId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stock_contado }),
      });
      setInvActual(prev => ({
        ...prev,
        items: prev.items.map(i => i.id === itemId ? { ...i, stock_contado } : i),
      }));
    } catch { /* ignore */ }
  };

  const finalizarInventario = async () => {
    if (!invActual) return;
    if (!window.confirm('¿Finalizar inventario? Los stocks del sistema se actualizarán con las cantidades contadas.')) return;
    const u = (() => { try { return JSON.parse(sessionStorage.getItem('usuario')); } catch { return null; } })();
    setFinalizandoInv(true); setErrInv(null);
    try {
      const res  = await fetch(`${API}/api/inventario/${invActual.id}/finalizar`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario: u?.nombre }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
      setInvActual(null); cargarInventarios(); cargarProductos();
      alert('Inventario finalizado. Los stocks fueron actualizados.');
    } catch (err) { setErrInv(err.message); }
    finally { setFinalizandoInv(false); }
  };

  const obtenerSiguienteCodigo = async () => {
    setGenerandoCodigo(true);
    try {
      const data = await fetch(`${API}/api/productos/siguiente-codigo`).then(r => r.json());
      return data.codigo;
    } catch { return ''; }
    finally { setGenerandoCodigo(false); }
  };

  const abrirCrear = async () => {
    const codigo = await obtenerSiguienteCodigo();
    setForm({ ...FORM_VACIO, codigo });
    setEsEdicion(false); setIngresoStock(''); setErrorGuardado(null); setModalAbierto(true);
  };

  const abrirEditar = p => {
    setForm({
      codigo: p.codigo, nombre: p.nombre, descripcion: p.descripcion ?? '',
      categoria_id: p.categoria_id != null ? String(p.categoria_id) : '',
      marca: p.marca ?? '', stock_actual: String(parseFloat(p.stock_actual)),
      stock_minimo: String(parseFloat(p.stock_minimo)),
      proveedor_principal: p.proveedor_principal ?? '',
      precio_costo: String(parseFloat(p.precio_costo)),
      porcentaje_ganancia: String(parseFloat(p.porcentaje_ganancia)),
      unidad_medida: p.unidad_medida ?? 'unidades',
    });
    setStockActualBase(parseFloat(p.stock_actual));
    setIngresoStock('');
    setEsEdicion(true); setErrorGuardado(null); setModalAbierto(true);
  };

  const cerrar  = () => { setModalAbierto(false); setErrorGuardado(null); };
  const cambiar = (campo, valor) => setForm(f => ({ ...f, [campo]: valor }));

  const guardar = async () => {
    if (hayErrores) return;
    setGuardando(true); setErrorGuardado(null);
    const body = {
      nombre:              form.nombre.trim(),
      descripcion:         form.descripcion.trim() || null,
      categoria_id:        form.categoria_id !== '' ? parseInt(form.categoria_id) : null,
      marca:               form.marca.trim() || null,
      stock_minimo:        parseFloat(form.stock_minimo || 0),
      proveedor_principal: form.proveedor_principal || null,
      precio_costo:        parseFloat(form.precio_costo),
      porcentaje_ganancia: parseFloat(form.porcentaje_ganancia),
      unidad_medida:       form.unidad_medida,
    };
    if (!esEdicion) {
      body.codigo       = form.codigo.trim().toUpperCase();
      body.stock_actual = parseFloat(form.stock_actual || 0);
    }
    const url    = esEdicion ? `${API}/api/productos/${form.codigo}` : `${API}/api/productos`;
    const method = esEdicion ? 'PUT' : 'POST';
    try {
      const res  = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) {
        // Si código duplicado en crear, regenerar y mostrar error
        if (!esEdicion && res.status === 409) {
          const nuevo = await obtenerSiguienteCodigo();
          setForm(f => ({ ...f, codigo: nuevo }));
        }
        throw new Error(data.error ?? `Error ${res.status}`);
      }

      if (esEdicion && ingresoStock && parseFloat(ingresoStock) > 0) {
        const res2 = await fetch(`${API}/api/productos/${form.codigo}/ingreso-stock`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cantidad: parseFloat(ingresoStock) }),
        });
        const data2 = await res2.json();
        if (!res2.ok) throw new Error(data2.error ?? 'Error al actualizar stock');
      }

      cerrar(); cargarProductos();
    } catch (err) { setErrorGuardado(err.message); }
    finally      { setGuardando(false); }
  };

  const ingresoNum  = parseFloat(ingresoStock) || 0;
  const nuevoStock  = stockActualBase + ingresoNum;

  if (cargando) return <p className="estado-carga">Cargando productos...</p>;
  if (error)    return <p className="estado-error">Error: {error}</p>;

  return (
    <div>
      <div className="seccion-header">
        <h2>Productos <span className="total-registros">{productos.length}</span></h2>
        {tab === 'productos' && (
          <button className="btn-nuevo" onClick={abrirCrear} disabled={generandoCodigo}>
            {generandoCodigo ? 'Generando...' : '+ Nuevo producto'}
          </button>
        )}
        {tab === 'inventario' && !invActual && (
          <button className="btn-nuevo" onClick={iniciarInventario} disabled={iniciandoInv}>
            {iniciandoInv ? 'Iniciando...' : '+ Nuevo inventario'}
          </button>
        )}
      </div>

      <div className="seccion-tabs" style={{ marginBottom: 20 }}>
        <button className={`seccion-tab ${tab === 'productos'  ? 'activo' : ''}`} onClick={() => setTab('productos')}>📦 Productos</button>
        <button className={`seccion-tab ${tab === 'inventario' ? 'activo' : ''}`} onClick={() => setTab('inventario')}>📋 Inventario físico</button>
      </div>

      {/* ══ TAB PRODUCTOS ══ */}
      {tab === 'productos' && (
        <>
      {productos.length === 0 ? <p className="estado-carga">No hay productos cargados.</p> : (
        <div className="tabla-wrapper">
          <table>
            <thead><tr>
              <th>Código</th><th>Nombre</th><th>Categoría</th><th>Unidad</th><th>Marca</th>
              <th>Stock actual / mínimo</th><th>Precio costo</th><th>Precio venta</th><th>Estado</th><th></th>
            </tr></thead>
            <tbody>
              {productos.map(p => (
                <tr key={p.codigo}>
                  <td><code>{p.codigo}</code></td>
                  <td>{p.nombre}</td>
                  <td>{p.categoria_nombre ?? p.categoria ?? '—'}</td>
                  <td style={{ fontSize: 12, color: 'var(--texto-suave)' }}>{p.unidad_medida ?? 'unidades'}</td>
                  <td>{p.marca ?? '—'}</td>
                  <td style={{ textAlign: 'right' }}>
                    {parseFloat(p.stock_actual).toLocaleString('es-AR')}
                    <span className="stock-minimo"> / {parseFloat(p.stock_minimo).toLocaleString('es-AR')}</span>
                  </td>
                  <td style={{ textAlign: 'right' }}>${parseFloat(p.precio_costo).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>${parseFloat(p.precio_venta).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                  <td>{badgeStock(p)}</td>
                  <td style={{ display: 'flex', gap: 4, flexWrap: 'nowrap' }}>
                    <button className="btn-editar" onClick={() => abrirEditar(p)}>Editar</button>
                    <button className="btn-editar" style={{ fontSize: 11, padding: '3px 7px' }} onClick={() => verHistorialPrecios(p)} title="Historial de precios">💲</button>
                    <button className="btn-editar" style={{ fontSize: 11, padding: '3px 7px' }} onClick={() => verMovimientosStock(p)} title="Movimientos de stock">📊</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
        </>
      )}

      {/* ══ TAB INVENTARIO FÍSICO ══ */}
      {tab === 'inventario' && (
        <div>
          {errInv && <p className="error-msg" style={{ marginBottom: 12 }}>{errInv}</p>}

          {invActual ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <strong>Inventario #{invActual.id}</strong>
                  <span style={{ marginLeft: 12, fontSize: 12, color: '#6b7280' }}>
                    Iniciado: {new Date(invActual.fecha).toLocaleDateString('es-AR')} — {invActual.usuario ?? 'N/A'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-secundario" onClick={() => setInvActual(null)}>← Volver</button>
                  <button className="btn btn-primary" onClick={finalizarInventario} disabled={finalizandoInv}
                    style={{ background: '#16a34a', boxShadow: '0 4px 12px rgba(22,163,74,.25)' }}>
                    {finalizandoInv ? 'Finalizando...' : '✓ Finalizar y ajustar stock'}
                  </button>
                </div>
              </div>
              <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 12 }}>
                Ingresá la cantidad contada para cada producto. Al finalizar, el stock del sistema se actualizará.
              </p>
              <div className="tabla-wrapper">
                <table>
                  <thead><tr>
                    <th>Código</th><th>Producto</th><th>Unidad</th>
                    <th style={{ textAlign: 'right' }}>Stock sistema</th>
                    <th style={{ textAlign: 'right' }}>Stock contado</th>
                    <th style={{ textAlign: 'right' }}>Diferencia</th>
                  </tr></thead>
                  <tbody>
                    {(invActual.items ?? []).map(item => {
                      const diff = parseFloat(item.stock_contado ?? item.stock_sistema) - parseFloat(item.stock_sistema);
                      return (
                        <tr key={item.id} style={Math.abs(diff) > 0.001 ? { background: diff < 0 ? 'rgba(220,38,38,.04)' : 'rgba(22,163,74,.04)' } : {}}>
                          <td><code>{item.producto_codigo}</code></td>
                          <td>{item.producto_nombre}</td>
                          <td style={{ fontSize: 12, color: '#6b7280' }}>{item.unidad_medida ?? 'unidades'}</td>
                          <td style={{ textAlign: 'right' }}>{parseFloat(item.stock_sistema).toLocaleString('es-AR')}</td>
                          <td style={{ textAlign: 'right' }}>
                            <input
                              type="number"
                              step="0.01"
                              defaultValue={item.stock_contado ?? item.stock_sistema}
                              style={{ width: 90, textAlign: 'right', border: '1px solid #d1d5db', borderRadius: 6, padding: '4px 8px' }}
                              onBlur={e => actualizarItemInv(invActual.id, item.id, parseFloat(e.target.value))}
                            />
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 600,
                            color: Math.abs(diff) < 0.001 ? '#6b7280' : diff < 0 ? '#dc2626' : '#16a34a' }}>
                            {Math.abs(diff) < 0.001 ? '—' : (diff > 0 ? '+' : '') + diff.toLocaleString('es-AR', { maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div>
              {cargandoInv && <p className="estado-carga">Cargando...</p>}
              {inventarios.length === 0 && !cargandoInv && (
                <p className="estado-carga">No hay inventarios registrados. Iniciá uno nuevo con el botón de arriba.</p>
              )}
              {inventarios.length > 0 && (
                <div className="tabla-wrapper">
                  <table>
                    <thead><tr>
                      <th>ID</th><th>Fecha</th><th>Usuario</th><th>Estado</th><th></th>
                    </tr></thead>
                    <tbody>
                      {inventarios.map(inv => (
                        <tr key={inv.id}>
                          <td>#{inv.id}</td>
                          <td>{new Date(inv.fecha).toLocaleDateString('es-AR')}</td>
                          <td>{inv.usuario ?? '—'}</td>
                          <td>
                            <span className="badge" style={inv.estado === 'Finalizado'
                              ? { background: '#e6f9f0', color: '#1a8a4a' }
                              : { background: '#fef9c3', color: '#854d0e' }}>
                              {inv.estado}
                            </span>
                          </td>
                          <td>
                            {inv.estado === 'En curso' && (
                              <button className="btn-editar" onClick={() => cargarInvActual(inv.id)}>
                                Continuar
                              </button>
                            )}
                            {inv.estado === 'Finalizado' && (
                              <button className="btn-editar" onClick={() => cargarInvActual(inv.id)}>
                                Ver
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Modal historial de precios ── */}
      {modalHistPrecios && (
        <Modal titulo={`Historial de precios — ${modalHistPrecios.nombre}`} onCerrar={() => setModalHistPrecios(null)} ancho={560}>
          {cargandoHistPrecios && <p style={{ color: '#6b7280', padding: 16 }}>Cargando...</p>}
          {!cargandoHistPrecios && histPreciosData.length === 0 && (
            <p style={{ color: '#9ca3af', padding: 16, textAlign: 'center' }}>Sin cambios de precio registrados.</p>
          )}
          {!cargandoHistPrecios && histPreciosData.length > 0 && (
            <div className="tabla-wrapper">
              <table>
                <thead><tr>
                  <th>Fecha</th>
                  <th style={{ textAlign: 'right' }}>Precio anterior</th>
                  <th style={{ textAlign: 'right' }}>Precio nuevo</th>
                  <th>Usuario</th>
                </tr></thead>
                <tbody>
                  {histPreciosData.map(h => (
                    <tr key={h.id}>
                      <td style={{ fontSize: 12 }}>{new Date(h.fecha).toLocaleString('es-AR')}</td>
                      <td style={{ textAlign: 'right', color: '#dc2626' }}>${parseFloat(h.precio_anterior).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                      <td style={{ textAlign: 'right', color: '#16a34a', fontWeight: 700 }}>${parseFloat(h.precio_nuevo).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                      <td style={{ color: '#6b7280', fontSize: 13 }}>{h.usuario ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="modal-footer">
            <button className="btn btn-secundario" onClick={() => setModalHistPrecios(null)}>Cerrar</button>
          </div>
        </Modal>
      )}

      {/* ── Modal movimientos de stock ── */}
      {modalMovStock && (
        <Modal titulo={`Movimientos de stock — ${modalMovStock.nombre}`} onCerrar={() => setModalMovStock(null)} ancho={640}>
          {cargandoMovStock && <p style={{ color: '#6b7280', padding: 16 }}>Cargando...</p>}
          {!cargandoMovStock && movStockData.length === 0 && (
            <p style={{ color: '#9ca3af', padding: 16, textAlign: 'center' }}>Sin movimientos registrados.</p>
          )}
          {!cargandoMovStock && movStockData.length > 0 && (
            <div className="tabla-wrapper">
              <table>
                <thead><tr>
                  <th>Fecha</th><th>Tipo</th>
                  <th style={{ textAlign: 'right' }}>Cant.</th>
                  <th style={{ textAlign: 'right' }}>Stock ant.</th>
                  <th style={{ textAlign: 'right' }}>Stock nuevo</th>
                  <th>Referencia</th>
                </tr></thead>
                <tbody>
                  {movStockData.map(m => (
                    <tr key={m.id}>
                      <td style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{new Date(m.fecha).toLocaleString('es-AR')}</td>
                      <td>
                        <span className="badge" style={{
                          background: m.tipo === 'Venta' ? '#fef2f2' : m.tipo === 'Ingreso' ? '#e6f9f0' : '#fef9c3',
                          color:      m.tipo === 'Venta' ? '#dc2626'  : m.tipo === 'Ingreso' ? '#16a34a' : '#854d0e',
                        }}>{m.tipo}</span>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600,
                        color: m.tipo === 'Venta' ? '#dc2626' : '#16a34a' }}>
                        {m.tipo === 'Venta' ? '−' : '+'}{parseFloat(m.cantidad).toLocaleString('es-AR', { maximumFractionDigits: 2 })}
                      </td>
                      <td style={{ textAlign: 'right', color: '#6b7280' }}>{parseFloat(m.stock_anterior).toLocaleString('es-AR', { maximumFractionDigits: 2 })}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{parseFloat(m.stock_nuevo).toLocaleString('es-AR', { maximumFractionDigits: 2 })}</td>
                      <td style={{ fontSize: 12, color: '#6b7280' }}>{m.referencia ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="modal-footer">
            <button className="btn btn-secundario" onClick={() => setModalMovStock(null)}>Cerrar</button>
          </div>
        </Modal>
      )}

      {modalAbierto && (
        <Modal titulo={esEdicion ? `Editar — ${form.codigo}` : 'Nuevo producto'} onCerrar={cerrar} ancho={640}>
          <div className="form-grid">

            {/* Código — solo lectura en crear, no editable en editar */}
            {!esEdicion && (
              <div className="form-group">
                <label>Código (auto-generado)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <code style={{
                    display: 'inline-block', background: 'var(--fondo)', border: '1.5px solid var(--borde)',
                    borderRadius: 'var(--radio-sm)', padding: '8px 14px', fontWeight: 700, fontSize: 15,
                    letterSpacing: 1.5, color: 'var(--naranja-oscuro)', minWidth: 100,
                  }}>
                    {generandoCodigo ? '...' : form.codigo}
                  </code>
                  <span style={{ fontSize: 12, color: 'var(--texto-suave)' }}>Se asigna automáticamente</span>
                </div>
              </div>
            )}

            <div className={`form-group ${!esEdicion ? '' : 'span-2'}`}>
              <label>Nombre *</label>
              <input value={form.nombre} onChange={e => cambiar('nombre', e.target.value)}
                className={errores.nombre ? 'error-campo' : ''} placeholder="Nombre del producto" autoFocus={esEdicion} />
              {errores.nombre && <span className="error-msg">{errores.nombre}</span>}
            </div>

            <div className="form-group span-2">
              <label>Descripción</label>
              <textarea value={form.descripcion} onChange={e => cambiar('descripcion', e.target.value)} rows={2} placeholder="Descripción opcional" />
            </div>

            <div className="form-group">
              <label>Marca</label>
              <input value={form.marca} onChange={e => cambiar('marca', e.target.value)} placeholder="Ej: Loma Negra" />
            </div>

            <div className="form-group">
              <label>Categoría</label>
              <select value={form.categoria_id} onChange={e => cambiar('categoria_id', e.target.value)}>
                <option value="">— Sin categoría —</option>
                {categorias.map(c => <option key={c.id} value={String(c.id)}>{c.nombre}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label>Unidad de medida</label>
              <select value={form.unidad_medida} onChange={e => cambiar('unidad_medida', e.target.value)}>
                {UNIDADES_MEDIDA.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>

            {/* Stock: diferente en crear vs editar */}
            {!esEdicion ? (
              <div className="form-group">
                <label>Stock inicial</label>
                <input type="number" value={form.stock_actual} onChange={e => cambiar('stock_actual', e.target.value)}
                  className={errores.stock_actual ? 'error-campo' : ''}
                  min="0"
                  step={UNIDADES_ENTERAS.includes(form.unidad_medida) ? '1' : '0.01'}
                  placeholder="0" />
                {errores.stock_actual && <span className="error-msg">{errores.stock_actual}</span>}
              </div>
            ) : (
              <div className="form-group">
                <label>Ingreso de stock</label>
                <input type="number"
                  min={UNIDADES_ENTERAS.includes(form.unidad_medida) ? '1' : '0.01'}
                  step={UNIDADES_ENTERAS.includes(form.unidad_medida) ? '1' : '0.01'}
                  value={ingresoStock}
                  onChange={e => setIngresoStock(e.target.value)}
                  className={errores.ingresoStock ? 'error-campo' : ''}
                  placeholder="Unidades a ingresar" />
                <p style={{ fontSize: 12, marginTop: 5, color: 'var(--texto-suave)' }}>
                  Stock actual: <strong style={{ color: 'var(--texto)' }}>{stockActualBase.toLocaleString('es-AR')}</strong>
                  {ingresoNum > 0 && (
                    <> → Nuevo stock: <strong style={{ color: 'var(--verde)' }}>{nuevoStock.toLocaleString('es-AR')}</strong></>
                  )}
                </p>
                {errores.ingresoStock && <span className="error-msg">{errores.ingresoStock}</span>}
              </div>
            )}

            <div className="form-group">
              <label>
                Stock mínimo
                <Tooltip texto="Cantidad mínima antes de reponer el producto." />
              </label>
              <input type="number" value={form.stock_minimo} onChange={e => cambiar('stock_minimo', e.target.value)}
                className={errores.stock_minimo ? 'error-campo' : ''}
                min="0"
                step={UNIDADES_ENTERAS.includes(form.unidad_medida) ? '1' : '0.01'} />
              {errores.stock_minimo && <span className="error-msg">{errores.stock_minimo}</span>}
            </div>

            <div className="form-group">
              <label>Precio de costo *</label>
              <input type="number" value={form.precio_costo} onChange={e => cambiar('precio_costo', e.target.value)}
                className={errores.precio_costo ? 'error-campo' : ''} placeholder="0.00" min="0.01" step="0.01" />
              {errores.precio_costo && <span className="error-msg">{errores.precio_costo}</span>}
            </div>

            <div className="form-group">
              <label>
                % Ganancia *
                <Tooltip texto="Se aplica sobre el precio de costo. Ej: 15% sobre $1.000 = $1.150 precio de venta." ancho={260} />
              </label>
              <input type="number" value={form.porcentaje_ganancia} onChange={e => cambiar('porcentaje_ganancia', e.target.value)}
                className={errores.porcentaje_ganancia ? 'error-campo' : ''} placeholder="0" min="0" max="100" step="0.01" />
              {errores.porcentaje_ganancia && <span className="error-msg">{errores.porcentaje_ganancia}</span>}
              {precioVentaPreview && !errores.precio_costo && !errores.porcentaje_ganancia && (
                <span className="preview-precio">
                  {precioVentaPreview.ganancia}% sobre ${precioVentaPreview.costo.toLocaleString('es-AR')} = ${parseFloat(precioVentaPreview.monto).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </span>
              )}
            </div>

            <div className="form-group span-2">
              <label>Proveedor principal</label>
              <select value={form.proveedor_principal} onChange={e => cambiar('proveedor_principal', e.target.value)}>
                <option value="">— Sin proveedor —</option>
                {proveedores.map(p => <option key={p.cuit} value={p.cuit}>{p.nombre} ({p.cuit})</option>)}
              </select>
            </div>
          </div>

          {errorGuardado && <p className="error-msg" style={{ marginTop: 14 }}>Error al guardar: {errorGuardado}</p>}
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
