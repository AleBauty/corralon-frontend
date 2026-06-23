import { useState, useEffect } from 'react';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3000';

function KpiCard({ icono, titulo, valor, sub, color }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 14, padding: '20px 24px',
      boxShadow: '0 2px 12px rgba(0,0,0,0.07)', border: `2px solid ${color}22`,
      display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 180px', minWidth: 160,
    }}>
      <div style={{ fontSize: 28 }}>{icono}</div>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>{titulo}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color }}>{valor}</div>
      {sub && <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

export default function Dashboard() {
  const [kpis,   setKpis]   = useState(null);
  const [dolar,  setDolar]  = useState(null);
  const [errDolar, setErrDolar] = useState('');

  useEffect(() => {
    const cargarKpis = async () => {
      try {
        const [productos, ventas, clientes] = await Promise.all([
          fetch(`${API}/api/productos`).then(r => r.json()),
          fetch(`${API}/api/ventas`).then(r => r.json()),
          fetch(`${API}/api/clientes`).then(r => r.json()),
        ]);

        const hoy       = new Date();
        const mesActual = hoy.getMonth();
        const anioActual= hoy.getFullYear();

        const ventasMes = ventas.filter(v => {
          const f = new Date(v.fecha);
          return f.getMonth() === mesActual && f.getFullYear() === anioActual;
        });

        const totalMes     = ventasMes.reduce((s, v) => s + parseFloat(v.total || 0), 0);
        const bajStock     = productos.filter(p => parseFloat(p.stock_actual) <= parseFloat(p.stock_minimo));
        const clientesActivos = clientes.length;

        setKpis({
          totalProductos: productos.length,
          totalMes,
          cantVentasMes: ventasMes.length,
          clientesActivos,
          bajStock: bajStock.length,
        });
      } catch { /* silencioso */ }
    };

    const cargarDolar = async () => {
      try {
        const res = await fetch(`${API}/api/reportes/dolar`);
        const data = await res.json();
        const results = data?.results;
        if (results?.length) {
          setDolar({ valor: results[0].valor, fecha: results[0].fecha });
        } else {
          setErrDolar('Sin datos disponibles');
        }
      } catch {
        setErrDolar('No disponible');
      }
    };

    cargarKpis();
    cargarDolar();
  }, []);

  const fmt  = n => parseFloat(n ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 2 });
  const fmtN = n => Number(n ?? 0).toLocaleString('es-AR');

  const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  const mesNombre = meses[new Date().getMonth()];

  return (
    <div>
      <div className="seccion-header">
        <h2>Dashboard</h2>
      </div>

      {/* KPIs */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 28 }}>
        <KpiCard
          icono="🧱"
          titulo="Total productos"
          valor={kpis ? fmtN(kpis.totalProductos) : '—'}
          color="#3b82f6"
        />
        <KpiCard
          icono="🧾"
          titulo={`Ventas de ${mesNombre}`}
          valor={kpis ? `$${fmt(kpis.totalMes)}` : '—'}
          sub={kpis ? `${kpis.cantVentasMes} operaciones` : ''}
          color="#10b981"
        />
        <KpiCard
          icono="👤"
          titulo="Clientes"
          valor={kpis ? fmtN(kpis.clientesActivos) : '—'}
          color="#8b5cf6"
        />
        <KpiCard
          icono="⚠"
          titulo="Bajo stock"
          valor={kpis ? fmtN(kpis.bajStock) : '—'}
          sub={kpis?.bajStock > 0 ? 'Requieren reposición' : 'Todo en orden ✓'}
          color={kpis?.bajStock > 0 ? '#ef4444' : '#10b981'}
        />
      </div>

      {/* Dólar oficial */}
      <div style={{
        background: '#fff', borderRadius: 14, padding: '20px 28px',
        boxShadow: '0 2px 12px rgba(0,0,0,0.07)', border: '2px solid #f59e0b22',
        display: 'inline-flex', flexDirection: 'column', gap: 6, minWidth: 260,
      }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          💵 Dólar oficial BCRA
        </div>
        {dolar ? (
          <>
            <div style={{ fontSize: 30, fontWeight: 800, color: '#f59e0b' }}>
              ${parseFloat(dolar.valor).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>
              Actualizado: {dolar.fecha}
            </div>
          </>
        ) : (
          <div style={{ fontSize: 16, color: '#94a3b8', marginTop: 4 }}>
            {errDolar || 'Consultando...'}
          </div>
        )}
      </div>
    </div>
  );
}
