/** Etiqueta fija que avisa de que este es el panel del ENTORNO DE PRUEBAS y no el real (se detecta por el dominio: «pruebas.»). */
export const IS_STAGING = typeof window !== 'undefined' && /(^|\.)pruebas\./.test(window.location.hostname);

export default function StagingBadge() {
  if (!IS_STAGING) return null;
  return (
    <div
      role="note"
      style={{
        position: 'fixed', left: 8, bottom: 8, zIndex: 2147483000, padding: '3px 8px', borderRadius: 4,
        background: '#facc15', color: '#0f172a', font: '700 10px/1.4 ui-monospace, monospace', letterSpacing: '0.08em',
        textTransform: 'uppercase', pointerEvents: 'none', opacity: 0.92,
      }}
    >
      Entorno de pruebas
    </div>
  );
}
