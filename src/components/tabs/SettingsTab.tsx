import React, { useState } from 'react';
import * as Icons from 'lucide-react';
import { NotificationSettings } from '../NotificationPanels';
import { SystemSettings } from './SystemSettings';

type Section = 'notifications' | 'system';

const SECTION_KEY = 'settings_section';

/** Ajustes del panel: avisos (qué recibir y en qué dispositivos) y sistema (estado del servidor). */
export const SettingsTab: React.FC<{ adminToken: string; onNotificationsChange: () => void }> = ({ adminToken, onNotificationsChange }) => {
  const [section, setSection] = useState<Section>(() => {
    try { return localStorage.getItem(SECTION_KEY) === 'system' ? 'system' : 'notifications'; } catch { return 'notifications'; }
  });
  const choose = (s: Section) => {
    setSection(s);
    try { localStorage.setItem(SECTION_KEY, s); } catch { /* sin almacenamiento: no se recuerda */ }
  };

  const tabs: { id: Section; label: string; icon: React.ElementType }[] = [
    { id: 'notifications', label: 'Avisos', icon: Icons.Bell },
    { id: 'system', label: 'Sistema', icon: Icons.Server },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-1 border-b border-tech-border" role="tablist" aria-label="Secciones de ajustes">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={section === t.id}
              onClick={() => choose(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-mono uppercase tracking-wider border-b-2 transition-all whitespace-nowrap ${
                section === t.id ? 'border-tech-yellow text-tech-yellow font-bold bg-tech-card/50' : 'border-transparent text-tech-muted hover:text-tech-text'
              }`}
            >
              <Icon className="w-4 h-4" /> {t.label}
            </button>
          );
        })}
      </div>
      {section === 'notifications' ? <NotificationSettings token={adminToken} onChange={onNotificationsChange} /> : <SystemSettings adminToken={adminToken} />}
    </div>
  );
};
