import React, { useEffect, useState } from 'react';
import * as Icons from 'lucide-react';

/**
 * Protección de datos del asesor: mientras no acepte la versión vigente de la
 * información sobre sus datos y del compromiso de confidencialidad, el panel
 * queda tapado por esta ventana. Al aceptar queda registrado en el servidor y
 * se le envía una copia por email.
 */

interface Section { heading: string; paragraphs?: string[]; items?: string[] }
interface LegalDoc { required: boolean; version: string; title: string; sections: Section[] }

export const AgentLegalGate: React.FC<{ adminToken: string; onLogout: () => void }> = ({ adminToken, onLogout }) => {
  const [doc, setDoc] = useState<LegalDoc | null>(null);
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/agent/legal', { headers: { Authorization: `Bearer ${adminToken}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setDoc(d))
      .catch(() => {});
  }, [adminToken]);

  if (!doc?.required) return null;

  const accept = async () => {
    setSaving(true); setError(null);
    try {
      const res = await fetch('/api/agent/legal/accept', { method: 'POST', headers: { Authorization: `Bearer ${adminToken}` } });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'No se pudo registrar la aceptación');
      setDoc({ ...doc, required: false });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-3 sm:p-6">
      <div className="bg-tech-card border border-tech-border rounded-xl w-full max-w-2xl max-h-[92vh] flex flex-col">
        <div className="px-5 py-4 border-b border-tech-border flex items-start gap-3">
          <Icons.ShieldCheck size={20} className="text-tech-yellow shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-tech-text">{doc.title}</p>
            <p className="text-[11px] text-tech-muted mt-0.5">Léelo y acéptalo para usar el panel. Te enviaremos una copia por email. Versión {doc.version}.</p>
          </div>
        </div>
        <div className="overflow-y-auto px-5 py-4 space-y-4 text-xs text-tech-text leading-relaxed">
          {doc.sections.map((s) => (
            <section key={s.heading} className="space-y-1.5">
              <p className="font-bold text-tech-yellow">{s.heading}</p>
              {s.paragraphs?.map((p, i) => <p key={i} className="text-tech-muted">{p}</p>)}
              {s.items && (
                <ul className="list-disc pl-5 space-y-1 text-tech-muted">
                  {s.items.map((it, i) => <li key={i}>{it}</li>)}
                </ul>
              )}
            </section>
          ))}
        </div>
        <div className="px-5 py-4 border-t border-tech-border space-y-3">
          <label className="flex items-start gap-2 text-xs text-tech-text cursor-pointer">
            <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} className="mt-0.5" />
            He leído la información sobre protección de datos y acepto el compromiso de confidencialidad sobre los datos de los clientes.
          </label>
          {error && <p className="text-[11px] text-red-400">{error}</p>}
          <div className="flex gap-2">
            <button onClick={onLogout} className="border border-tech-border rounded-lg px-4 py-2 text-xs text-tech-muted hover:text-tech-text">Salir</button>
            <button onClick={accept} disabled={!checked || saving}
              className="flex-1 bg-tech-yellow text-black font-bold rounded-lg py-2 text-xs disabled:opacity-40 flex items-center justify-center gap-2">
              {saving ? <Icons.Loader2 size={13} className="animate-spin" /> : <Icons.Check size={13} />} Aceptar y continuar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
