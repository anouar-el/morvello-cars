import { ContractTemplateInfo, ContractTemplateId } from '../types';

export const CONTRACT_TEMPLATES: ContractTemplateInfo[] = [
  {
    id: 'standard',
    name: 'Modèle Standard Morvello (Officiel)',
    subtitle: 'Modèle bilingue complet & équilibré',
    badge: 'Modèle Actuel',
    badgeColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
    accentColor: '#d97706', // amber-600
    borderColor: 'border-amber-500',
    description:
      'Le modèle contractuel historique de référence de la Sté Morvello Cars. Agencement A4 recto-verso optimisé avec en-tête bilingue FR/AR, grille complète locataire & 2ème conducteur agréé, cartouche financier et inspection technique carrosserie.',
    features: [
      'En-tête officiel avec cartouche bilingue Français / Arabe',
      'Schéma technique complet d’inspection 4 vues carrosserie & carburant',
      'Grille équilibrée locataire principal et 2ème conducteur agréé',
      'Verso A4 avec les 20 clauses contractuelles de location (v1.0)',
      'Emplacement cachet juridique d’agence et signature manuelle certifiée',
    ],
    recommendedFor: 'Recommandé pour les locations courantes, agences urbaines, aéroports et tous types de véhicules citadines / berlines.',
    isDefault: true,
  },
  {
    id: 'prestige',
    name: 'Modèle Prestige VIP & Conciergerie',
    subtitle: 'Finition Haute Joaillerie Noire & Or',
    badge: 'Nouveau • Luxe VIP',
    badgeColor: 'bg-amber-500/25 text-amber-300 border-amber-400/60',
    accentColor: '#f59e0b', // gold/amber-500
    borderColor: 'border-amber-400',
    description:
      'Spécialement pensé pour les clients VIP, les véhicules de grand luxe (Porsche, Mercedes-AMG, Range Rover) et les prestations de conciergerie privée. Présente une charte graphique luxueuse noire et or impérial avec garanties de service haut de gamme.',
    features: [
      'Charte graphique haut de gamme Noire Onyx & Or Impérial avec dorure',
      'Mention exclusive « Client Privilégié VIP » et service conciergerie 24/7',
      'Ligne téléphonique prioritaire du Responsable Privé dédiée',
      'Pack d’assurance et franchise chiffrée imprimés sur le contrat',
      'Inspection esthétique renforcée (jantes alliage, sellerie cuir noble, vitres)',
      'Verso A4 avec Charte de Conciergerie VIP & engagements d’excellence',
    ],
    recommendedFor: 'Idéal pour la flotte Prestige, SUV de luxe, clientèle étrangère VIP, cérémonies et services de conciergerie avec chauffeur.',
    isDefault: false,
  },
  {
    id: 'corporate',
    name: 'Modèle Entreprise & Longue Durée (B2B)',
    subtitle: 'Format exécutif Flottes & Sociétés',
    badge: 'Nouveau • Corporate B2B',
    badgeColor: 'bg-blue-500/25 text-blue-300 border-blue-400/60',
    accentColor: '#2563eb', // blue-600
    borderColor: 'border-blue-500',
    description:
      'Conçu pour les clients professionnels, sociétés, cadres d’entreprises et locations longue durée (LLD / Moyenne Durée). Intègre tous les identifiants fiscaux entreprise (ICE, RC, IF), centre de coût, bon de commande et gestion des conducteurs salariés.',
    features: [
      'Charte exécutive Bleu Marine Affaires & Ardoise structurée',
      'Bloc Entreprise B2B dédié : Raison Sociale, ICE, RC, IF, N° Bon de Commande',
      'Section conducteurs salariés mandatés et préposés de la société',
      'Facturation HT / TVA 20% adressée séparément (aucun montant imprimé sur le contrat)',
      'Forfait kilométrique pro mensuel (km inclus & barème km supplémentaire)',
      'Verso A4 avec Conditions Générales Professionnelles & Règles de Flotte B2B',
    ],
    recommendedFor: 'Recommandé pour les comptes entreprises, PME/PMI, contrats cadres mensuels et flottes commerciales.',
    isDefault: false,
  },
  {
    id: 'signature',
    name: 'Modèle Signature Morvello (Moderne)',
    subtitle: 'La charte Standard, modernisée',
    badge: 'Nouveau • Recommandé',
    badgeColor: 'bg-violet-500/25 text-violet-300 border-violet-400/60',
    accentColor: '#1e3a8a',
    borderColor: 'border-violet-500',
    description:
      'Évolution du modèle Standard Morvello : même en-tête à cartouche, mêmes rubriques colorées bilingues FR / AR, mais alimentées par les données réelles du contrat (inspection, carburant, 2ème conducteur). Aucun tarif n’est imprimé : les prix restent internes à l’agence.',
    features: [
      'En-tête officiel du Standard : logo, assistance 24/7, cartouche N° de contrat',
      'Rubriques colorées Locataire, Véhicule, Durée, Garanties et Signatures',
      'Contrôle de départ issu de l’inspection réelle (« À vérifier » si non renseignée)',
      'Jauge carburant 8 segments et observations de départ',
      'Cadre de signature dédié au 2ème conducteur et référence de signature électronique',
      'Verso A4 identique au Standard : 20 articles, frais particuliers et paraphes',
    ],
    recommendedFor: 'Recommandé comme modèle par défaut pour toutes les locations : particuliers, agences urbaines et aéroport.',
    isDefault: false,
  },
];

export function getContractTemplate(id?: ContractTemplateId): ContractTemplateInfo {
  const found = CONTRACT_TEMPLATES.find((t) => t.id === id);
  return found || CONTRACT_TEMPLATES[0];
}
