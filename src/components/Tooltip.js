export default function Tooltip({ texto, ancho = 240 }) {
  return (
    <span className="tooltip-wrap" tabIndex={0}>
      <span className="tooltip-ico">i</span>
      <span className="tooltip-box" style={{ width: ancho }}>{texto}</span>
    </span>
  );
}
