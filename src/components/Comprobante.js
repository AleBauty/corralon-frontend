function fmt(n) {
  return parseFloat(n ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 2 });
}
function formatFecha(iso) {
  return new Date(iso).toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function Comprobante({ datos, tipo = 'venta', onCerrar }) {
  const esPresupuesto = tipo === 'presupuesto';
  const titulo        = esPresupuesto ? 'PRESUPUESTO' : 'COMPROBANTE DE VENTA';
  const nro           = datos.id;

  return (
    <div className="modal-overlay" onClick={onCerrar}>
      <div className="modal comp-modal" style={{ maxWidth: 680 }} onClick={e => e.stopPropagation()}>

        {/* Controles — ocultos al imprimir */}
        <div className="modal-header comp-no-print">
          <h3>{titulo} #{nro}</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn btn-primary"
              onClick={() => window.print()}
              style={{ fontSize: 13, padding: '6px 16px' }}
            >
              🖨 Imprimir
            </button>
            <button className="modal-cerrar" onClick={onCerrar}>×</button>
          </div>
        </div>

        {/* Área imprimible */}
        <div className="modal-body comp-print-area" id="comprobante-print">

          <div className="comp-header">
            <div className="comp-logo">🧱</div>
            <div className="comp-empresa-info">
              <h1 className="comp-nombre-empresa">Corralón Virgen de Punta Corral</h1>
              <p className="comp-empresa-dir">Tilcara, Jujuy &nbsp;|&nbsp; Tel: (0388) 495-0000</p>
              <p className="comp-subtitulo-tipo">{titulo}</p>
            </div>
            <div className="comp-meta">
              <p><strong>N°:</strong> {String(nro).padStart(6, '0')}</p>
              <p><strong>Fecha:</strong> {formatFecha(datos.fecha)}</p>
              {esPresupuesto && datos.fecha_vencimiento && (
                <p><strong>Vence:</strong> {formatFecha(datos.fecha_vencimiento)}</p>
              )}
            </div>
          </div>

          <div className="comp-section">
            <p className="comp-section-title">DATOS DEL CLIENTE</p>
            <div className="comp-grid-2">
              <div>
                <span className="comp-label">Nombre</span>
                <span className="comp-valor">{datos.cliente ?? 'Consumidor final'}</span>
              </div>
              {datos.dni_cliente && (
                <div>
                  <span className="comp-label">DNI</span>
                  <span className="comp-valor">{datos.dni_cliente}</span>
                </div>
              )}
              {datos.cliente_domicilio && (
                <div className="comp-span-2">
                  <span className="comp-label">Domicilio</span>
                  <span className="comp-valor">{datos.cliente_domicilio}</span>
                </div>
              )}
              {datos.cliente_telefono && (
                <div>
                  <span className="comp-label">Teléfono</span>
                  <span className="comp-valor">{datos.cliente_telefono}</span>
                </div>
              )}
            </div>
          </div>

          <div className="comp-section">
            <p className="comp-section-title">DETALLE</p>
            <table className="comp-tabla">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Descripción</th>
                  <th style={{ textAlign: 'right' }}>Cant.</th>
                  <th style={{ textAlign: 'right' }}>Precio unit.</th>
                  <th style={{ textAlign: 'right' }}>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {(datos.items ?? []).map((item, i) => (
                  <tr key={i}>
                    <td><code>{item.producto_codigo}</code></td>
                    <td>{item.producto ?? item.producto_codigo}</td>
                    <td style={{ textAlign: 'right' }}>{parseFloat(item.cantidad).toLocaleString('es-AR')}</td>
                    <td style={{ textAlign: 'right' }}>${fmt(item.precio_unitario)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>${fmt(item.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="comp-total-row">
            <span>TOTAL</span>
            <span className="comp-total-monto">${fmt(datos.total)}</span>
          </div>

          {!esPresupuesto && (
            <div className="comp-section comp-grid-2" style={{ marginTop: 16 }}>
              <div>
                <span className="comp-label">Forma de pago</span>
                <span className="comp-valor">{datos.forma_pago ?? '—'}</span>
              </div>
              <div>
                <span className="comp-label">Forma de entrega</span>
                <span className="comp-valor">{datos.forma_entrega ?? '—'}</span>
              </div>
              {datos.forma_entrega === 'Domicilio' && datos.direccion_entrega && (
                <div className="comp-span-2">
                  <span className="comp-label">Dirección de entrega</span>
                  <span className="comp-valor">{datos.direccion_entrega}</span>
                </div>
              )}
            </div>
          )}

          {datos.observaciones && (
            <div className="comp-section">
              <p className="comp-section-title">OBSERVACIONES</p>
              <p style={{ fontSize: 13, color: '#555' }}>{datos.observaciones}</p>
            </div>
          )}

          <div className="comp-footer">
            <p>¡Gracias por su compra!</p>
            <p>Corralón Virgen de Punta Corral — Tilcara, Jujuy</p>
          </div>
        </div>
      </div>
    </div>
  );
}
