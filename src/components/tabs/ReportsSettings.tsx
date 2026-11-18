import React, { useCallback, useEffect, useMemo, useState } from 'react';
import * as Icons from 'lucide-react';
import { COMPARE_OPTIONS } from '../overview/OverviewWidgets';
import { fmtDateTime, fmtDayLong } from '../../utils/overviewFormat';
import type { OverviewCompare, OverviewEmailConfig, OverviewEmailState, ReportKind } from '../../types/overview';

const KINDS: { id: ReportKind; title: string; when: string }[] = [
  { id: 'daily', title: 'Diario', when: 'Cada día: el informe de ayer.' },
  { id: 'weekly', title: 'Semanal', when: 'Cada lunes: la semana anterior, de lunes a domingo.' },
  { id: 'monthly', title: 'Mensual', when: 'El día 1 de cada mes: el mes anterior entero.' },
];

const sameConfig = (a: OverviewEmailConfig, b: OverviewEmailConfig) => JSON.stringify(a) === JSON.stringify(b);

/** Ajustes › Informes: qué informes de la Vista general llegan por correo, a quién y con qué se comparan. */
export const ReportsSettings: React.FC<{ adminToken: string }> = ({ adminToken }) => {
  const [state, setState] = useState<OverviewEmailState | null>(null);
  const [draft, setDraft] = useState<OverviewEmailConfig | null>(null);
  const [recipientsText, setRecipientsText] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [testing, setTesting] = useState<ReportKind | null>(null);
  const [testMsg, setTestMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const headers = useMemo(() => ({ Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' }), [adminToken]);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/overview/email-config', { headers });
      if (!res.ok) { setLoadError(res.status === 401 ? 'Sesión caducada o falta la verificación en dos pasos.' : 'No se pudo leer la configuración de los informes.'); return; }
      const data: OverviewEmailState = await res.json();
      setState(data);
      setDraft(data.config);
      setRecipientsText(data.config.recipients.join(', '));
      setLoadError(null);
    } catch (e) {
      console.error('[REPORTS SETTINGS LOAD ERROR]:', e);
      setLoadError('No se pudo leer la configuración de los informes. Revisa la conexión.');
    }
  }, [headers]);

  useEffect(() => { load(); }, [load]);

  if (loadError && !state) {
    return <div className="flex items-center justify-center h-48 text-xs font-mono text-red-400"><Icons.AlertCircle size={16} className="mr-2" /> {loadError}</div>;
  }
  if (!state || !draft) {
    return <div className="flex items-center justify-center h-48 text-tech-muted text-xs font-mono"><Icons.Loader2 size={20} className="animate-spin mr-3" /> Leyendo la configuración…</div>;
  }

  // Los correos se leen del texto tal cual está escrito; el servidor los limpia y avisa si alguno no vale.
  const current: OverviewEmailConfig = { ...draft, recipients: recipientsText.split(/[\s,;]+/).map((r) => r.trim()).filter(Boolean) };
  const dirty = !sameConfig(current, { ...state.config });
  const anyOn = KINDS.some((k) => current[k.id].enabled);

  const setSchedule = (kind: ReportKind, patch: Partial<{ enabled: boolean; compare: OverviewCompare }>) => {
    setDraft({ ...draft, [kind]: { ...draft[kind], ...patch } });
    setSaveMsg(null);
  };

  const save = async () => {
    setSaving(true);
    setSaveMsg(null);
    try {
      const res = await fetch('/api/admin/overview/email-config', { method: 'PUT', headers, body: JSON.stringify(current) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setSaveMsg({ ok: false, text: data.error || 'No se pudo guardar.' }); return; }
      setState((s) => (s ? { ...s, ...data } : s));
      setDraft(data.config);
      setRecipientsText(data.config.recipients.join(', '));
      setSaveMsg({ ok: true, text: 'Guardado.' });
    } catch {
      setSaveMsg({ ok: false, text: 'No se pudo guardar. Revisa la conexión.' });
    } finally {
      setSaving(false);
    }
  };

  const sendTest = async (kind: ReportKind) => {
    setTesting(kind);
    setTestMsg(null);
    try {
      const res = await fetch('/api/admin/overview/email-test', { method: 'POST', headers, body: JSON.stringify({ kind }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setTestMsg({ ok: false, text: data.error || 'No se pudo enviar la prueba.' }); return; }
      setTestMsg({ ok: true, text: `Prueba enviada a ${data.to}. Llega marcada como [PRUEBA]${data.ai ? ' y con el análisis de la IA' : ''}.` });
      load();
    } catch {
      setTestMsg({ ok: false, text: 'No se pudo enviar la prueba. Revisa la conexión.' });
    } finally {
      setTesting(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-tech-card border border-tech-border rounded-md p-4 sm:p-6 shadow-xl space-y-6">
        <div>
          <h2 className="text-sm font-mono uppercase tracking-wider flex items-center gap-2 text-tech-text border-b border-tech-border pb-4">
            <Icons.Mail className="text-tech-yellow w-4 h-4" /> Informes por correo
          </h2>
          <p className="text-xs text-tech-muted mt-3 leading-relaxed">
            Los informes de la Vista general llegan solos a partir de las {state.sendHour}:00 (hora de Madrid) con los indicadores clave, el análisis de la IA (si lo dejas activado) y el PDF completo adjunto.
          </p>
        </div>

        <div className="space-y-3">
          {KINDS.map((k) => {
            const s = current[k.id];
            return (
              <div key={k.id} className={`border rounded-md p-4 grid grid-cols-1 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto] gap-4 items-center ${s.enabled ? 'border-tech-yellow/30 bg-tech-yellow/[0.03]' : 'border-tech-border'}`}>
                <label className="flex items-start gap-3 cursor-pointer select-none min-w-0">
                  <input type="checkbox" checked={s.enabled} onChange={(e) => setSchedule(k.id, { enabled: e.target.checked })} className="mt-1 rounded border-tech-border text-tech-yellow focus:ring-0 bg-tech-card" />
                  <span className="min-w-0">
                    <span className="block text-xs font-mono font-bold uppercase tracking-wider text-tech-text">{k.title}</span>
                    <span className="block text-[11px] text-tech-muted mt-0.5">{k.when}</span>
                    <span className="block text-[10px] font-mono text-tech-muted mt-1">
                      {s.enabled ? <>Próximo envío: <strong className="text-tech-text">{fmtDayLong(state.next[k.id])}</strong></> : 'Desactivado'}
                    </span>
                  </span>
                </label>
                <label className="flex flex-col gap-1 text-[10px] font-mono uppercase tracking-widest text-tech-muted min-w-0">
                  Comparar con
                  <select
                    value={s.compare}
                    onChange={(e) => setSchedule(k.id, { compare: e.target.value as OverviewCompare })}
                    disabled={!s.enabled}
                    className="bg-tech-carbon border border-tech-border rounded px-2 py-1.5 text-[11px] normal-case tracking-normal text-tech-text focus:border-tech-yellow focus:outline-none disabled:opacity-50"
                  >
                    {COMPARE_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                  </select>
                </label>
                <button
                  onClick={() => sendTest(k.id)}
                  disabled={testing !== null}
                  title="Te envía este informe ahora, marcado como [PRUEBA], a tu correo de acceso al panel"
                  className="flex items-center justify-center gap-2 px-3 py-2 rounded-sm border border-tech-border text-[10px] font-mono uppercase tracking-wider text-tech-text hover:border-tech-yellow hover:text-tech-yellow transition-colors disabled:opacity-50"
                >
                  {testing === k.id ? <Icons.Loader2 size={13} className="animate-spin" /> : <Icons.Send size={13} />} {testing === k.id ? 'Enviando…' : 'Enviar prueba'}
                </button>
              </div>
            );
          })}
          {testMsg && (
            <div className={`text-xs font-mono flex items-start gap-2 ${testMsg.ok ? 'text-emerald-400' : 'text-red-400'}`}>
              {testMsg.ok ? <Icons.CheckCircle2 size={14} className="mt-0.5 shrink-0" /> : <Icons.AlertCircle size={14} className="mt-0.5 shrink-0" />} {testMsg.text}
            </div>
          )}
          {testing && <p className="text-[11px] text-tech-muted font-mono">La prueba puede tardar hasta un minuto si lleva el análisis de la IA.</p>}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <label className="flex flex-col gap-1.5 text-[10px] font-mono uppercase tracking-widest text-tech-muted">
            Destinatarios
            <textarea
              value={recipientsText}
              onChange={(e) => { setRecipientsText(e.target.value); setSaveMsg(null); }}
              rows={2}
              placeholder="info@escapesymas.com"
              className="bg-tech-carbon border border-tech-border rounded px-3 py-2 text-xs normal-case tracking-normal text-tech-text focus:border-tech-yellow focus:outline-none resize-y"
            />
            <span className="normal-case tracking-normal text-[11px]">Hasta {state.maxRecipients} correos, separados por comas. Las pruebas van solo a tu correo de acceso{state.adminEmail ? ` (${state.adminEmail})` : ''}.</span>
          </label>
          <label className="flex items-start gap-3 cursor-pointer select-none lg:pt-5">
            <input type="checkbox" checked={draft.includeAi} onChange={(e) => { setDraft({ ...draft, includeAi: e.target.checked }); setSaveMsg(null); }} className="mt-1 rounded border-tech-border text-tech-yellow focus:ring-0 bg-tech-card" />
            <span>
              <span className="block text-xs font-mono font-bold uppercase tracking-wider text-tech-text">Incluir el análisis de la IA</span>
              <span className="block text-[11px] text-tech-muted mt-0.5">Cada informe lleva un análisis redactado con los datos del periodo (cuesta unos céntimos). Sin él, el correo lleva igualmente los indicadores y el PDF.</span>
            </span>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-tech-border pt-4">
          <button
            onClick={save}
            disabled={!dirty || saving || (anyOn && current.recipients.length === 0)}
            className="flex items-center gap-2 px-4 py-2 rounded-sm bg-tech-yellow text-black hover:bg-yellow-300 text-xs font-mono font-bold uppercase tracking-wider transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? <Icons.Loader2 size={14} className="animate-spin" /> : <Icons.Save size={14} />} Guardar cambios
          </button>
          {dirty && !saving && <span className="text-[11px] font-mono text-amber-300">Hay cambios sin guardar.</span>}
          {anyOn && current.recipients.length === 0 && <span className="text-[11px] font-mono text-red-400">Añade al menos un correo de destino.</span>}
          {saveMsg && <span className={`text-[11px] font-mono ${saveMsg.ok ? 'text-emerald-400' : 'text-red-400'}`}>{saveMsg.text}</span>}
        </div>
      </div>

      <div className="bg-tech-card border border-tech-border rounded-md p-4 sm:p-6 shadow-xl">
        <h3 className="text-[11px] font-mono uppercase tracking-widest text-tech-text flex items-center gap-2 mb-4"><Icons.History className="w-3.5 h-3.5 text-tech-yellow" /> Últimos envíos</h3>
        {state.log.length === 0 ? (
          <p className="text-[11px] text-tech-muted font-mono">Todavía no se ha enviado ningún informe.</p>
        ) : (
          <ul className="divide-y divide-tech-border">
            {state.log.map((l, i) => (
              <li key={`${l.at}-${i}`} className="py-2.5 flex flex-wrap items-start gap-x-3 gap-y-1 text-[11px] font-mono">
                {l.ok ? <Icons.CheckCircle2 size={14} className="text-emerald-400 mt-0.5 shrink-0" /> : <Icons.AlertCircle size={14} className="text-red-400 mt-0.5 shrink-0" />}
                <span className="text-tech-muted shrink-0">{fmtDateTime(l.at)}</span>
                <span className="text-tech-text min-w-0 break-words flex-1">{l.subject}</span>
                <span className="text-tech-muted min-w-0 break-all">{l.ok ? `→ ${l.to}` : `Falló: ${l.error || 'error desconocido'}`}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
