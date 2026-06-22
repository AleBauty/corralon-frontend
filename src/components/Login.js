import { useState } from 'react';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3000';

export default function Login({ onLogin }) {
  const [usuario,   setUsuario]   = useState('');
  const [password,  setPassword]  = useState('');
  const [cargando,  setCargando]  = useState(false);
  const [error,     setError]     = useState('');

  const handleSubmit = async e => {
    e.preventDefault();
    if (!usuario.trim() || !password) return;
    setCargando(true);
    setError('');
    try {
      const res  = await fetch(`${API}/api/auth/login`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ usuario: usuario.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Error al iniciar sesión');
      sessionStorage.setItem('usuario', JSON.stringify(data));
      onLogin(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  };

  return (
    <div style={styles.fondo}>
      <div style={styles.card}>
        <div style={styles.logo}>
          <span style={styles.logoIcono}>🧱</span>
          <div>
            <div style={styles.logoNombre}>Corralón</div>
            <div style={styles.logoSub}>Virgen de Punta Corral</div>
          </div>
        </div>

        <h2 style={styles.titulo}>Iniciar sesión</h2>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.grupo}>
            <label style={styles.label}>Usuario</label>
            <input
              style={styles.input}
              type="text"
              value={usuario}
              onChange={e => setUsuario(e.target.value)}
              placeholder="Ingresá tu usuario"
              autoFocus
              autoComplete="username"
            />
          </div>
          <div style={styles.grupo}>
            <label style={styles.label}>Contraseña</label>
            <input
              style={styles.input}
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Ingresá tu contraseña"
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div style={styles.error}>{error}</div>
          )}

          <button
            type="submit"
            style={{ ...styles.btn, opacity: cargando ? 0.7 : 1 }}
            disabled={cargando || !usuario.trim() || !password}
          >
            {cargando ? 'Verificando...' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  );
}

const styles = {
  fondo: {
    minHeight:       '100vh',
    background:      'linear-gradient(135deg, #1a1f2e 0%, #2d3446 50%, #1a1f2e 100%)',
    display:         'flex',
    alignItems:      'center',
    justifyContent:  'center',
    fontFamily:      "'Inter', 'Segoe UI', sans-serif",
  },
  card: {
    background:   '#ffffff',
    borderRadius: 16,
    padding:      '40px 44px',
    width:        360,
    boxShadow:    '0 24px 64px rgba(0,0,0,0.35)',
  },
  logo: {
    display:        'flex',
    alignItems:     'center',
    gap:            12,
    marginBottom:   28,
    justifyContent: 'center',
  },
  logoIcono: {
    fontSize: 38,
  },
  logoNombre: {
    fontWeight:  800,
    fontSize:    22,
    color:       '#1a1f2e',
    lineHeight:  1.1,
  },
  logoSub: {
    fontSize: 11,
    color:    '#64748b',
    marginTop: 2,
  },
  titulo: {
    fontSize:     18,
    fontWeight:   700,
    color:        '#1e293b',
    margin:       '0 0 24px 0',
    textAlign:    'center',
  },
  form: {
    display:       'flex',
    flexDirection: 'column',
    gap:           16,
  },
  grupo: {
    display:       'flex',
    flexDirection: 'column',
    gap:           6,
  },
  label: {
    fontSize:   13,
    fontWeight: 600,
    color:      '#374151',
  },
  input: {
    padding:      '10px 14px',
    border:       '1.5px solid #d1d5db',
    borderRadius: 8,
    fontSize:     14,
    color:        '#111827',
    outline:      'none',
    transition:   'border-color 0.15s',
  },
  error: {
    background:   '#fef2f2',
    border:       '1px solid #fca5a5',
    color:        '#dc2626',
    borderRadius: 8,
    padding:      '10px 14px',
    fontSize:     13,
    fontWeight:   500,
  },
  btn: {
    background:    '#2563eb',
    color:         '#fff',
    border:        'none',
    borderRadius:  8,
    padding:       '12px',
    fontSize:      15,
    fontWeight:    700,
    cursor:        'pointer',
    marginTop:     4,
    transition:    'background 0.15s',
  },
};
