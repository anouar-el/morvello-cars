import React from 'react';
import { useApp } from '../context/AppContext';
import { ActiveTab } from '../types';
import {
  LayoutDashboard,
  FileText,
  Users,
  Car,
  ShieldCheck,
  Settings,
  History,
  Banknote,
  KeyRound,
  Bot,
  Layers,
  CalendarDays,
  Wallet,
} from 'lucide-react';
import { getScopedDataForUser } from '../utils/managerScopeUtils';
import { useI18n } from '../i18n/I18nContext';

export interface NavItem {
  id: ActiveTab;
  label: string;
  icon: React.ReactNode;
  /** Texte détaillé pour la barre d'onglets (tablette). */
  badge?: number | string;
  /** Pastille numérique courte pour le menu latéral. */
  count?: number;
}

export interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
}

/** Entrées de navigation (barre d'onglets tablette et menu latéral PC), selon le rôle et le périmètre. */
export function useNavModel() {
  const { currentUser, contracts, vehicles, clients, deposits, users } = useApp();
  const { t } = useI18n();

  if (!currentUser) return null;

  const { scopedVehicles, scopedContracts, scopedDeposits, scopedClients } = getScopedDataForUser(
    currentUser,
    vehicles,
    contracts,
    deposits,
    clients,
    users
  );

  const approvedVehicles = scopedVehicles.filter((v) => v.approvalStatus === 'approved');
  const activeContractsCount = scopedContracts.filter((c) => c.status === 'active').length;
  const availableVehiclesCount = approvedVehicles.filter((v) => v.status === 'available').length;
  const pendingApprovalsCount = vehicles.filter((v) => v.approvalStatus === 'pending_approval').length;
  const myPendingCount = vehicles.filter(
    (v) => v.approvalStatus === 'pending_approval' && (v.proposedBy === currentUser.name || v.assignedManagerId === currentUser.id)
  ).length;
  const heldDepositsCount = scopedDeposits.filter((d) => d.status === 'held').length;
  const scopedClientsCount = scopedClients.length;
  const isAdmin = currentUser.role === 'admin';
  const isAgent = currentUser.role === 'agent';

  const items: Record<string, NavItem> = {
    dashboard: { id: 'dashboard', label: t('Dashboard'), icon: <LayoutDashboard className="w-4 h-4" /> },
    contracts: {
      id: 'contracts',
      label: t('Contrats'),
      icon: <FileText className="w-4 h-4" />,
      badge: activeContractsCount > 0 ? activeContractsCount : undefined,
      count: activeContractsCount,
    },
    planning: { id: 'planning', label: t('Planning'), icon: <CalendarDays className="w-4 h-4" /> },
    cashbook: { id: 'cashbook', label: t('Caisse'), icon: <Wallet className="w-4 h-4" /> },
    deposits: {
      id: 'deposits',
      label: t('Cautions'),
      icon: <Banknote className="w-4 h-4" />,
      badge: heldDepositsCount > 0 ? t('{n} actives', { n: heldDepositsCount }) : undefined,
      count: heldDepositsCount,
    },
    clients: {
      id: 'clients',
      label: t('Clients'),
      icon: <Users className="w-4 h-4" />,
      badge: currentUser.role === 'manager' ? t('{n} miens', { n: scopedClientsCount }) : clients.length > 0 ? `${clients.length}` : undefined,
      count: currentUser.role === 'manager' ? scopedClientsCount : clients.length,
    },
    vehicles: {
      id: 'vehicles',
      label: t('Véhicules'),
      icon: <Car className="w-4 h-4" />,
      badge: isAdmin
        ? pendingApprovalsCount > 0
          ? t('{n} ({m} à valider)', { n: availableVehiclesCount, m: pendingApprovalsCount })
          : t('{n} dispo', { n: availableVehiclesCount })
        : myPendingCount > 0
        ? t('{n} ({m} en attente)', { n: availableVehiclesCount, m: myPendingCount })
        : t('{n} dispo', { n: availableVehiclesCount }),
      count: availableVehiclesCount,
    },
    ai_assistant: {
      id: 'ai_assistant',
      label: t('Assistant IA'),
      icon: <Bot className="w-4 h-4 text-amber-400" />,
      badge: isAdmin ? '360°' : t('Privé'),
    },
    terms: { id: 'terms', label: t('Conditions V1.0'), icon: <ShieldCheck className="w-4 h-4" /> },
    permissions: {
      id: 'permissions',
      label: t('Équipe & Accès'),
      icon: <KeyRound className="w-4 h-4" />,
      badge: t('Sécurité'),
    },
    contract_templates: {
      id: 'contract_templates',
      label: t('Modèles de Contrat'),
      icon: <Layers className="w-4 h-4 text-amber-400" />,
      badge: t('3 Modèles'),
    },
    audit: { id: 'audit', label: t('Journal'), icon: <History className="w-4 h-4" /> },
    settings: { id: 'settings', label: t('Paramètres'), icon: <Settings className="w-4 h-4" /> },
  };

  // Même ordre qu'avant pour la barre d'onglets
  const flat: NavItem[] = [
    items.dashboard,
    items.contracts,
    items.planning,
    ...(isAgent ? [] : [items.cashbook]),
    items.deposits,
    items.clients,
    items.vehicles,
    items.ai_assistant,
    items.terms,
    ...(isAdmin ? [items.permissions, items.contract_templates] : []),
    items.audit,
    items.settings,
  ];

  const groups: NavGroup[] = [
    { id: 'main', label: t('Exploitation'), items: [items.dashboard, items.contracts, items.planning, ...(isAgent ? [] : [items.cashbook]), items.deposits] },
    { id: 'fleet', label: t('Flotte & clients'), items: [items.vehicles, items.clients] },
    { id: 'tools', label: t('Outils'), items: [items.ai_assistant] },
    ...(isAdmin ? [{ id: 'admin', label: t('Administration'), items: [items.permissions, items.contract_templates, items.audit] }] : []),
    {
      id: 'config',
      label: t('Configuration'),
      items: isAdmin ? [items.terms, items.settings] : [items.terms, items.audit, items.settings],
    },
  ];

  return {
    flat,
    groups,
    counts: { activeContractsCount, heldDepositsCount, availableVehiclesCount, pendingApprovalsCount },
  };
}
