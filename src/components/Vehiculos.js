import { useEffect, useState, useCallback, useRef } from 'react';
import Modal from './Modal';

const API     = process.env.REACT_APP_API_URL || 'http://localhost:3000';
const ORS_KEY = 'eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6ImFlMWU5NDE4ZWM0YjRjOWZiOWNiN2RlMzQ0ZjgzNWNhIiwiaCI6Im11cm11cjY0In0=';
const ORIGEN  = [-65.2561, -24.3960]; // [lng, lat] El Carmen, Jujuy — coordenadas precisas
const JUJUY   = { latMin: -25, latMax: -21, lngMin: -67, lngMax: -64 };

/* ─────────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────────────── */
function fmt(n) { return parseFloat(n ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 2 }); }
function fechaCorta(iso) {
  if (!iso) return '—';
  const [y, m, d] = String(iso).substring(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es-AR');
}
function fechaLarga(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371, r = Math.PI / 180;
  const dLat = (lat2 - lat1) * r, dLng = (lng2 - lng1) * r;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*r) * Math.cos(lat2*r) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function dirDisplay(p) {
  if (p.direccion_calle?.trim()) {
    return `${p.direccion_calle.trim()}${p.direccion_nro ? ' ' + p.direccion_nro.trim() : ''}, ${p.direccion_ciudad?.trim() || 'El Carmen'}`;
  }
  return p.direccion_entrega ?? '—';
}

const ESTADOS_VEH = ['Disponible', 'En reparto', 'En mantenimiento'];
const FORM_VACIO  = { patente: '', tipo: '', marca: '', modelo: '', anio: '', estado: 'Disponible', kilometraje_actual: '' };
const FORM_MANT   = { tipo: '', descripcion: '', fecha: new Date().toISOString().substring(0, 10), costo: '', kilometraje: '', proximo_service: '', estado: 'Realizado' };
const TIPOS_MANT  = ['Service', 'Reparación', 'Cambio de aceite', 'Cambio de neumáticos', 'Revisión técnica', 'Otro'];

const ESTADO_ESTILO = {
  'Disponible':       { background: '#dcfce7', color: '#166534' },
  'En reparto':       { background: '#eef2ff', color: '#3730a3' },
  'En mantenimiento': { background: '#fef9c3', color: '#854d0e' },
};

/* ─────────────────────────────────────────────────────────
   MAPA MULTI-PARADA (Leaflet)
───────────────────────────────────────────────────────── */
function MapaMultiRuta({ paradas, rutaGeoJSON }) {
  const mapRef  = useRef(null);
  const mapInst = useRef(null);

  useEffect(() => {
    const L = window.L;
    if (!L || !mapRef.current || !paradas.length) return;
    if (mapInst.current) { mapInst.current.remove(); mapInst.current = null; }

    const map = L.map(mapRef.current);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
    }).addTo(map);
    mapInst.current = map;

    const origenIcon = L.divIcon({
      className: '',
      html: `<div style="width:34px;height:34px;background:#1e293b;color:white;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:17px;border:2.5px solid white;box-shadow:0 2px 8px rgba(0,0,0,.4)">🧱</div>`,
      iconSize: [34, 34], iconAnchor: [17, 17],
    });
    L.marker([ORIGEN[1], ORIGEN[0]], { icon: origenIcon }).addTo(map)
      .bindPopup('<strong>Corralón — El Carmen, Jujuy</strong>');

    paradas.forEach((p, i) => {
      const n = i + 1;
      const stopIcon = L.divIcon({
        className: '',
        html: `<div style="width:28px;height:28px;background:#f97316;color:white;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px;border:2.5px solid white;box-shadow:0 2px 8px rgba(0,0,0,.3)">${n}</div>`,
        iconSize: [28, 28], iconAnchor: [14, 14],
      });
      L.marker([p.lat, p.lng], { icon: stopIcon }).addTo(map)
        .bindPopup(`<strong>Parada ${n}</strong><br>${p.cliente ?? 'Sin cliente'}<br><small>${dirDisplay(p)}</small>`);
    });

    if (rutaGeoJSON) {
      const layer = L.geoJSON(rutaGeoJSON, {
        style: { color: '#f97316', weight: 4, opacity: 0.85 },
      }).addTo(map);
      map.fitBounds(layer.getBounds(), { padding: [28, 28] });
    } else {
      const bounds = [[ORIGEN[1], ORIGEN[0]], ...paradas.map(p => [p.lat, p.lng])];
      map.fitBounds(bounds, { padding: [28, 28] });
    }

    return () => { if (mapInst.current) { mapInst.current.remove(); mapInst.current = null; } };
  }, [paradas, rutaGeoJSON]);

  return <div ref={mapRef} style={{ height: 360, borderRadius: 10, overflow: 'hidden' }} />;
}

/* ─────────────────────────────────────────────────────────
   HOJA DE RUTA IMPRIMIBLE (div oculto)
───────────────────────────────────────────────────────── */
function HojaRutaImprimible({ vehiculo, paradas, totalKm, totalMin }) {
  const hoy = new Date().toLocaleDateString('es-AR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

  return (
    <div id="hoja-ruta-print">
      {/* Encabezado */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, borderBottom: '3px solid #f97316', paddingBottom: 20, marginBottom: 24 }}>
        <span style={{ fontSize: 50, lineHeight: 1 }}>🧱</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#1e293b', letterSpacing: -0.5 }}>Corralón Virgen de Punta Corral</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>El Carmen, Jujuy · Sistema de Gestión v1.0</div>
        </div>
        <div style={{ textAlign: 'right', fontSize: 13, lineHeight: 1.8, color: '#1e293b' }}>
          <div><strong>Fecha:</strong> {hoy}</div>
          <div><strong>Vehículo:</strong> {vehiculo.patente}{vehiculo.tipo ? ` — ${vehiculo.tipo}` : ''}</div>
          {vehiculo.marca && <div><strong>{vehiculo.marca} {vehiculo.modelo ?? ''}</strong> {vehiculo.anio ?? ''}</div>}
        </div>
      </div>

      <div style={{ fontSize: 16, fontWeight: 800, color: '#f97316', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 20 }}>
        Orden de visitas — {paradas.length} parada{paradas.length !== 1 ? 's' : ''}
      </div>

      {paradas.map((p, i) => (
        <div key={p.id} className="parada-print-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#1e293b', color: 'white', padding: '10px 18px', borderRadius: '8px 8px 0 0', marginBottom: 0 }}>
            <div style={{ width: 30, height: 30, background: '#f97316', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 15, flexShrink: 0 }}>{i + 1}</div>
            <span style={{ fontWeight: 800, fontSize: 15, letterSpacing: 0.3 }}>PARADA {i + 1}</span>
            {p.distKm && <span style={{ marginLeft: 'auto', fontSize: 12, opacity: 0.8 }}>📍 {p.distKm} km · ~{p.durMin} min desde parada anterior</span>}
          </div>

          <div style={{ border: '2px solid #e2e8f0', borderTop: 'none', borderRadius: '0 0 8px 8px', padding: '16px 20px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <tbody>
                <tr><td style={{ width: 130, fontWeight: 700, paddingBottom: 8, color: '#475569' }}>Cliente:</td><td style={{ fontWeight: 600 }}>{p.cliente ?? 'Consumidor final'}</td></tr>
                {p.cliente_dni && <tr><td style={{ fontWeight: 700, paddingBottom: 8, color: '#475569' }}>DNI:</td><td>{p.cliente_dni}</td></tr>}
                <tr><td style={{ fontWeight: 700, paddingBottom: 8, color: '#475569' }}>Domicilio:</td><td style={{ fontWeight: 700, color: '#1e293b' }}>{p.direccion_entrega}</td></tr>
                {p.cliente_telefono && <tr><td style={{ fontWeight: 700, paddingBottom: 8, color: '#475569' }}>Teléfono:</td><td>{p.cliente_telefono}</td></tr>}
              </tbody>
            </table>

            {p.items?.length > 0 && (
              <div style={{ marginTop: 14, borderTop: '1px solid #e2e8f0', paddingTop: 12 }}>
                <div style={{ fontWeight: 800, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.6, color: '#f97316', marginBottom: 8 }}>Productos a entregar:</div>
                <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.9 }}>
                  {p.items.map((item, idx) => (
                    <li key={idx}>{item.producto} — <strong>x {parseFloat(item.cantidad).toLocaleString('es-AR')}</strong></li>
                  ))}
                </ul>
              </div>
            )}

            <div style={{ marginTop: 20, paddingTop: 14, borderTop: '1px dashed #cbd5e1', display: 'flex', alignItems: 'center', gap: 8 }}>
              <strong style={{ fontSize: 13 }}>Firma de recepción:</strong>
              <span style={{ flex: 1, borderBottom: '1.5px solid #94a3b8', marginBottom: 3 }}>&nbsp;</span>
              <span style={{ fontSize: 13, color: '#94a3b8' }}>Aclaración:</span>
              <span style={{ flex: 1, borderBottom: '1.5px solid #94a3b8', marginBottom: 3 }}>&nbsp;</span>
            </div>
          </div>
        </div>
      ))}

      {/* Resumen */}
      <div style={{ marginTop: 32, border: '2px solid #1e293b', borderRadius: 10, padding: '18px 24px', background: '#f8fafc' }}>
        <div style={{ fontWeight: 800, fontSize: 14, color: '#1e293b', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.6 }}>Resumen del recorrido</div>
        <div style={{ display: 'flex', gap: 40 }}>
          <div><span style={{ color: '#64748b' }}>Total de paradas:</span> <strong>{paradas.length}</strong></div>
          <div><span style={{ color: '#64748b' }}>Distancia total:</span> <strong>{totalKm} km</strong></div>
          <div><span style={{ color: '#64748b' }}>Tiempo estimado:</span> <strong>~{totalMin} min</strong></div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   COMPONENTE PRINCIPAL
───────────────────────────────────────────────────────── */
export default function Vehiculos() {
  const [tab, setTab] = useState('flota');

  // ── Flota ──────────────────────────────────────────────
  const [vehiculos,  setVehiculos]  = useState([]);
  const [pendientes, setPendientes] = useState([]);
  const [cargando,   setCargando]   = useState(true);
  const [error,      setError]      = useState(null);

  // ── Modal CRUD vehículo ────────────────────────────────
  const [modalVeh,   setModalVeh]   = useState(false);
  const [esEdicion,  setEsEdicion]  = useState(false);
  const [form,       setForm]       = useState(FORM_VACIO);
  const [editId,     setEditId]     = useState(null);
  const [guardando,  setGuardando]  = useState(false);
  const [errVeh,     setErrVeh]     = useState(null);

  // ── Modal asignar entregas ─────────────────────────────
  const [modalAsignar,  setModalAsignar]  = useState(null); // vehiculo obj
  const [seleccionadas, setSeleccionadas] = useState(new Set());
  const [asignando,     setAsignando]     = useState(false);
  const [errAsignar,    setErrAsignar]    = useState(null);

  // ── Modal ruta optimizada ──────────────────────────────
  const [modalRuta,      setModalRuta]      = useState(null); // vehiculo obj
  const [calculandoRuta, setCalculandoRuta] = useState(false);
  const [errRuta,        setErrRuta]        = useState('');
  const [rutaData,       setRutaData]       = useState(null);
  const [entregandoTodas, setEntregandoTodas] = useState(false);

  // ── Detalle de entrega individual ─────────────────────
  const [detalleEntrega,      setDetalleEntrega]      = useState(null);
  const [cargandoDetalle,     setCargandoDetalle]     = useState(false);
  const [marcandoEntregada,   setMarcandoEntregada]   = useState(false);
  const [errDetalle,          setErrDetalle]          = useState(null);

  // ── Mantenimiento ──────────────────────────────────────
  const [vehSelMant,    setVehSelMant]    = useState('');
  const [historial,     setHistorial]     = useState([]);
  const [cargandoMant,  setCargandoMant]  = useState(false);
  const [modalMant,     setModalMant]     = useState(false);
  const [formMant,      setFormMant]      = useState(FORM_MANT);
  const [guardandoMant, setGuardandoMant] = useState(false);
  const [errMant,       setErrMant]       = useState(null);

  /* ── Carga de datos ──────────────────────────────────── */
  const cargarVehiculos = useCallback(() => {
    fetch(`${API}/api/vehiculos`)
      .then(r => r.ok ? r.json() : Promise.reject(`Error ${r.status}`))
      .then(data => { setVehiculos(data); setCargando(false); })
      .catch(err  => { setError(String(err)); setCargando(false); });
  }, []);

  const cargarPendientes = useCallback(() => {
    fetch(`${API}/api/vehiculos/ventas-pendientes`)
      .then(r => r.ok ? r.json() : [])
      .then(setPendientes)
      .catch(() => {});
  }, []);

  const cargarHistorial = useCallback(async (vid) => {
    if (!vid) { setHistorial([]); return; }
    setCargandoMant(true);
    try {
      const data = await fetch(`${API}/api/mantenimiento?vehiculo_id=${vid}`).then(r => r.json());
      setHistorial(Array.isArray(data) ? data : []);
    } catch { setHistorial([]); }
    finally   { setCargandoMant(false); }
  }, []);

  useEffect(() => { cargarVehiculos(); cargarPendientes(); }, [cargarVehiculos, cargarPendientes]);
  useEffect(() => { if (vehSelMant) cargarHistorial(vehSelMant); else setHistorial([]); }, [vehSelMant, cargarHistorial]);

  /* ── CRUD vehículo ───────────────────────────────────── */
  const abrirCrear = () => {
    setForm(FORM_VACIO); setEsEdicion(false); setEditId(null); setErrVeh(null); setModalVeh(true);
  };
  const abrirEditar = v => {
    setForm({
      patente: v.patente, tipo: v.tipo ?? '', marca: v.marca ?? '', modelo: v.modelo ?? '',
      anio: v.anio ?? '', estado: v.estado,
      kilometraje_actual: v.kilometraje_actual != null ? String(v.kilometraje_actual) : '',
    });
    setEsEdicion(true); setEditId(v.id); setErrVeh(null); setModalVeh(true);
  };
  const cambiar = (campo, val) => setForm(f => ({ ...f, [campo]: val }));

  const guardar = async () => {
    if (!form.patente.trim()) { setErrVeh('La patente es obligatoria'); return; }
    setGuardando(true); setErrVeh(null);
    const body = {
      tipo: form.tipo.trim() || null, marca: form.marca.trim() || null,
      modelo: form.modelo.trim() || null, anio: form.anio ? parseInt(form.anio, 10) : null,
      estado: form.estado,
      kilometraje_actual: form.kilometraje_actual ? parseInt(form.kilometraje_actual, 10) : null,
    };
    if (!esEdicion) body.patente = form.patente.trim();
    const url    = esEdicion ? `${API}/api/vehiculos/${editId}` : `${API}/api/vehiculos`;
    const method = esEdicion ? 'PUT' : 'POST';
    try {
      const res  = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
      setModalVeh(false); cargarVehiculos();
    } catch (err) { setErrVeh(err.message); }
    finally       { setGuardando(false); }
  };

  const liberar = async id => {
    if (!window.confirm('¿Liberar vehículo? Se marcarán todas sus entregas pendientes como entregadas.')) return;
    try {
      const res  = await fetch(`${API}/api/vehiculos/${id}/liberar`, { method: 'PUT' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      cargarVehiculos(); cargarPendientes();
    } catch (err) { alert('Error: ' + err.message); }
  };

  /* ── Asignación de entregas (multi-select) ───────────── */
  const abrirAsignar = v => {
    setModalAsignar(v);
    setSeleccionadas(new Set());
    setErrAsignar(null);
  };

  const toggleSel = id => {
    setSeleccionadas(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selAll = () => {
    const todos = pendientes.every(p => seleccionadas.has(p.id));
    setSeleccionadas(todos ? new Set() : new Set(pendientes.map(p => p.id)));
  };

  const confirmarAsignacion = async () => {
    if (!modalAsignar || !seleccionadas.size) return;
    setAsignando(true); setErrAsignar(null);
    try {
      const res  = await fetch(`${API}/api/vehiculos/${modalAsignar.id}/asignar`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ venta_ids: [...seleccionadas] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
      setModalAsignar(null);
      cargarVehiculos(); cargarPendientes();
    } catch (err) { setErrAsignar(err.message); }
    finally       { setAsignando(false); }
  };

  /* ── Ruta optimizada ─────────────────────────────────── */
  const calcularRuta = async (entregas) => {
    const conDireccion = entregas.filter(e => e.direccion_calle || e.direccion_entrega);
    if (!conDireccion.length) throw new Error('Ninguna entrega tiene dirección de domicilio registrada.');

    // 1. Geocodificar — focus en El Carmen, boundary Argentina, validar rango Jujuy
    const geoResultados = [];
    for (const p of conDireccion) {
      const calle  = p.direccion_calle?.trim() || '';
      const nro    = p.direccion_nro?.trim()   || '';
      const ciudad = p.direccion_ciudad?.trim() || 'El Carmen';
      const texto  = calle
        ? `${calle}${nro ? ' ' + nro : ''}, ${ciudad}, Jujuy, Argentina`
        : `${p.direccion_entrega}, Jujuy, Argentina`;

      let lng, lat;
      try {
        const res  = await fetch(
          `https://api.openrouteservice.org/geocode/search?api_key=${ORS_KEY}` +
          `&text=${encodeURIComponent(texto)}` +
          `&boundary.country=AR` +
          `&focus.point.lon=${ORIGEN[0]}` +
          `&focus.point.lat=${ORIGEN[1]}` +
          `&size=1`
        );
        const data = await res.json();
        if (!data.features?.length) {
          geoResultados.push({ ...p, geoError: `No se encontró el domicilio: "${dirDisplay(p)}"` });
          continue;
        }
        [lng, lat] = data.features[0].geometry.coordinates;
      } catch {
        geoResultados.push({ ...p, geoError: `Error de red geocodificando: "${dirDisplay(p)}"` });
        continue;
      }

      const esValido = !(lat === 0 && lng === 0) &&
        lat >= JUJUY.latMin && lat <= JUJUY.latMax &&
        lng >= JUJUY.lngMin && lng <= JUJUY.lngMax;

      if (!esValido) {
        geoResultados.push({ ...p, geoError: `No se encontró el domicilio: "${dirDisplay(p)}"` });
      } else {
        geoResultados.push({ ...p, lng, lat });
      }
    }

    const geoParadas  = geoResultados.filter(p => !p.geoError);
    const sinGeo      = geoResultados.filter(p =>  p.geoError);
    if (!geoParadas.length) throw new Error('No se pudo geocodificar ningún domicilio. Verificá las direcciones.');

    let paradasOrdenadas = [...geoParadas];

    // 2. Optimizar orden si hay más de 1 parada
    if (geoParadas.length > 1) {
      try {
        const optRes = await fetch('https://api.openrouteservice.org/optimization', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': ORS_KEY },
          body: JSON.stringify({
            jobs:     geoParadas.map((p, i) => ({ id: i, location: [p.lng, p.lat] })),
            vehicles: [{ id: 0, start: ORIGEN, end: ORIGEN }],
          }),
        });
        const optData = await optRes.json();
        if (optData.routes?.[0]?.steps) {
          const jobSteps = optData.routes[0].steps.filter(s => s.type === 'job');
          if (jobSteps.length === geoParadas.length)
            paradasOrdenadas = jobSteps.map(s => geoParadas[s.id]);
        }
      } catch { /* fallback al orden original */ }
    }

    // 3. Calcular ruta con geometry (ORIGEN → paradas → ORIGEN)
    const waypoints = [ORIGEN, ...paradasOrdenadas.map(p => [p.lng, p.lat]), ORIGEN];
    const routeRes  = await fetch(
      'https://api.openrouteservice.org/v2/directions/driving-car/geojson',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': ORS_KEY },
        body: JSON.stringify({ coordinates: waypoints }),
      }
    );
    const routeData = await routeRes.json();
    if (!routeData.features?.length) throw new Error('No se encontró ruta para estas direcciones.');

    const feature  = routeData.features[0];
    const summary  = feature.properties.summary;
    const segments = feature.properties.segments ?? [];

    // Anotar distancia/tiempo; si ORS devuelve 0 usar Haversine
    const paradasConStats = paradasOrdenadas.map((p, i) => {
      const seg = segments[i];
      let distKm = null, durMin = null, estimado = false;
      if (seg && parseFloat(seg.distance) > 0) {
        distKm = (seg.distance / 1000).toFixed(1);
        durMin = Math.round(seg.duration / 60);
      } else {
        const prevLat = i === 0 ? ORIGEN[1] : paradasOrdenadas[i - 1].lat;
        const prevLng = i === 0 ? ORIGEN[0] : paradasOrdenadas[i - 1].lng;
        distKm  = haversineKm(prevLat, prevLng, p.lat, p.lng).toFixed(1);
        estimado = true;
      }
      return { ...p, distKm, durMin, estimado };
    });

    return {
      paradasOrdenadas: paradasConStats,
      sinGeocodificar:  sinGeo,
      rutaGeoJSON:      feature,
      totalKm:          (summary.distance / 1000).toFixed(1),
      totalMin:         Math.round(summary.duration / 60),
    };
  };

  const abrirRuta = async (vehiculo) => {
    setModalRuta(vehiculo);
    setRutaData(null);
    setErrRuta('');
    setCalculandoRuta(true);
    try {
      const entregas = await fetch(`${API}/api/vehiculos/${vehiculo.id}/entregas`).then(r => r.json());
      if (!entregas.length) { setErrRuta('Este vehículo no tiene entregas asignadas actualmente.'); return; }
      const data = await calcularRuta(entregas);
      setRutaData(data);
    } catch (err) {
      setErrRuta(err.message || 'Error al calcular la ruta.');
    } finally {
      setCalculandoRuta(false);
    }
  };

  const imprimirHojaRuta = () => {
    const el = document.getElementById('hoja-ruta-print');
    if (!el) return;
    el.style.display = 'block';
    document.body.classList.add('print-hoja-ruta');
    window.print();
    document.body.classList.remove('print-hoja-ruta');
    el.style.display = 'none';
  };

  const handleEntregarTodas = async () => {
    if (!modalRuta) return;
    if (!window.confirm('¿Marcar todas las entregas de este vehículo como entregadas?')) return;
    setEntregandoTodas(true);
    try {
      const res  = await fetch(`${API}/api/vehiculos/${modalRuta.id}/entregar-todas`, { method: 'PUT' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
      setModalRuta(null); setRutaData(null);
      cargarVehiculos(); cargarPendientes();
    } catch (err) { setErrRuta(err.message); }
    finally       { setEntregandoTodas(false); }
  };

  /* ── Detalle entrega individual ──────────────────────── */
  const verDetalle = async venta => {
    setCargandoDetalle(true); setDetalleEntrega(null); setErrDetalle(null);
    try {
      const data = await fetch(`${API}/api/ventas/${venta.id}`).then(r => r.json());
      setDetalleEntrega(data);
    } catch { setErrDetalle('No se pudo cargar el detalle.'); }
    finally   { setCargandoDetalle(false); }
  };

  const marcarEntregada = async () => {
    if (!detalleEntrega) return;
    setMarcandoEntregada(true); setErrDetalle(null);
    try {
      const res  = await fetch(`${API}/api/ventas/${detalleEntrega.id}/entregar`, { method: 'PUT' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
      setDetalleEntrega(null); cargarVehiculos(); cargarPendientes();
    } catch (err) { setErrDetalle(err.message); }
    finally       { setMarcandoEntregada(false); }
  };

  /* ── Mantenimiento ───────────────────────────────────── */
  const abrirNuevoMant = () => {
    setFormMant({ ...FORM_MANT, fecha: new Date().toISOString().substring(0, 10) });
    setErrMant(null); setModalMant(true);
  };
  const cambiarMant = (campo, val) => setFormMant(f => ({ ...f, [campo]: val }));

  const guardarMant = async () => {
    if (!vehSelMant)    { setErrMant('Seleccioná un vehículo'); return; }
    if (!formMant.tipo) { setErrMant('Seleccioná el tipo de mantenimiento'); return; }
    setGuardandoMant(true); setErrMant(null);
    const body = {
      vehiculo_id:     parseInt(vehSelMant, 10),
      tipo:            formMant.tipo,
      descripcion:     formMant.descripcion.trim() || null,
      fecha:           formMant.fecha || null,
      costo:           formMant.costo ? parseFloat(formMant.costo) : null,
      kilometraje:     formMant.kilometraje ? parseInt(formMant.kilometraje, 10) : null,
      proximo_service: formMant.proximo_service ? parseInt(formMant.proximo_service, 10) : null,
      estado:          formMant.estado,
    };
    try {
      const res  = await fetch(`${API}/api/mantenimiento`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
      setModalMant(false); cargarHistorial(vehSelMant); cargarVehiculos();
    } catch (err) { setErrMant(err.message); }
    finally       { setGuardandoMant(false); }
  };

  /* ── Valores derivados ───────────────────────────────── */
  const vehMantObj     = vehiculos.find(v => String(v.id) === String(vehSelMant));
  const ultimoServKm   = historial.find(h => h.proximo_service != null)?.proximo_service;
  const kmActual       = vehMantObj?.kilometraje_actual;
  const alertaKm       = kmActual != null && ultimoServKm != null && kmActual >= ultimoServKm;

  if (cargando) return <p className="estado-carga">Cargando vehículos...</p>;
  if (error)    return <p className="estado-error">Error: {error}</p>;

  /* ════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════ */
  return (
    <div>
      <div className="seccion-header">
        <h2>Logística</h2>
        {tab === 'flota'         && <button className="btn-nuevo" onClick={abrirCrear}>+ Nuevo vehículo</button>}
        {tab === 'mantenimiento' && vehSelMant && (
          <button className="btn-nuevo" onClick={abrirNuevoMant}>+ Registrar mantenimiento</button>
        )}
      </div>

      <div className="seccion-tabs">
        <button className={`seccion-tab ${tab === 'flota'         ? 'activo' : ''}`} onClick={() => setTab('flota')}>🚚 Flota</button>
        <button className={`seccion-tab ${tab === 'mantenimiento' ? 'activo' : ''}`} onClick={() => setTab('mantenimiento')}>🔧 Mantenimiento</button>
      </div>

      {/* ══ TAB FLOTA ════════════════════════════════════════ */}
      {tab === 'flota' && (
        <>
          {vehiculos.length === 0
            ? <p className="estado-carga">No hay vehículos registrados.</p>
            : (
              <div className="tabla-wrapper">
                <table>
                  <thead><tr>
                    <th>Patente</th><th>Tipo</th><th>Marca / Modelo</th><th>Año</th>
                    <th>Km actual</th><th>Estado</th><th>Entregas</th><th></th>
                  </tr></thead>
                  <tbody>
                    {vehiculos.map(v => (
                      <tr key={v.id}>
                        <td><code style={{ fontWeight: 700, fontSize: 15, letterSpacing: 1 }}>{v.patente}</code></td>
                        <td>{v.tipo ?? '—'}</td>
                        <td>{[v.marca, v.modelo].filter(Boolean).join(' ') || '—'}</td>
                        <td>{v.anio ?? '—'}</td>
                        <td>{v.kilometraje_actual != null ? v.kilometraje_actual.toLocaleString('es-AR') + ' km' : '—'}</td>
                        <td><span className="badge" style={ESTADO_ESTILO[v.estado] ?? ESTADO_ESTILO['Disponible']}>{v.estado}</span></td>
                        <td>
                          {v.entregas_pendientes > 0
                            ? <span className="badge" style={{ background: '#eef2ff', color: '#3730a3', border: '1px solid rgba(55,48,163,0.2)' }}>
                                {v.entregas_pendientes} pendiente{v.entregas_pendientes !== 1 ? 's' : ''}
                              </span>
                            : <span style={{ color: 'var(--texto-suave)', fontSize: 13 }}>—</span>}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            <button className="btn-editar" onClick={() => abrirEditar(v)}>Editar</button>
                            {v.estado !== 'En mantenimiento' && (
                              <button className="btn-editar"
                                style={{ background: '#fff7ed', color: '#c2410c', borderColor: 'rgba(249,115,22,0.3)' }}
                                onClick={() => abrirAsignar(v)}>
                                📦 Asignar entregas
                              </button>
                            )}
                            {v.entregas_pendientes > 0 && (
                              <button className="btn-editar"
                                style={{ background: '#f0fdf4', color: '#15803d', borderColor: 'rgba(21,128,61,0.25)' }}
                                onClick={() => abrirRuta(v)}>
                                🗺 Ver ruta
                              </button>
                            )}
                            {v.estado === 'En reparto' && (
                              <button className="btn-editar"
                                style={{ background: '#dcfce7', color: '#166534', borderColor: 'rgba(22,101,52,0.25)' }}
                                onClick={() => liberar(v.id)}>
                                ✓ Liberar
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

          {/* Panel entregas sin asignar */}
          <div style={{ marginTop: 36 }}>
            <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--texto)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
              Entregas domicilio sin asignar
              {pendientes.length > 0 && (
                <span style={{ background: 'var(--rojo-fondo)', color: 'var(--rojo)', borderRadius: 20, padding: '2px 10px', fontSize: 12, fontWeight: 700 }}>
                  {pendientes.length}
                </span>
              )}
            </h3>
            {pendientes.length === 0
              ? <p className="estado-carga">No hay entregas pendientes sin asignar. ✓</p>
              : (
                <div className="tabla-wrapper">
                  <table>
                    <thead><tr>
                      <th>N° Venta</th><th>Fecha</th><th>Cliente</th><th>Dirección de entrega</th>
                      <th style={{ textAlign: 'right' }}>Total</th><th>Acciones</th>
                    </tr></thead>
                    <tbody>
                      {pendientes.map(v => (
                        <tr key={v.id}>
                          <td><code>#{String(v.id).padStart(4, '0')}</code></td>
                          <td style={{ whiteSpace: 'nowrap' }}>{fechaCorta(v.fecha)}</td>
                          <td>{v.cliente ?? 'Consumidor final'}</td>
                          <td><strong style={{ color: 'var(--naranja-oscuro)' }}>📍 {v.direccion_entrega ?? '—'}</strong></td>
                          <td style={{ textAlign: 'right', fontWeight: 700 }}>${fmt(v.total)}</td>
                          <td>
                            <button className="btn-editar"
                              style={{ background: '#f0f4ff', color: '#3730a3', borderColor: 'rgba(55,48,163,0.25)' }}
                              onClick={() => verDetalle(v)}>
                              🔍 Detalle
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            {cargandoDetalle && <p className="estado-carga">Cargando detalle...</p>}
          </div>
        </>
      )}

      {/* ══ TAB MANTENIMIENTO ════════════════════════════════ */}
      {tab === 'mantenimiento' && (
        <>
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', marginBottom: 24, flexWrap: 'wrap' }}>
            <div className="form-group" style={{ marginBottom: 0, minWidth: 260 }}>
              <label>Vehículo</label>
              <select value={vehSelMant} onChange={e => setVehSelMant(e.target.value)}>
                <option value="">— Seleccioná un vehículo —</option>
                {vehiculos.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.patente}{v.marca ? ` — ${v.marca}` : ''}{v.modelo ? ` ${v.modelo}` : ''}
                  </option>
                ))}
              </select>
            </div>
            {vehMantObj && kmActual != null && (
              <div style={{ fontSize: 13, color: 'var(--texto-suave)' }}>
                Km actual: <strong style={{ color: 'var(--texto)' }}>{kmActual.toLocaleString('es-AR')} km</strong>
              </div>
            )}
          </div>

          {alertaKm && (
            <div style={{ background: '#fef9c3', border: '2px solid rgba(184,138,0,0.35)', borderRadius: 'var(--radio)', padding: '12px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 22 }}>⚠</span>
              <div>
                <p style={{ fontWeight: 800, color: '#854d0e', margin: 0 }}>Service vencido</p>
                <p style={{ fontSize: 13, color: '#854d0e', margin: 0 }}>
                  El vehículo tiene {kmActual.toLocaleString('es-AR')} km y el próximo service estaba previsto a los {ultimoServKm.toLocaleString('es-AR')} km.
                </p>
              </div>
            </div>
          )}

          {!vehSelMant ? (
            <p className="estado-carga">Seleccioná un vehículo para ver su historial de mantenimiento.</p>
          ) : cargandoMant ? (
            <p className="estado-carga">Cargando historial...</p>
          ) : historial.length === 0 ? (
            <p className="estado-carga">Sin registros de mantenimiento para este vehículo.</p>
          ) : (
            <div className="tabla-wrapper">
              <table>
                <thead><tr>
                  <th>Fecha</th><th>Tipo</th><th>Descripción</th>
                  <th style={{ textAlign: 'right' }}>Km</th>
                  <th style={{ textAlign: 'right' }}>Próx. service (km)</th>
                  <th style={{ textAlign: 'right' }}>Costo</th>
                  <th>Estado</th>
                </tr></thead>
                <tbody>
                  {historial.map(h => (
                    <tr key={h.id}>
                      <td style={{ whiteSpace: 'nowrap' }}>{fechaCorta(h.fecha)}</td>
                      <td><strong>{h.tipo}</strong></td>
                      <td style={{ fontSize: 13, color: 'var(--texto-suave)' }}>{h.descripcion ?? '—'}</td>
                      <td style={{ textAlign: 'right' }}>{h.kilometraje != null ? h.kilometraje.toLocaleString('es-AR') : '—'}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{h.proximo_service != null ? h.proximo_service.toLocaleString('es-AR') : '—'}</td>
                      <td style={{ textAlign: 'right' }}>{h.costo != null ? `$${fmt(h.costo)}` : '—'}</td>
                      <td><span className="badge" style={{ background: '#dcfce7', color: '#166534' }}>{h.estado}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ══ MODAL: CRUD VEHÍCULO ═════════════════════════════ */}
      {modalVeh && (
        <Modal titulo={esEdicion ? `Editar — ${form.patente}` : 'Nuevo vehículo'} onCerrar={() => setModalVeh(false)} ancho={520}>
          <div className="form-grid">
            {!esEdicion && (
              <div className="form-group span-2">
                <label>Patente *</label>
                <input value={form.patente} onChange={e => cambiar('patente', e.target.value.toUpperCase())}
                  placeholder="Ej: AB123CD" autoFocus maxLength={10}
                  style={{ textTransform: 'uppercase', letterSpacing: 2, fontWeight: 700 }} />
              </div>
            )}
            <div className="form-group"><label>Tipo</label>
              <input value={form.tipo} onChange={e => cambiar('tipo', e.target.value)} placeholder="Ej: Camión, Utilitario" /></div>
            <div className="form-group"><label>Año</label>
              <input type="number" value={form.anio} onChange={e => cambiar('anio', e.target.value)}
                placeholder="Ej: 2018" min={1980} max={new Date().getFullYear() + 1} /></div>
            <div className="form-group"><label>Marca</label>
              <input value={form.marca} onChange={e => cambiar('marca', e.target.value)} placeholder="Ej: Ford" /></div>
            <div className="form-group"><label>Modelo</label>
              <input value={form.modelo} onChange={e => cambiar('modelo', e.target.value)} placeholder="Ej: Transit" /></div>
            <div className="form-group"><label>Km actual</label>
              <input type="number" min="0" value={form.kilometraje_actual}
                onChange={e => cambiar('kilometraje_actual', e.target.value)} placeholder="Ej: 85000" /></div>
            {esEdicion && (
              <div className="form-group"><label>Estado</label>
                <select value={form.estado} onChange={e => cambiar('estado', e.target.value)}>
                  {ESTADOS_VEH.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            )}
          </div>
          {errVeh && <p className="error-msg" style={{ marginTop: 14 }}>Error: {errVeh}</p>}
          <div className="modal-footer">
            <button className="btn btn-secundario" onClick={() => setModalVeh(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={guardar} disabled={guardando}>
              {guardando ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </Modal>
      )}

      {/* ══ MODAL: ASIGNAR ENTREGAS ══════════════════════════ */}
      {modalAsignar && (
        <Modal titulo={`Asignar entregas — ${modalAsignar.patente}`} onCerrar={() => setModalAsignar(null)} ancho={740}>
          <p style={{ fontSize: 13, color: 'var(--texto-suave)', marginBottom: 16 }}>
            Seleccioná las ventas a domicilio que llevará este vehículo en el próximo viaje.
          </p>

          {pendientes.length === 0 ? (
            <p className="estado-carga">No hay entregas pendientes sin asignar.</p>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                  <input type="checkbox"
                    checked={pendientes.length > 0 && pendientes.every(p => seleccionadas.has(p.id))}
                    onChange={selAll} />
                  Seleccionar todas ({pendientes.length})
                </label>
                {seleccionadas.size > 0 && (
                  <span style={{ fontSize: 12, color: 'var(--naranja)', fontWeight: 700 }}>
                    {seleccionadas.size} seleccionada{seleccionadas.size !== 1 ? 's' : ''}
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 420, overflowY: 'auto' }}>
                {pendientes.map(v => (
                  <label key={v.id}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer',
                      padding: '12px 14px', borderRadius: 'var(--radio)',
                      border: `2px solid ${seleccionadas.has(v.id) ? 'rgba(249,115,22,0.4)' : 'var(--borde)'}`,
                      background: seleccionadas.has(v.id) ? 'var(--naranja-claro)' : 'var(--blanco)',
                      transition: 'border-color 0.15s, background 0.15s',
                    }}>
                    <input type="checkbox"
                      checked={seleccionadas.has(v.id)}
                      onChange={() => toggleSel(v.id)}
                      style={{ marginTop: 3, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <code style={{ fontSize: 13, fontWeight: 700 }}>#{String(v.id).padStart(4, '0')}</code>
                        <span style={{ fontWeight: 600, fontSize: 14 }}>{v.cliente ?? 'Consumidor final'}</span>
                        <span style={{ fontSize: 12, color: 'var(--texto-suave)' }}>{fechaCorta(v.fecha)}</span>
                        <span style={{ marginLeft: 'auto', fontWeight: 700, color: 'var(--verde)', fontSize: 14 }}>${fmt(v.total)}</span>
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--naranja-oscuro)', marginTop: 4, fontWeight: 600 }}>
                        📍 {v.direccion_entrega}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </>
          )}

          {errAsignar && <p className="error-msg" style={{ marginTop: 12 }}>{errAsignar}</p>}
          <div className="modal-footer">
            <button className="btn btn-secundario" onClick={() => setModalAsignar(null)}>Cancelar</button>
            <button className="btn btn-primary"
              onClick={confirmarAsignacion}
              disabled={seleccionadas.size === 0 || asignando}>
              {asignando
                ? 'Asignando...'
                : `Asignar ${seleccionadas.size || ''} entrega${seleccionadas.size !== 1 ? 's' : ''} a ${modalAsignar.patente}`}
            </button>
          </div>
        </Modal>
      )}

      {/* ══ MODAL: RUTA OPTIMIZADA ═══════════════════════════ */}
      {modalRuta && (
        <Modal
          titulo={`Ruta optimizada — ${modalRuta.patente}${modalRuta.marca ? ` · ${modalRuta.marca}` : ''}`}
          onCerrar={() => { setModalRuta(null); setRutaData(null); setErrRuta(''); }}
          ancho={860}
        >
          {calculandoRuta && (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>🗺</div>
              <p style={{ color: 'var(--texto-suave)', fontSize: 15 }}>Geocodificando direcciones y optimizando ruta...</p>
            </div>
          )}

          {errRuta && !calculandoRuta && (
            <p className="estado-error" style={{ marginBottom: 16 }}>{errRuta}</p>
          )}

          {rutaData && !calculandoRuta && (
            <>
              <MapaMultiRuta key={modalRuta.id} paradas={rutaData.paradasOrdenadas} rutaGeoJSON={rutaData.rutaGeoJSON} />

              {/* Stops sin geocodificar */}
              {rutaData.sinGeocodificar?.length > 0 && (
                <div style={{ margin: '12px 0', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {rutaData.sinGeocodificar.map(p => (
                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#fff1f0', border: '1px solid #fca5a5', borderRadius: 8 }}>
                      <span style={{ fontSize: 16 }}>⚠</span>
                      <div style={{ flex: 1, fontSize: 13 }}>
                        <strong>{p.cliente ?? 'Sin cliente'}</strong>
                        <span style={{ color: '#b91c1c', marginLeft: 8 }}>{p.geoError}</span>
                      </div>
                      <span style={{ background: '#fca5a5', color: '#7f1d1d', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>⚠ Domicilio no encontrado</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Lista de paradas */}
              <div style={{ marginTop: 8 }}>
                {rutaData.paradasOrdenadas.map((p, i) => (
                  <div key={p.id} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 12,
                    padding: '12px 4px', borderBottom: '1px solid var(--borde)',
                  }}>
                    <div style={{
                      width: 28, height: 28, background: '#f97316', color: 'white',
                      borderRadius: '50%', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', fontWeight: 800, fontSize: 13, flexShrink: 0,
                    }}>{i + 1}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{p.cliente ?? 'Sin cliente'}</div>
                      <div style={{ fontSize: 13, color: 'var(--naranja-oscuro)', marginTop: 2 }}>📍 {dirDisplay(p)}</div>
                      {p.items?.length > 0 && (
                        <div style={{ fontSize: 12, color: 'var(--texto-suave)', marginTop: 4 }}>
                          {p.items.map(it => `${it.producto} x${parseFloat(it.cantidad).toLocaleString('es-AR')}`).join(' · ')}
                        </div>
                      )}
                    </div>
                    {p.distKm && (
                      <div style={{ textAlign: 'right', flexShrink: 0, fontSize: 13 }}>
                        <div style={{ color: '#1d4ed8', fontWeight: 600 }}>
                          📏 {p.estimado ? `~${p.distKm} km (est.)` : `${p.distKm} km`}
                        </div>
                        {p.durMin && <div style={{ color: '#15803d', fontWeight: 600 }}>🕐 ~{p.durMin} min</div>}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Totales */}
              <div style={{
                display: 'flex', gap: 24, marginTop: 14, padding: '12px 20px',
                background: '#1e2939', borderRadius: 10, color: 'white', flexWrap: 'wrap',
              }}>
                <span>Paradas: <strong>{rutaData.paradasOrdenadas.length}</strong></span>
                <span>Distancia total: <strong>{rutaData.totalKm} km</strong></span>
                <span>Tiempo estimado: <strong>~{rutaData.totalMin} min</strong></span>
                {rutaData.sinGeocodificar?.length > 0 && (
                  <span style={{ color: '#fca5a5' }}>⚠ {rutaData.sinGeocodificar.length} domicilio{rutaData.sinGeocodificar.length !== 1 ? 's' : ''} no encontrado{rutaData.sinGeocodificar.length !== 1 ? 's' : ''}</span>
                )}
              </div>

              {/* Hoja de ruta imprimible (oculta normalmente) */}
              <HojaRutaImprimible
                vehiculo={modalRuta}
                paradas={rutaData.paradasOrdenadas}
                totalKm={rutaData.totalKm}
                totalMin={rutaData.totalMin}
              />
            </>
          )}

          <div className="modal-footer">
            <button className="btn btn-secundario"
              onClick={() => { setModalRuta(null); setRutaData(null); setErrRuta(''); }}>
              Cerrar
            </button>
            {rutaData && !calculandoRuta && (
              <>
                <button className="btn btn-secundario" onClick={imprimirHojaRuta}>
                  🖨 Imprimir hoja de ruta
                </button>
                <button className="btn btn-primary"
                  style={{ background: 'var(--verde)', boxShadow: '0 4px 12px rgba(16,185,129,0.35)' }}
                  onClick={handleEntregarTodas}
                  disabled={entregandoTodas}>
                  {entregandoTodas ? 'Marcando...' : '✓ Marcar todas como entregadas'}
                </button>
              </>
            )}
          </div>
        </Modal>
      )}

      {/* ══ MODAL: NUEVO MANTENIMIENTO ═══════════════════════ */}
      {modalMant && (
        <Modal titulo="Registrar mantenimiento" onCerrar={() => setModalMant(false)} ancho={560}>
          {vehMantObj && (
            <p style={{ fontSize: 13, color: 'var(--texto-suave)', marginBottom: 16 }}>
              Vehículo: <strong style={{ color: 'var(--texto)' }}>
                {vehMantObj.patente}{vehMantObj.marca ? ` — ${vehMantObj.marca} ${vehMantObj.modelo ?? ''}` : ''}
              </strong>
            </p>
          )}
          <div className="form-grid">
            <div className="form-group"><label>Tipo *</label>
              <select value={formMant.tipo} onChange={e => cambiarMant('tipo', e.target.value)}>
                <option value="">— Seleccioná —</option>
                {TIPOS_MANT.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-group"><label>Fecha</label>
              <input type="date" value={formMant.fecha} onChange={e => cambiarMant('fecha', e.target.value)} /></div>
            <div className="form-group span-2"><label>Descripción</label>
              <input value={formMant.descripcion} onChange={e => cambiarMant('descripcion', e.target.value)}
                placeholder="Detalles del servicio / reparación" /></div>
            <div className="form-group"><label>Costo ($)</label>
              <input type="number" min="0" step="0.01" value={formMant.costo}
                onChange={e => cambiarMant('costo', e.target.value)} placeholder="0.00" /></div>
            <div className="form-group"><label>Kilometraje al realizar</label>
              <input type="number" min="0" value={formMant.kilometraje}
                onChange={e => cambiarMant('kilometraje', e.target.value)} placeholder="Ej: 85000" /></div>
            <div className="form-group span-2"><label>Próximo service (km)</label>
              <input type="number" min="0" value={formMant.proximo_service}
                onChange={e => cambiarMant('proximo_service', e.target.value)} placeholder="Ej: 95000" /></div>
          </div>
          {errMant && <p className="error-msg" style={{ marginTop: 14 }}>Error: {errMant}</p>}
          <div className="modal-footer">
            <button className="btn btn-secundario" onClick={() => setModalMant(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={guardarMant} disabled={guardandoMant}>
              {guardandoMant ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </Modal>
      )}

      {/* ══ MODAL: DETALLE DE ENTREGA INDIVIDUAL ════════════ */}
      {detalleEntrega && (
        <Modal
          titulo={`Detalle entrega — Venta #${String(detalleEntrega.id).padStart(4, '0')}`}
          onCerrar={() => { setDetalleEntrega(null); setErrDetalle(null); }}
          ancho={620}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 24px', marginBottom: 20 }}>
            <div><span className="comp-label">Fecha de venta</span><span className="comp-valor">{fechaLarga(detalleEntrega.fecha)}</span></div>
            <div><span className="comp-label">Total</span><span className="comp-valor" style={{ fontWeight: 800, fontSize: 17, color: 'var(--naranja-oscuro)' }}>${fmt(detalleEntrega.total)}</span></div>
            <div><span className="comp-label">Cliente</span><span className="comp-valor">{detalleEntrega.cliente ?? 'Consumidor final'}</span></div>
            {detalleEntrega.cliente_telefono && (
              <div><span className="comp-label">Teléfono</span><span className="comp-valor">{detalleEntrega.cliente_telefono}</span></div>
            )}
          </div>
          <div style={{ background: 'var(--naranja-claro)', border: '2px solid rgba(249,115,22,0.35)', borderRadius: 'var(--radio)', padding: '14px 18px', marginBottom: 20 }}>
            <p style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--naranja-oscuro)', marginBottom: 4 }}>📍 Dirección de entrega</p>
            <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--texto)', margin: 0 }}>{detalleEntrega.direccion_entrega ?? '—'}</p>
          </div>
          <p className="form-section-titulo">Productos a entregar</p>
          {(!detalleEntrega.items?.length) ? <p className="estado-carga">Sin items.</p> : (
            <div className="tabla-wrapper" style={{ marginBottom: 20 }}>
              <table>
                <thead><tr><th>Producto</th><th style={{ textAlign: 'right' }}>Cantidad</th><th style={{ textAlign: 'right' }}>Subtotal</th></tr></thead>
                <tbody>
                  {detalleEntrega.items.map(item => (
                    <tr key={item.id}>
                      <td style={{ fontWeight: 500 }}>{item.producto ?? item.producto_codigo}</td>
                      <td style={{ textAlign: 'right' }}><strong style={{ fontSize: 15 }}>{parseFloat(item.cantidad).toLocaleString('es-AR')}</strong></td>
                      <td style={{ textAlign: 'right' }}>${fmt(item.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {errDetalle && <p className="error-msg" style={{ marginBottom: 12 }}>{errDetalle}</p>}
          <div className="modal-footer">
            <button className="btn btn-secundario" onClick={() => { setDetalleEntrega(null); setErrDetalle(null); }}>Cerrar</button>
            <button className="btn btn-primary"
              style={{ background: 'var(--verde)', boxShadow: '0 4px 12px rgba(16,185,129,0.35)' }}
              onClick={marcarEntregada} disabled={marcandoEntregada}>
              {marcandoEntregada ? 'Registrando...' : '✓ Marcar como entregado'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
