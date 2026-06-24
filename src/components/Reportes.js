import { useState, useEffect, useCallback } from 'react';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3000';

function fmt(n)    { return parseFloat(n ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 2 }); }
function fmtCant(n) { return parseFloat(n ?? 0).toLocaleString('es-AR', { maximumFractionDigits: 2 }); }
function fechaCorta(iso) {
  if (!iso) return '—';
  const [y, m, d] = String(iso).substring(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es-AR');
}
function fechaHora(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function hoy() { return new Date().toISOString().substring(0, 10); }
function haceDias(n) {
  const d = new Date(); d.setDate(d.getDate() - n);
  return d.toISOString().substring(0, 10);
}

// ── KPI Card ──────────────────────────────────────────────────────
function KpiCard({ label, valor, sub, color }) {
  return (
    <div style={{ background: 'var(--blanco)', border: '1px solid var(--borde)', borderRadius: 'var(--radio-lg)', padding: '18px 22px', boxShadow: 'var(--sombra-sm)', flex: 1, minWidth: 140 }}>
      <p style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--texto-suave)', marginBottom: 6 }}>{label}</p>
      <p style={{ fontSize: 26, fontWeight: 900, color: color || 'var(--naranja-oscuro)', letterSpacing: -0.5, margin: 0 }}>{valor}</p>
      {sub && <p style={{ fontSize: 12, color: 'var(--texto-suave)', marginTop: 3 }}>{sub}</p>}
    </div>
  );
}

// ── Reporte 1: Ventas por período ─────────────────────────────────
function ReporteVentas() {
  const [desde, setDesde] = useState(haceDias(30));
  const [hasta, setHasta] = useState(hoy());
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError]       = useState(null);

  const consultar = useCallback(async () => {
    if (!desde || !hasta) return;
    setCargando(true); setError(null);
    try {
      const data = await fetch(`${API}/api/reportes/ventas?desde=${desde}&hasta=${hasta}`).then(r => r.json());
      if (data.error) throw new Error(data.error);
      setDatos(data);
    } catch (err) { setError(err.message); }
    finally { setCargando(false); }
  }, [desde, hasta]);

  useEffect(() => { consultar(); }, [consultar]);

  const maxDia = datos?.ventas_por_dia?.length
    ? Math.max(...datos.ventas_por_dia.map(d => d.total), 1)
    : 1;

  return (
    <div>
      {/* Filtros */}
      <div className="asist-filtros" style={{ marginBottom: 24 }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Desde</label>
          <input type="date" value={desde} onChange={e => setDesde(e.target.value)} />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Hasta</label>
          <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} />
        </div>
        <button className="btn btn-primary" onClick={consultar} disabled={cargando}>
          {cargando ? 'Consultando...' : 'Consultar'}
        </button>
      </div>

      {error && <p className="error-msg" style={{ marginBottom: 16 }}>{error}</p>}

      {datos && (
        <>
          {/* KPIs */}
          <div style={{ display: 'flex', gap: 16, marginBottom: 28, flexWrap: 'wrap' }}>
            <KpiCard label="Total facturado" valor={`$${fmt(datos.total_facturado)}`} />
            <KpiCard label="Cantidad de ventas" valor={datos.cantidad_ventas} color="var(--verde)" />
            <KpiCard label="Ticket promedio"
              valor={datos.cantidad_ventas > 0 ? `$${fmt(datos.total_facturado / datos.cantidad_ventas)}` : '—'}
              color="var(--texto-medio)" />
          </div>

          {/* Gráfico de barras */}
          {datos.ventas_por_dia.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <p className="form-section-titulo">Ventas por día</p>
              <div className="grafico-barras">
                {datos.ventas_por_dia.map(d => (
                  <div key={d.fecha} className="grafico-bar-wrap" title={`${fechaCorta(d.fecha)}: $${fmt(d.total)}`}>
                    <span className="grafico-bar-monto">${Math.round(d.total / 1000) > 0 ? `${Math.round(d.total / 1000)}k` : fmt(d.total)}</span>
                    <div className="grafico-bar" style={{ height: `${Math.max((d.total / maxDia) * 130, 4)}px` }} />
                    <span className="grafico-bar-fecha">{d.fecha.substring(5)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tabla */}
          {datos.ventas.length === 0
            ? <p className="estado-carga">Sin ventas en el período seleccionado.</p>
            : (
              <div className="tabla-wrapper">
                <table>
                  <thead><tr>
                    <th>#</th><th>Fecha</th><th>Cliente</th><th>Forma de pago</th><th>Entrega</th><th style={{ textAlign: 'right' }}>Total</th><th>Estado</th>
                  </tr></thead>
                  <tbody>
                    {datos.ventas.map(v => (
                      <tr key={v.id}>
                        <td style={{ color: '#aaa', fontSize: 12 }}>#{v.id}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>{fechaHora(v.fecha)}</td>
                        <td>{v.cliente ?? 'Consumidor final'}</td>
                        <td>{v.forma_pago ?? '—'}</td>
                        <td>{v.forma_entrega ?? '—'}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>${fmt(v.total)}</td>
                        <td><span className="badge" style={v.estado === 'Entregada' ? { background: '#eef2ff', color: '#3730a3' } : { background: '#e6f9f0', color: '#1a8a4a' }}>{v.estado}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
        </>
      )}
    </div>
  );
}

// ── Reporte 2: Productos más vendidos ────────────────────────────
function ReporteProductos() {
  const [datos, setDatos]       = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    fetch(`${API}/api/reportes/productos-mas-vendidos`)
      .then(r => r.json())
      .then(setDatos)
      .finally(() => setCargando(false));
  }, []);

  const maxCant = datos.length ? Math.max(...datos.map(d => parseFloat(d.cantidad_total)), 1) : 1;

  if (cargando) return <p className="estado-carga">Cargando...</p>;
  if (!datos.length) return <p className="estado-carga">Sin datos de ventas registradas.</p>;

  return (
    <div>
      <p style={{ color: 'var(--texto-suave)', fontSize: 13, marginBottom: 20 }}>
        Top 10 productos por cantidad vendida — histórico completo
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {datos.map((d, i) => {
          const pct = Math.round((parseFloat(d.cantidad_total) / maxCant) * 100);
          return (
            <div key={d.producto_codigo}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>
                  <span style={{ color: 'var(--texto-suave)', fontSize: 11, marginRight: 8 }}>#{i + 1}</span>
                  {d.nombre}
                  <code style={{ marginLeft: 8, fontSize: 11, color: 'var(--texto-suave)' }}>{d.producto_codigo}</code>
                </span>
                <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--naranja-oscuro)' }}>
                  {fmtCant(d.cantidad_total)} uds — ${fmt(d.ingresos_total)}
                </span>
              </div>
              <div className="progreso-barra">
                <div className="progreso-fill" style={{ width: `${pct}%`, minWidth: pct > 0 ? 4 : 0 }}>
                  {pct > 10 && `${pct}%`}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Reporte 3: Asistencias ────────────────────────────────────────
function ReporteAsistencias() {
  const [empleados, setEmpleados] = useState([]);
  const [dni, setDni]             = useState('');
  const [desde, setDesde]         = useState(haceDias(30));
  const [hasta, setHasta]         = useState(hoy());
  const [datos, setDatos]         = useState(null);
  const [cargando, setCargando]   = useState(false);

  useEffect(() => {
    fetch(`${API}/api/empleados`).then(r => r.json()).then(setEmpleados).catch(() => {});
  }, []);

  const consultar = async () => {
    setCargando(true);
    const params = new URLSearchParams();
    if (dni)   params.set('dni',   dni);
    if (desde) params.set('desde', desde);
    if (hasta) params.set('hasta', hasta);
    try {
      const data = await fetch(`${API}/api/reportes/asistencias?${params}`).then(r => r.json());
      setDatos(data);
    } catch { setDatos(null); }
    finally { setCargando(false); }
  };

  return (
    <div>
      <div className="asist-filtros" style={{ marginBottom: 24 }}>
        <div className="form-group" style={{ marginBottom: 0, minWidth: 220 }}>
          <label>Empleado</label>
          <select value={dni} onChange={e => setDni(e.target.value)}>
            <option value="">— Todos —</option>
            {empleados.map(e => <option key={e.dni} value={e.dni}>{e.nombre}</option>)}
          </select>
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Desde</label>
          <input type="date" value={desde} onChange={e => setDesde(e.target.value)} />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Hasta</label>
          <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} />
        </div>
        <button className="btn btn-primary" onClick={consultar} disabled={cargando}>
          {cargando ? '...' : 'Consultar'}
        </button>
      </div>

      {datos && (
        <>
          <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
            <KpiCard label="Horas trabajadas" valor={`${datos.total_horas}h`} />
            <KpiCard label="Días con registros" valor={datos.dias_trabajados} color="var(--verde)" />
            <KpiCard label="Empleados" valor={datos.empleados_count} color="var(--texto-medio)" />
          </div>

          {datos.asistencias.length === 0
            ? <p className="estado-carga">Sin asistencias en el período.</p>
            : (
              <div className="tabla-wrapper">
                <table>
                  <thead><tr>
                    <th>Empleado</th><th>Fecha</th><th>Entrada</th><th>Salida</th><th style={{ textAlign: 'right' }}>Horas</th>
                  </tr></thead>
                  <tbody>
                    {datos.asistencias.map(a => (
                      <tr key={a.id}>
                        <td style={{ fontWeight: 500 }}>{a.empleado ?? a.dni_empleado}</td>
                        <td>{fechaCorta(a.fecha)}</td>
                        <td className="asist-hora-entrada">{a.hora_entrada ? String(a.hora_entrada).substring(0, 5) : '—'}</td>
                        <td className="asist-hora-salida">{a.hora_salida ? String(a.hora_salida).substring(0, 5) : <em style={{ color: '#aaa' }}>En curso</em>}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>
                          {a.horas_trabajadas ? `${parseFloat(a.horas_trabajadas).toLocaleString('es-AR', { minimumFractionDigits: 1 })}h` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
        </>
      )}
    </div>
  );
}

// ── Reporte 4: Stock crítico ──────────────────────────────────────
function ReporteStock() {
  const [productos, setProductos] = useState([]);
  const [cargando, setCargando]   = useState(true);
  const [generando, setGenerando] = useState(false);
  const [msgPedido, setMsgPedido] = useState(null);

  const cargar = useCallback(() => {
    setCargando(true);
    fetch(`${API}/api/reportes/stock-critico`)
      .then(r => r.json())
      .then(d => { setProductos(d); setCargando(false); })
      .catch(() => setCargando(false));
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const generarPedidos = async () => {
    const conProveedor = productos.filter(p => p.proveedor_principal);
    if (!conProveedor.length) { setMsgPedido('⚠ Ningún producto tiene proveedor asignado.'); return; }

    const grupos = {};
    conProveedor.forEach(p => {
      if (!grupos[p.proveedor_principal]) grupos[p.proveedor_principal] = [];
      grupos[p.proveedor_principal].push(p);
    });

    const totalGrupos = Object.keys(grupos).length;
    if (!window.confirm(`¿Crear ${totalGrupos} pedido(s) automático(s) a ${totalGrupos} proveedor(es)?`)) return;

    setGenerando(true); setMsgPedido(null);
    let creados = 0;

    for (const [cuit, prods] of Object.entries(grupos)) {
      const items = prods.map(p => ({
        producto_codigo:  p.codigo,
        cantidad:         Math.max(parseFloat(p.stock_minimo) - parseFloat(p.stock_actual), 1),
        precio_unitario:  parseFloat(p.precio_costo || 0),
      }));
      try {
        const res = await fetch(`${API}/api/pedidos`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            proveedor_cuit: cuit,
            observaciones: `Generado automáticamente — Stock crítico ${new Date().toLocaleDateString('es-AR')}`,
            items,
          }),
        });
        if (res.ok) creados++;
      } catch { /* continuar */ }
    }

    setGenerando(false);
    setMsgPedido(`✓ Se crearon ${creados} de ${totalGrupos} pedidos. Revisá la sección Pedidos.`);
    cargar();
  };

  if (cargando) return <p className="estado-carga">Cargando stock crítico...</p>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <p style={{ fontSize: 13, color: 'var(--texto-suave)' }}>
          {productos.length === 0
            ? '✓ Todos los productos tienen stock suficiente.'
            : `${productos.length} producto(s) con stock igual o por debajo del mínimo`}
        </p>
        {productos.length > 0 && (
          <button className="btn btn-primary" onClick={generarPedidos} disabled={generando}
            style={{ background: 'var(--rojo)', boxShadow: '0 4px 12px rgba(231,76,60,0.3)' }}>
            {generando ? 'Generando...' : `⚡ Generar pedido automático (${productos.filter(p => p.proveedor_principal).length} prods.)`}
          </button>
        )}
      </div>

      {msgPedido && (
        <p className={`asist-msg ${msgPedido.startsWith('✓') ? 'asist-msg-ok' : 'asist-msg-error'}`} style={{ marginBottom: 16 }}>
          {msgPedido}
        </p>
      )}

      {productos.length > 0 && (
        <div className="tabla-wrapper">
          <table>
            <thead><tr>
              <th>Código</th><th>Producto</th><th>Categoría</th><th>Proveedor</th>
              <th style={{ textAlign: 'right' }}>Stock actual</th>
              <th style={{ textAlign: 'right' }}>Stock mínimo</th>
              <th style={{ textAlign: 'right' }}>Diferencia</th>
            </tr></thead>
            <tbody>
              {productos.map(p => {
                const dif = parseFloat(p.diferencia ?? 0);
                const urgente = dif < 0;
                return (
                  <tr key={p.codigo} style={urgente ? { background: 'rgba(231,76,60,0.04)' } : {}}>
                    <td><code>{p.codigo}</code></td>
                    <td style={{ fontWeight: 600 }}>
                      {urgente && <span style={{ color: 'var(--rojo)', marginRight: 6 }}>⚠</span>}
                      {p.nombre}
                    </td>
                    <td style={{ color: 'var(--texto-medio)', fontSize: 13 }}>{p.categoria_nombre ?? '—'}</td>
                    <td style={{ fontSize: 13 }}>{p.proveedor_nombre ?? <em style={{ color: '#aaa' }}>Sin proveedor</em>}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: urgente ? 'var(--rojo)' : 'var(--amarillo)' }}>
                      {fmtCant(p.stock_actual)}
                    </td>
                    <td style={{ textAlign: 'right', color: 'var(--texto-medio)' }}>{fmtCant(p.stock_minimo)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: urgente ? 'var(--rojo)' : 'var(--amarillo)' }}>
                      {dif > 0 ? '+' : ''}{fmtCant(dif)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Reporte 5: Rentabilidad por producto ─────────────────────────
function ReporteRentabilidad() {
  const [datos, setDatos]       = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    fetch(`${API}/api/reportes/rentabilidad-productos`)
      .then(r => r.json())
      .then(d => { setDatos(Array.isArray(d) ? d : []); setCargando(false); })
      .catch(() => setCargando(false));
  }, []);

  if (cargando) return <p className="estado-carga">Cargando...</p>;
  if (!datos.length) return <p className="estado-carga">Sin datos de ventas.</p>;

  const totalGanancia = datos.reduce((a, d) => a + parseFloat(d.ganancia_total ?? 0), 0);
  const totalIngresos = datos.reduce((a, d) => a + parseFloat(d.ingresos_total ?? 0), 0);

  return (
    <div>
      <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <KpiCard label="Ingresos totales" valor={`$${fmt(totalIngresos)}`} />
        <KpiCard label="Ganancia total" valor={`$${fmt(totalGanancia)}`} color="var(--verde)" />
        <KpiCard label="Margen promedio"
          valor={totalIngresos > 0 ? `${((totalGanancia / totalIngresos) * 100).toFixed(1)}%` : '—'}
          color="var(--texto-medio)" />
      </div>
      <div className="tabla-wrapper">
        <table>
          <thead><tr>
            <th>Producto</th>
            <th style={{ textAlign: 'right' }}>Cant. vendida</th>
            <th style={{ textAlign: 'right' }}>Precio costo</th>
            <th style={{ textAlign: 'right' }}>Precio venta</th>
            <th style={{ textAlign: 'right' }}>Ingresos</th>
            <th style={{ textAlign: 'right' }}>Ganancia</th>
            <th style={{ textAlign: 'right' }}>Margen</th>
          </tr></thead>
          <tbody>
            {datos.map(d => {
              const gan  = parseFloat(d.ganancia_total ?? 0);
              const ing  = parseFloat(d.ingresos_total ?? 0);
              const margen = ing > 0 ? (gan / ing * 100).toFixed(1) : '0.0';
              return (
                <tr key={d.producto_codigo}>
                  <td style={{ fontWeight: 500 }}>
                    {d.nombre}
                    <code style={{ marginLeft: 6, fontSize: 10, color: 'var(--texto-suave)' }}>{d.producto_codigo}</code>
                  </td>
                  <td style={{ textAlign: 'right' }}>{fmtCant(d.cantidad_vendida)}</td>
                  <td style={{ textAlign: 'right' }}>${fmt(d.precio_costo)}</td>
                  <td style={{ textAlign: 'right' }}>${fmt(d.precio_venta)}</td>
                  <td style={{ textAlign: 'right' }}>${fmt(d.ingresos_total)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: gan >= 0 ? 'var(--verde)' : 'var(--rojo)' }}>
                    ${fmt(gan)}
                  </td>
                  <td style={{ textAlign: 'right', color: parseFloat(margen) >= 20 ? 'var(--verde)' : 'var(--amarillo)' }}>
                    {margen}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Reporte 6: Ranking clientes ───────────────────────────────────
function ReporteRankingClientes() {
  const [datos, setDatos]       = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    fetch(`${API}/api/reportes/ranking-clientes`)
      .then(r => r.json())
      .then(d => { setDatos(Array.isArray(d) ? d : []); setCargando(false); })
      .catch(() => setCargando(false));
  }, []);

  if (cargando) return <p className="estado-carga">Cargando...</p>;
  if (!datos.length) return <p className="estado-carga">Sin datos.</p>;

  const maxTotal = Math.max(...datos.map(d => parseFloat(d.total_comprado ?? 0)), 1);

  return (
    <div>
      <p style={{ color: 'var(--texto-suave)', fontSize: 13, marginBottom: 20 }}>
        Clientes ordenados por volumen de compras — histórico completo
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {datos.map((d, i) => {
          const total = parseFloat(d.total_comprado ?? 0);
          const pct   = Math.round((total / maxTotal) * 100);
          return (
            <div key={d.dni_cliente}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>
                  <span style={{ color: 'var(--texto-suave)', fontSize: 11, marginRight: 8 }}>#{i + 1}</span>
                  {d.cliente}
                  <code style={{ marginLeft: 8, fontSize: 11, color: 'var(--texto-suave)' }}>{d.dni_cliente}</code>
                </span>
                <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--naranja-oscuro)' }}>
                  ${fmt(total)} — {d.cantidad_compras} compras
                </span>
              </div>
              <div className="progreso-barra">
                <div className="progreso-fill" style={{ width: `${pct}%`, minWidth: pct > 0 ? 4 : 0 }}>
                  {pct > 10 && `${pct}%`}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Reporte 7: Deudores CC ────────────────────────────────────────
function ReporteDeudores() {
  const [datos, setDatos]       = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    fetch(`${API}/api/reportes/deudores`)
      .then(r => r.json())
      .then(d => { setDatos(Array.isArray(d) ? d : []); setCargando(false); })
      .catch(() => setCargando(false));
  }, []);

  if (cargando) return <p className="estado-carga">Cargando...</p>;
  if (!datos.length) return <p className="estado-carga" style={{ color: 'var(--verde)' }}>✓ No hay deudores en cuenta corriente.</p>;

  const totalDeuda = datos.reduce((a, d) => a + parseFloat(d.saldo_total ?? 0), 0);

  return (
    <div>
      <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <KpiCard label="Total deuda CC" valor={`$${fmt(totalDeuda)}`} color="var(--rojo)" />
        <KpiCard label="Clientes deudores" valor={datos.length} color="var(--texto-medio)" />
      </div>
      <div className="tabla-wrapper">
        <table>
          <thead><tr>
            <th>Cliente</th><th>Teléfono</th>
            <th style={{ textAlign: 'right' }}>Límite CC</th>
            <th style={{ textAlign: 'right' }}>Saldo deuda</th>
            <th style={{ textAlign: 'right' }}>% límite</th>
            <th>Deuda más antigua</th>
          </tr></thead>
          <tbody>
            {datos.map(d => {
              const saldo  = parseFloat(d.saldo_total ?? 0);
              const limite = parseFloat(d.limite_credito ?? 0);
              const pct    = limite > 0 ? (saldo / limite * 100).toFixed(0) : '—';
              const urgente = limite > 0 && saldo > limite;
              const warning = limite > 0 && saldo > limite * 0.8 && !urgente;
              return (
                <tr key={d.dni_cliente} style={urgente ? { background: 'rgba(231,76,60,0.04)' } : {}}>
                  <td style={{ fontWeight: 600 }}>
                    {urgente && '🔴 '}{warning && '⚠ '}
                    {d.cliente}
                    <code style={{ marginLeft: 6, fontSize: 10, color: 'var(--texto-suave)' }}>{d.dni_cliente}</code>
                  </td>
                  <td>{d.telefono ?? '—'}</td>
                  <td style={{ textAlign: 'right' }}>{limite > 0 ? `$${fmt(limite)}` : '—'}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--rojo)' }}>${fmt(saldo)}</td>
                  <td style={{ textAlign: 'right', color: urgente ? 'var(--rojo)' : warning ? 'var(--amarillo)' : 'var(--texto-medio)' }}>
                    {pct !== '—' ? `${pct}%` : '—'}
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--texto-suave)' }}>{fechaCorta(d.deuda_mas_antigua)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────
const TABS_REPORTE = [
  { id: 'ventas',          label: '📊 Ventas por período' },
  { id: 'productos',       label: '🏆 Más vendidos' },
  { id: 'rentabilidad',    label: '💰 Rentabilidad' },
  { id: 'ranking',         label: '👥 Ranking clientes' },
  { id: 'deudores',        label: '🔴 Deudores CC' },
  { id: 'asistencias',     label: '⏰ Asistencias' },
  { id: 'stock',           label: '⚠ Stock crítico' },
];

export default function Reportes() {
  const [tab, setTab] = useState('ventas');

  return (
    <div>
      <div className="seccion-header">
        <h2>Reportes</h2>
      </div>

      <div className="seccion-tabs" style={{ marginBottom: 28 }}>
        {TABS_REPORTE.map(t => (
          <button key={t.id} className={`seccion-tab ${tab === t.id ? 'activo' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'ventas'       && <ReporteVentas />}
      {tab === 'productos'    && <ReporteProductos />}
      {tab === 'rentabilidad' && <ReporteRentabilidad />}
      {tab === 'ranking'      && <ReporteRankingClientes />}
      {tab === 'deudores'     && <ReporteDeudores />}
      {tab === 'asistencias'  && <ReporteAsistencias />}
      {tab === 'stock'        && <ReporteStock />}
    </div>
  );
}
