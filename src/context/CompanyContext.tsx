import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  CompanySettings,
  AiAssistantSettings,
  DEFAULT_AI_SETTINGS,
  TermsVersion,
  TermClause,
  AuditLog,
  ActiveTab,
  ThemeMode,
} from '../types';
import { initialCompanySettings, initialAuditLogs } from '../data/mockData';
import { initialTermsVersion } from '../data/termsData';
import { saveRemoteAgencyData } from '../lib/firestoreSync';

export type CloudSyncStatus = 'idle' | 'syncing' | 'synced' | 'error';

export interface CompanyContextType {
  companySettings: CompanySettings;
  aiSettings: AiAssistantSettings;
  termsVersion: TermsVersion;
  auditLogs: AuditLog[];
  activeTab: ActiveTab;
  theme: ThemeMode;
  cloudSyncStatus: CloudSyncStatus;
  lastCloudSync: string | null;

  setActiveTab: (tab: ActiveTab) => void;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  updateCompanySettings: (settings: Partial<CompanySettings>) => void;
  updateAiSettings: (settings: Partial<AiAssistantSettings>) => void;
  resetAiSettings: () => void;
  updateTermsVersion: (terms: TermsVersion) => void;
  addTermsClause: (clause: TermClause, actorName?: string) => void;
  updateTermsClause: (number: string, clauseData: Partial<TermClause>, actorName?: string) => void;
  deleteTermsClause: (number: string, actorName?: string) => void;
  addAuditLog: (action: string, targetType: AuditLog['targetType'], targetId: string, details: string) => void;
  setCloudSyncStatus: (status: CloudSyncStatus) => void;
  setLastCloudSync: (time: string | null) => void;
  setCompanySettingsList: (settings: CompanySettings) => void;
  setAiSettingsList: (ai: AiAssistantSettings) => void;
  setTermsVersionList: (terms: TermsVersion) => void;
  setAuditLogsList: (logs: AuditLog[]) => void;
}

const STORAGE_KEYS = {
  SETTINGS: 'morvello_settings_v1',
  TERMS: 'morvello_terms_v1',
  AUDIT: 'morvello_audit_v1',
  THEME: 'morvello_theme_v1',
  AI_SETTINGS: 'morvello_ai_settings_v1',
  LAST_CLOUD_SYNC: 'morvello_last_cloud_sync',
};

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export const CompanyProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.THEME) as ThemeMode | null;
    if (saved === 'dark' || saved === 'light') return saved;
    return 'dark'; // Prestige luxury dark by default
  });

  const setTheme = (newTheme: ThemeMode) => {
    setThemeState(newTheme);
    localStorage.setItem(STORAGE_KEYS.THEME, newTheme);
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'light') {
      root.classList.remove('dark');
      root.classList.add('light');
      root.setAttribute('data-theme', 'light');
    } else {
      root.classList.remove('light');
      root.classList.add('dark');
      root.setAttribute('data-theme', 'dark');
    }
  }, [theme]);

  const [companySettings, setCompanySettings] = useState<CompanySettings>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse settings', e);
      }
    }
    return initialCompanySettings;
  });

  const [aiSettings, setAiSettings] = useState<AiAssistantSettings>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.AI_SETTINGS);
    if (saved) {
      try {
        return { ...DEFAULT_AI_SETTINGS, ...JSON.parse(saved) };
      } catch {
        return DEFAULT_AI_SETTINGS;
      }
    }
    return DEFAULT_AI_SETTINGS;
  });

  const [termsVersion, setTermsVersion] = useState<TermsVersion>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.TERMS);
    return saved ? JSON.parse(saved) : initialTermsVersion;
  });

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.AUDIT);
    return saved ? JSON.parse(saved) : initialAuditLogs;
  });

  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [cloudSyncStatus, setCloudSyncStatus] = useState<CloudSyncStatus>('idle');
  const [lastCloudSync, setLastCloudSync] = useState<string | null>(() => {
    return localStorage.getItem(STORAGE_KEYS.LAST_CLOUD_SYNC);
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(companySettings));
  }, [companySettings]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.AI_SETTINGS, JSON.stringify(aiSettings));
  }, [aiSettings]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.TERMS, JSON.stringify(termsVersion));
  }, [termsVersion]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.AUDIT, JSON.stringify(auditLogs));
  }, [auditLogs]);

  const addAuditLog = useCallback(
    (action: string, targetType: AuditLog['targetType'], targetId: string, details: string) => {
      const newLog: AuditLog = {
        id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        timestamp: new Date().toISOString(),
        userName: 'Morvello System',
        userRole: 'admin',
        action,
        targetType,
        targetId,
        details,
      };
      setAuditLogs((prev) => [newLog, ...prev.slice(0, 499)]);
    },
    []
  );

  const updateCompanySettings = (settings: Partial<CompanySettings>) => {
    setCompanySettings((prev) => {
      const updated = { ...prev, ...settings };
      saveRemoteAgencyData({ companySettings: updated }).catch((err) =>
        console.warn('Auto-save companySettings to cloud note:', err)
      );
      return updated;
    });
    addAuditLog('Mise à jour paramètres', 'settings', 'company', 'Modification des paramètres de la société');
  };

  const updateAiSettings = (newSettings: Partial<AiAssistantSettings>) => {
    setAiSettings((prev) => ({ ...prev, ...newSettings }));
    addAuditLog('Mise à jour Charte IA', 'settings', 'ai_assistant', 'Modification de la configuration IA');
  };

  const resetAiSettings = () => {
    setAiSettings(DEFAULT_AI_SETTINGS);
    localStorage.setItem(STORAGE_KEYS.AI_SETTINGS, JSON.stringify(DEFAULT_AI_SETTINGS));
    addAuditLog('Réinitialisation Charte IA', 'settings', 'ai_assistant', 'Restauration de la configuration IA');
  };

  const updateTermsVersion = (terms: TermsVersion) => {
    setTermsVersion(terms);
    addAuditLog('Mise à jour conditions', 'terms', terms.version, `Conditions générales version ${terms.version}`);
  };

  const addTermsClause = (clause: TermClause, actorName: string = 'Direction') => {
    setTermsVersion((prev) => ({
      ...prev,
      clauses: [...prev.clauses, clause],
    }));
    addAuditLog(
      'Ajout clause contractuelle',
      'terms',
      clause.number,
      `Nouvelle clause ${clause.number} (${clause.title}) ajoutée par ${actorName}`
    );
  };

  const updateTermsClause = (number: string, clauseData: Partial<TermClause>, actorName: string = 'Direction') => {
    setTermsVersion((prev) => ({
      ...prev,
      clauses: prev.clauses.map((c) => (c.number === number ? { ...c, ...clauseData } : c)),
    }));
    addAuditLog(
      'Modification clause contractuelle',
      'terms',
      number,
      `Clause ${number} mise à jour par ${actorName}`
    );
  };

  const deleteTermsClause = (number: string, actorName: string = 'Direction') => {
    setTermsVersion((prev) => ({
      ...prev,
      clauses: prev.clauses.filter((c) => c.number !== number),
    }));
    addAuditLog(
      'Suppression clause contractuelle',
      'terms',
      number,
      `Clause ${number} retirée des conditions générales par ${actorName}`
    );
  };

  return (
    <CompanyContext.Provider
      value={{
        companySettings,
        aiSettings,
        termsVersion,
        auditLogs,
        activeTab,
        theme,
        cloudSyncStatus,
        lastCloudSync,
        setActiveTab,
        setTheme,
        toggleTheme,
        updateCompanySettings,
        updateAiSettings,
        resetAiSettings,
        updateTermsVersion,
        addTermsClause,
        updateTermsClause,
        deleteTermsClause,
        addAuditLog,
        setCloudSyncStatus,
        setLastCloudSync,
        setCompanySettingsList: setCompanySettings,
        setAiSettingsList: setAiSettings,
        setTermsVersionList: setTermsVersion,
        setAuditLogsList: setAuditLogs,
      }}
    >
      {children}
    </CompanyContext.Provider>
  );
};

export const useCompany = () => {
  const context = useContext(CompanyContext);
  if (!context) {
    throw new Error('useCompany must be used within a CompanyProvider');
  }
  return context;
};
