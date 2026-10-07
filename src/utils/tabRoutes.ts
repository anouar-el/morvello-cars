import { ActiveTab } from '../types';

/** Adresse de chaque section. Un onglet absent de cette table partage l'adresse du tableau de bord. */
const TAB_PATHS: Partial<Record<ActiveTab, string>> = {
  dashboard: '/',
  contracts: '/contrats',
  new_contract: '/contrats/nouveau',
  deposits: '/cautions',
  clients: '/clients',
  vehicles: '/vehicules',
  ai_assistant: '/assistant',
  terms: '/conditions',
  permissions: '/equipe',
  contract_templates: '/modeles',
  audit: '/journal',
  settings: '/parametres',
};

export function pathForTab(tab: ActiveTab): string {
  return TAB_PATHS[tab] ?? '/';
}

/** Section correspondant à une adresse ; toute adresse inconnue ouvre le tableau de bord. */
export function tabForPath(pathname: string): ActiveTab {
  const normalized = pathname.toLowerCase().replace(/\/+$/, '') || '/';
  const match = (Object.entries(TAB_PATHS) as Array<[ActiveTab, string]>).find(([, path]) => path === normalized);
  return match ? match[0] : 'dashboard';
}
