import { useEffect, useState, useCallback } from 'react';
import Modal from './Modal';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3000';

function fmt(n) { return parseFloat(n ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 2 }); }
function fechaCorta(iso) {
  if (!iso) return '—';
  const [y, m, d] = String(iso).substring(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es-AR');
}

function badgeDeuda(dias) {
  if (dias < 7)  return { label: 'Reciente',    bg: '#e6f9f0', color: '#1a8a4a' };
  if (dias < 15) return { label: 'Por vencer',  bg: '#fef9c3', color: '#854d0e' };
  if (dias < 31) return { label: '⚠ Atrasado', bg: '#FEF3E8', color: '#D35400' };
  return               { label: '🔴 Vencido',  bg: '#FDEDEC', color: '#E74C3C' };
}

export default function CuentaCorriente() {
  const [clientes, setClientes]         = useState([]);
  const [cargando, setCargando]         = useState(true);
  const [error, setError]               = useState(null);
  const [clienteSel, setClienteSel]     = useState(null);

  // Detalle del cliente seleccionado
  const [deudas, setDeudas]             = useState([]);
  const [saldoCliente, setSaldoCliente] = useState(0);
  const [limiteCred, setLimiteCred]     = useState(50000);
  const [cargandoDet, setCargandoDet]   = useState(false);

  // Historial expandible
  const [mostrarHist, setMostrarHist]   = useState(false);
  const [movimientos, setMovimientos]   = useState([]);
  const [cargandoMov, setCargandoMov]   = useState(false);

  // Modal pago
  const [modalPago, setModalPago]       = useState(false);
  const [montoPago, setMontoPago]       = useState('');
  const [conceptoPago, setConceptoPago] = useState('');
  const [guardando, setGuardando]       = useState(false);
  const [errPago, setErrPago]           = useState(null);

  const cargarClientes = useCallback(() => {
    setCargando(true);
    fetch(`${API}/api/cuenta-corriente/clientes`)
      .then(r => r.ok ? r.json() : Promise.reject(`Error ${r.status}`))
      .then(data => { setClientes(data); setCargando(false); })
      .catch(err => { setError(String(err)); setCargando(false); });
  }, []);

  useEffect(() => { cargarClientes(); }, [cargarClientes]);

  const seleccionarCliente = useCallback(async cli => {
    setClienteSel(cli);
    setCargandoDet(true); setDeudas([]); setMostrarHist(false); setMovimientos([]);
    try {
      const data = await fetch(`${API}/api/cuenta-corriente/${cli.dni}/deudas`).then(r => r.json());
      setDeudas(data.deudas ?? []);
      setSaldoCliente(parseFloat(data.saldo ?? 0));
      setLimiteCred(parseFloat(data.limite_credito ?? 50000));
    } catch { /* silencioso */ }
    finally { setCargandoDet(false); }
  }, []);

  const verHistorial = async () => {
    if (mostrarHist) { setMostrarHist(false); return; }
    setMostrarHist(true);
    if (movimientos.length) return;
    setCargandoMov(true);
    try {
      const data = await fetch(`${API}/api/cuenta-corriente/${clienteSel.dni}/movimientos`).then(r => r.json());
      setMovimientos(data.movimientos ?? []);
    } catch { /* silencioso */ }
    finally { setCargandoMov(false); }
  };

  const abrirPago = () => {
    setMontoPago(fmt(saldoCliente).replace(/\./g, '').replace(',', '.'));
    setConceptoPago(''); setErrPago(null); setModalPago(true);
  };

  const registrarPago = async () => {
    const monto = parseFloat(montoPago);
    if (!monto || monto <= 0) { setErrPago('Ingresá un monto válido'); return; }
    if (monto > saldoCliente + 0.01) {
      setErrPago(`El pago ($${fmt(monto)}) supera la deuda ($${fmt(saldoCliente)}). Máximo: $${fmt(saldoCliente)}`);
      return;
    }
    setGuardando(true); setErrPago(null);
    try {
      const res  = await fetch(`${API}/api/cuenta-corriente/pago`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dni_cliente: clienteSel.dni, monto, concepto: conceptoPago || 'Pago' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
      setModalPago(false);
      cargarClientes();
      // Recargar detalle
      const det = await fetch(`${API}/api/cuenta-corriente/${clienteSel.dni}/deudas`).then(r => r.json());
      setDeudas(det.deudas ?? []);
      setSaldoCliente(parseFloat(det.saldo ?? 0));
      setLimiteCred(parseFloat(det.limite_credito ?? 50000));
      // Resetear historial para forzar recarga
      setMovimientos([]); setMostrarHist(false);
    } catch (err) { setErrPago(err.message); }
    finally       { setGuardando(false); }
  };

  if (cargando) return <p className="estado-carga">Cargando cuentas corrientes...</p>;
  if (error)    return <p className="estado-error">Error: {error}</p>;

  const disponible    = Math.max(0, limiteCred - saldoCliente);
  const pctUsado      = limiteCred > 0 ? Math.min(100, (saldoCliente / limiteCred) * 100) : 0;
  const colorLimite   = pctUsado >= 90 ? 'var(--rojo)' : pctUsado >= 70 ? 'var(--amarillo)' : 'var(--verde)';

  const deudaDeudas   = deudas.filter(d => parseFloat(d.saldo_pendiente) > 0);

  return (
    <div>
      <div className="seccion-header"><h2>Cuenta Corriente</h2></div>

      <div className="cc-layout">

        {/* ── Panel izquierdo: lista de clientes CC ────────────── */}
        <div className="cc-panel-clientes">
          <p className="cc-panel-titulo">
            Clientes CC
            <span style={{ fontWeight: 400, fontSize: 12, marginLeft: 6, color: 'var(--texto-suave)' }}>
              ({clientes.length})
            </span>
          </p>

          {clientes.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--texto-suave)', padding: '12px 0' }}>
              No hay clientes tipo "Cuenta corriente".
            </p>
          ) : clientes.map(c => {
            const saldo  = parseFloat(c.saldo ?? 0);
            const activo = clienteSel?.dni === c.dni;
            return (
              <div key={c.dni} className={`cc-cliente-item ${activo ? 'activo' : ''}`}
                onClick={() => seleccionarCliente(c)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div className="cc-cliente-nombre">
                    {c.tiene_deuda_atrasada && <span style={{ color: '#D35400', marginRight: 4 }}>⚠</span>}
                    {c.nombre_apellido}
                  </div>
                </div>
                <div className="cc-cliente-dni">DNI {c.dni}</div>
                <div className="cc-saldo-badge"
                  style={saldo > 0
                    ? { background: 'var(--rojo-fondo)', color: 'var(--rojo)' }
                    : { background: 'var(--verde-fondo)', color: 'var(--verde)' }}>
                  {saldo > 0 ? `Debe $${fmt(saldo)}` : '✓ Al día'}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Panel derecho: detalle ────────────────────────────── */}
        <div className="cc-panel-detalle">
          {!clienteSel ? (
            <div className="cc-vacio">
              <span style={{ fontSize: 40 }}>💳</span>
              <p>Seleccioná un cliente para ver su cuenta corriente</p>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="cc-detalle-header">
                <div>
                  <p className="cc-detalle-nombre">{clienteSel.nombre_apellido}</p>
                  <p className="cc-detalle-sub">
                    DNI {clienteSel.dni}
                    {clienteSel.telefono ? ` · ${clienteSel.telefono}` : ''}
                  </p>
                </div>
                <button className="btn btn-primary" style={{ fontSize: 13, padding: '8px 18px' }}
                  onClick={abrirPago} disabled={saldoCliente <= 0}>
                  + Registrar pago
                </button>
              </div>

              {cargandoDet ? (
                <p className="estado-carga" style={{ padding: '24px 0' }}>Cargando...</p>
              ) : (
                <>
                  {/* ── RESUMEN ─────────────────────────────────── */}
                  <div className="cc-resumen-grid">
                    <div className="cc-resumen-card" style={{ borderColor: saldoCliente > 0 ? 'rgba(231,76,60,0.25)' : 'rgba(39,174,96,0.25)' }}>
                      <p className="cc-resumen-label">Saldo deudor</p>
                      <p className="cc-resumen-valor" style={{ color: saldoCliente > 0 ? 'var(--rojo)' : 'var(--verde)' }}>
                        ${fmt(saldoCliente)}
                      </p>
                      <p className="cc-resumen-sub">{saldoCliente > 0 ? 'A pagar' : 'Sin deuda ✓'}</p>
                    </div>
                    <div className="cc-resumen-card">
                      <p className="cc-resumen-label">Límite de crédito</p>
                      <p className="cc-resumen-valor">${fmt(limiteCred)}</p>
                      <p className="cc-resumen-sub">Asignado</p>
                    </div>
                    <div className="cc-resumen-card" style={{ borderColor: disponible < limiteCred * 0.1 ? 'rgba(231,76,60,0.25)' : 'rgba(39,174,96,0.25)' }}>
                      <p className="cc-resumen-label">Disponible</p>
                      <p className="cc-resumen-valor" style={{ color: disponible < limiteCred * 0.1 ? 'var(--rojo)' : 'var(--verde)' }}>
                        ${fmt(disponible)}
                      </p>
                      <p className="cc-resumen-sub">{pctUsado.toFixed(0)}% utilizado</p>
                    </div>
                  </div>

                  {/* Barra de crédito */}
                  {limiteCred > 0 && (
                    <div style={{ marginBottom: 24 }}>
                      <div className="cc-limite-bar-wrap">
                        <div className="cc-limite-bar-fill" style={{ width: `${pctUsado}%`, background: colorLimite }} />
                      </div>
                      {pctUsado >= 90 && (
                        <p style={{ fontSize: 12, color: 'var(--rojo)', marginTop: 4, fontWeight: 700 }}>
                          ⚠ Límite casi agotado ({pctUsado.toFixed(0)}%)
                        </p>
                      )}
                    </div>
                  )}

                  {/* ── DEUDAS INDIVIDUALES ──────────────────────── */}
                  <p className="form-section-titulo" style={{ marginBottom: 12 }}>
                    Deudas individuales
                    {deudaDeudas.length > 0 && (
                      <span style={{ background: 'var(--rojo-fondo)', color: 'var(--rojo)', borderRadius: 20, padding: '2px 10px', fontSize: 12, fontWeight: 700, marginLeft: 8 }}>
                        {deudaDeudas.length}
                      </span>
                    )}
                  </p>

                  {deudas.length === 0 ? (
                    <p className="estado-carga" style={{ padding: '12px 0' }}>✓ Sin deudas registradas.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                      {deudas.map(d => {
                        const badge   = badgeDeuda(parseInt(d.dias_transcurridos ?? 0));
                        const pendiente = parseFloat(d.saldo_pendiente ?? 0);
                        const pagado    = parseFloat(d.debe ?? 0) - pendiente;
                        const cancelada = pendiente <= 0.01;
                        return (
                          <div key={d.id} className="cc-deuda-card" style={{ opacity: cancelada ? 0.6 : 1 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                              <div>
                                <span className="badge" style={{ background: badge.bg, color: badge.color, marginRight: 8 }}>
                                  {badge.label}
                                </span>
                                <span style={{ fontSize: 12, color: 'var(--texto-suave)' }}>
                                  Hace {d.dias_transcurridos} días · {fechaCorta(d.fecha)}
                                </span>
                                {d.venta_id && (
                                  <span style={{ fontSize: 12, color: 'var(--texto-suave)', marginLeft: 8 }}>
                                    — Venta #{d.venta_id}
                                  </span>
                                )}
                              </div>
                              {cancelada
                                ? <span className="badge" style={{ background: '#e6f9f0', color: '#1a8a4a' }}>✓ Cancelada</span>
                                : <span style={{ fontWeight: 800, fontSize: 15, color: 'var(--rojo)' }}>${fmt(pendiente)}</span>
                              }
                            </div>
                            <div style={{ display: 'flex', gap: 24, marginTop: 8, fontSize: 13 }}>
                              <span style={{ color: 'var(--texto-suave)' }}>
                                Monto original: <strong style={{ color: 'var(--texto)' }}>${fmt(d.debe)}</strong>
                              </span>
                              {pagado > 0.01 && (
                                <span style={{ color: 'var(--verde)' }}>
                                  Pagado: <strong>${fmt(pagado)}</strong>
                                </span>
                              )}
                              {!cancelada && (
                                <span style={{ color: 'var(--rojo)' }}>
                                  Pendiente: <strong>${fmt(pendiente)}</strong>
                                </span>
                              )}
                            </div>
                            <p style={{ fontSize: 12, color: 'var(--texto-suave)', marginTop: 4 }}>{d.concepto}</p>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* ── HISTORIAL COMPLETO (expandible) ─────────── */}
                  <button className="btn btn-secundario" style={{ fontSize: 12, marginBottom: 12 }}
                    onClick={verHistorial}>
                    {mostrarHist ? '▲ Ocultar historial' : '▼ Ver historial completo de movimientos'}
                  </button>

                  {mostrarHist && (
                    cargandoMov ? <p className="estado-carga">Cargando historial...</p>
                    : movimientos.length === 0 ? <p className="estado-carga">Sin movimientos.</p>
                    : (
                      <div className="tabla-wrapper">
                        <table>
                          <thead><tr>
                            <th>Fecha</th><th>Concepto</th>
                            <th style={{ textAlign: 'right' }}>Debe</th>
                            <th style={{ textAlign: 'right' }}>Haber</th>
                            <th style={{ textAlign: 'right' }}>Saldo</th>
                          </tr></thead>
                          <tbody>
                            {[...movimientos].reverse().map(m => {
                              const saldoAcum = parseFloat(m.saldo_acumulado ?? 0);
                              return (
                                <tr key={m.id}>
                                  <td style={{ whiteSpace: 'nowrap' }}>{fechaCorta(m.fecha)}</td>
                                  <td style={{ fontSize: 13 }}>{m.concepto ?? '—'}</td>
                                  <td style={{ textAlign: 'right', color: parseFloat(m.debe) > 0 ? 'var(--rojo)' : 'var(--texto-suave)', fontWeight: parseFloat(m.debe) > 0 ? 700 : 400 }}>
                                    {parseFloat(m.debe) > 0 ? `$${fmt(m.debe)}` : '—'}
                                  </td>
                                  <td style={{ textAlign: 'right', color: parseFloat(m.haber) > 0 ? 'var(--verde)' : 'var(--texto-suave)', fontWeight: parseFloat(m.haber) > 0 ? 700 : 400 }}>
                                    {parseFloat(m.haber) > 0 ? `$${fmt(m.haber)}` : '—'}
                                  </td>
                                  <td style={{ textAlign: 'right', fontWeight: 700, color: saldoAcum > 0 ? 'var(--rojo)' : 'var(--verde)' }}>
                                    ${fmt(Math.abs(saldoAcum))}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Modal pago ─────────────────────────────────────────── */}
      {modalPago && (
        <Modal titulo={`Registrar pago — ${clienteSel?.nombre_apellido}`} onCerrar={() => setModalPago(false)} ancho={440}>
          <div style={{ background: 'var(--rojo-fondo)', border: '1px solid rgba(231,76,60,0.2)', borderRadius: 'var(--radio)', padding: '12px 16px', marginBottom: 20 }}>
            <p style={{ fontSize: 13, margin: 0 }}>
              Deuda total: <strong style={{ color: 'var(--rojo)', fontSize: 16 }}>${fmt(saldoCliente)}</strong>
              <span style={{ fontSize: 12, color: 'var(--texto-suave)', marginLeft: 10 }}>
                (máximo a pagar)
              </span>
            </p>
          </div>
          <div className="form-grid">
            <div className="form-group span-2">
              <label>Monto del pago *</label>
              <input type="number" min="0.01" step="0.01" max={saldoCliente}
                value={montoPago} onChange={e => setMontoPago(e.target.value)}
                placeholder={`Máx. $${fmt(saldoCliente)}`} autoFocus />
            </div>
            <div className="form-group span-2">
              <label>Concepto</label>
              <input value={conceptoPago} onChange={e => setConceptoPago(e.target.value)}
                placeholder="Ej: Pago parcial, Saldo total" />
            </div>
          </div>
          {errPago && <p className="error-msg" style={{ marginTop: 12 }}>{errPago}</p>}
          <div className="modal-footer">
            <button className="btn btn-secundario" onClick={() => setModalPago(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={registrarPago} disabled={guardando}>
              {guardando ? 'Registrando...' : 'Registrar pago'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
