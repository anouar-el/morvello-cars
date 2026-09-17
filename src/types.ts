export type DocumentType = 'CIN' | 'Passeport' | 'Carte de Séjour';

export type FuelType = 'Diesel' | 'Essence' | 'Hybride' | 'Électrique';

export type VehicleStatus = 'available' | 'rented' | 'maintenance' | 'inactive';

export type ContractStatus = 'draft' | 'active' | 'completed' | 'cancelled';

export type UserRole = 'admin' | 'manager' | 'agent';

export interface UserPermissions {
  // Contrats & Locations
  canCreateContracts: boolean;
  canEditContracts: boolean;
  canValidateContracts: boolean;
  canCancelContracts: boolean;
  canDeleteContracts: boolean;
  canExportData: boolean;
  // Cautions & Encaissements
  canManageDeposits: boolean;
  canCollectDeposit: boolean;
  canReleaseDeposit: boolean;
  canDeductDeposit: boolean;
  // Flotte & Véhicules
  canAddVehicles: boolean;
  canProposeVehicles: boolean;
  canDirectAddVehicles: boolean;
  canApproveVehicles: boolean;
  canAssignFleet: boolean;
  canAssignVehicleManager: boolean;
  canEditVehicles: boolean;
  canDeleteVehicles: boolean;
  canManageMaintenanceExpenses?: boolean;
  canImportVehiclesExcel?: boolean; // Sécurité xlsx: import en masse restreint aux administrateurs
  // Clients & Conducteurs
  canManageClients: boolean;
  canCreateClients: boolean;
  canEditClients: boolean;
  canDeleteClients: boolean;
  // Juridique, Journal & Système
  canManageTerms: boolean;
  canManageCompanySettings: boolean;
  canViewAuditLogs: boolean;
  canManagePermissions: boolean;
}

export interface User {
  id: string;
  name: string;
  role: UserRole;
  email: string;
  phone?: string;
  password?: string;
  passwordHash?: string;
  passwordSalt?: string;
  firebaseUid?: string;
  authProvider?: 'password' | 'google' | 'agency' | 'local';
  agency?: string;
  assignedFleetName?: string;
  permissions?: UserPermissions;
  assignedContractTemplate?: ContractTemplateId;
  mustChangePassword?: boolean;
  passwordResetLink?: string;
}

export type ContractTemplateId = 'standard' | 'prestige' | 'corporate';

export interface ContractTemplateInfo {
  id: ContractTemplateId;
  name: string;
  subtitle: string;
  badge: string;
  badgeColor: string;
  accentColor: string;
  borderColor: string;
  description: string;
  features: string[];
  recommendedFor: string;
  isDefault?: boolean;
}

export interface ClientDocument {
  id: string;
  category: 'cin' | 'driving_license' | 'other';
  side?: 'recto' | 'verso' | 'full';
  name: string;
  dataUrl: string;
  fileType: string;
  size?: number;
  uploadedAt: string;
}

export interface Client {
  id: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  drivingLicense: string;
  docType: DocumentType;
  docNumber: string;
  phone?: string;
  email?: string;
  country?: string;
  address?: string;
  notes?: string;
  cinDocUrl?: string;
  cinDocName?: string;
  cinDocVersoUrl?: string;
  cinDocVersoName?: string;
  licenseDocUrl?: string;
  licenseDocName?: string;
  licenseDocVersoUrl?: string;
  licenseDocVersoName?: string;
  documents?: ClientDocument[];
  createdAt: string;
  contractCount: number;
  lastContractDate?: string;
  lastContractNumber?: string;
  // Affectation Manager via le véhicule loué
  assignedManagerId?: string;
  assignedManagerName?: string;
  rentedVehicleBrand?: string;
  rentedVehicleModel?: string;
  rentedVehiclePlate?: string;
}

export interface Driver {
  id: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  drivingLicense: string;
  docType: DocumentType;
  docNumber: string;
  phone?: string;
  email?: string;
  notes?: string;
  createdAt: string;
}

export interface Vehicle {
  id: string;
  brand: string;
  model: string;
  plate: string;
  fuelType: FuelType;
  status: VehicleStatus;
  currentKm: number;
  dailyRate?: number;
  year?: number;
  color?: string;
  notes?: string;
  purchaseDate?: string;
  lastInspectionDate?: string;
  // Responsable attitré & Isolation de flotte
  assignedManagerId?: string;
  assignedManagerName?: string;
  // Statut de validation (Gérant vs Manager)
  approvalStatus?: 'approved' | 'pending_approval' | 'rejected';
  proposedBy?: string;
  proposedAt?: string;
  // Suivi Administratif & Technique (Assurance, Visite technique, Vignette, Vidange)
  insuranceExpiryDate?: string;
  insuranceCompany?: string;
  technicalInspectionExpiryDate?: string;
  vignettePaidYear?: number;
  nextOilChangeKm?: number;
  // Dépenses & Carnet d'entretien
  maintenanceExpenses?: VehicleExpense[];
}

export type ExpenseCategory =
  | 'oil_change' // Vidange + filtres
  | 'brakes' // Plaquettes / Disques
  | 'tires' // Pneus
  | 'mechanical' // Mécanique & Moteur
  | 'bodywork' // Carrosserie & Peinture
  | 'inspection' // Visite technique / Contrôle
  | 'insurance' // Assurance
  | 'vignette' // Vignette annuelle
  | 'wash_cleaning' // Lavage & Nettoyage
  | 'other'; // Autre

export interface VehicleExpense {
  id: string;
  vehicleId: string;
  category: ExpenseCategory;
  title: string;
  costMAD: number;
  date: string; // YYYY-MM-DD
  kmAtExpense: number;
  provider?: string; // e.g. Garage Midas Nouaceur, Concessionnaire Renault, etc.
  invoiceNumber?: string;
  notes?: string;
  createdAt: string;
  recordedBy: string;
  nextOilChangeTargetKm?: number; // Si vidange effectuée, nouveau seuil kilométrique défini
}

export interface ProlongationData {
  isActive: boolean;
  newEndDate: string;
  newEndTime: string;
  notes?: string;
  requestedAt?: string;
}

export interface ClientSnapshot {
  id: string;
  firstName: string;
  lastName: string;
  fullName?: string;
  birthDate: string;
  drivingLicense: string;
  docType: DocumentType;
  docNumber: string;
  phone?: string;
  email?: string;
  address?: string;
  country?: string;
  cinDocUrl?: string;
  cinDocName?: string;
  cinDocVersoUrl?: string;
  cinDocVersoName?: string;
  licenseDocUrl?: string;
  licenseDocName?: string;
  licenseDocVersoUrl?: string;
  licenseDocVersoName?: string;
  documents?: ClientDocument[];
}

export interface DriverSnapshot {
  firstName: string;
  lastName: string;
  birthDate: string;
  drivingLicense: string;
  docType: DocumentType;
  docNumber: string;
  phone?: string;
  email?: string;
}

export interface VehicleSnapshot {
  id: string;
  brand: string;
  model: string;
  plate: string;
  fuelType: FuelType;
  transmission?: string;
  color?: string;
  year?: number;
}

export type DepositMethod = 'preauth_card' | 'cheque' | 'cash' | 'virement';
export type DepositStatus = 'held' | 'released' | 'partially_deducted' | 'fully_retained';

export interface DepositDeduction {
  id: string;
  reason: 'fuel' | 'late_return' | 'traffic_fine' | 'damage' | 'cleaning' | 'other';
  label: string;
  amount: number;
  date: string;
  notes?: string;
}

export interface DepositRecord {
  id: string;
  contractId: string;
  contractNumber: string;
  clientId: string;
  clientName: string;
  clientPhone: string;
  vehicleName: string;
  vehiclePlate: string;
  amount: number;
  method: DepositMethod;
  methodDetails?: string; // e.g. "Chèque N° 884920" ou "Empreinte CB VISA *4920"
  status: DepositStatus;
  receivedAt: string;
  receivedBy: string;
  releasedAt?: string;
  releasedBy?: string;
  deductions: DepositDeduction[];
  refundedAmount?: number;
  notes?: string;
}

export interface InspectionPhoto {
  id: string;
  url: string; // base64 or url
  stage: 'departure' | 'return';
  phase?: 'departure' | 'return';
  zone: string;
  zoneLabel?: string;
  type?: string;
  description?: string;
  notes?: string;
  timestamp: string;
  severity?: 'minor' | 'medium' | 'major';
  takenBy?: string;
}

export interface ContractInspection {
  departureDate?: string;
  departureKm?: number;
  departureFuel?: string;
  departureInspector?: string;
  departureNotes?: string;
  returnDate?: string;
  returnKm?: number;
  returnFuel?: string;
  returnInspector?: string;
  returnNotes?: string;
  departureChecklist: {
    spareWheel?: boolean;
    jack?: boolean;
    triangle?: boolean;
    vest?: boolean;
    cleanInterior?: boolean;
    cleanExterior?: boolean;
    documentsPresent?: boolean;
    documents?: boolean;
    safetyKit?: boolean;
    cleanliness?: 'propre' | 'moyen' | 'sale';
    fuelLevel?: string; // e.g. '8/8', '6/8', '4/8', '2/8'
    bodyCondition?: 'conforme' | 'defauts_signales';
    [key: string]: any;
  };
  returnChecklist?: {
    spareWheel?: boolean;
    jack?: boolean;
    triangle?: boolean;
    vest?: boolean;
    cleanInterior?: boolean;
    cleanExterior?: boolean;
    documentsPresent?: boolean;
    documents?: boolean;
    safetyKit?: boolean;
    cleanliness?: 'propre' | 'moyen' | 'sale';
    fuelLevel?: string;
    bodyCondition?: 'conforme' | 'nouveaux_degats';
    [key: string]: any;
  };
  notes?: string;
  photos: InspectionPhoto[];
}

export interface Contract {
  id: string;
  contractNumber: string;
  status: ContractStatus;
  clientId: string;
  clientSnapshot: ClientSnapshot;
  hasSecondDriver: boolean;
  secondDriverSnapshot?: DriverSnapshot;
  vehicleId: string;
  vehicleSnapshot: VehicleSnapshot;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  departureKm: number;
  departureFuel?: string;
  returnKm?: number;
  returnDate?: string;
  returnTime?: string;
  returnFuel?: string;
  prolongation: ProlongationData;
  termsVersion: string;
  totalDays: number;
  pricePerDay?: number;
  totalAmount?: number;
  depositAmount?: number;
  depositRecord?: DepositRecord;
  inspection?: ContractInspection;
  createdAt: string;
  createdBy: string;
  assignedManagerId?: string;
  assignedManagerName?: string;
  managerPhone?: string;
  notes?: string;
  pdfUrl?: string;
  templateId?: ContractTemplateId;
  // Signatures Numériques Électroniques (Certifiées A4)
  clientSignature?: string; // Data URL PNG de la signature manuscrite du client
  clientSignedAt?: string; // Date et heure ISO de signature
  clientSignedName?: string; // Nom confirmé du signataire
  secondDriverSignature?: string; // Signature manuscrite 2ème conducteur (si applicable)
  secondDriverSignedAt?: string;
  agencySignature?: string; // Signature manuscrite de l'agent / gérant
  agencySignedAt?: string;
  agencySignedBy?: string;
  signatureCertId?: string; // Code d'intégrité / certificat unique (ex: MORV-SIG-2026-...)
}

export interface TermClause {
  number: string;
  title: string;
  content: string;
}

export interface TermsVersion {
  id: string;
  version: string;
  date: string;
  status: 'active' | 'archived';
  title: string;
  clauses: TermClause[];
  notes?: string;
}

export interface CompanySettings {
  name: string;
  taxId: string; // IF: 66223306
  rc: string; // RC: 664751
  ice: string; // ICE: 00366965500062
  patente?: string; // Patente
  address: string;
  phone1: string;
  phone2: string;
  assistancePhone?: string;
  website: string;
  email: string;
  contractPrefix: string;
  contractYear: number;
  nextContractNumber: number;
  defaultContractTemplate?: ContractTemplateId;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userName: string;
  userRole: UserRole;
  action: string;
  targetType: 'client' | 'contract' | 'vehicle' | 'driver' | 'terms' | 'settings' | 'user_permission' | 'contract_template' | 'maintenance_expense';
  targetId: string;
  details: string;
}

export type ActiveTab =
  | 'dashboard'
  | 'new_contract'
  | 'contracts'
  | 'contract_detail'
  | 'clients'
  | 'client_detail'
  | 'drivers'
  | 'vehicles'
  | 'deposits'
  | 'ai_assistant'
  | 'terms'
  | 'settings'
  | 'audit'
  | 'permissions'
  | 'contract_templates';

export interface AgentChatMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: string;
}

export const DEFAULT_PERMISSIONS_BY_ROLE: Record<UserRole, UserPermissions> = {
  admin: {
    canCreateContracts: true,
    canEditContracts: true,
    canValidateContracts: true,
    canCancelContracts: true,
    canDeleteContracts: true,
    canExportData: true,
    canManageDeposits: true,
    canCollectDeposit: true,
    canReleaseDeposit: true,
    canDeductDeposit: true,
    canAddVehicles: true,
    canProposeVehicles: true,
    canDirectAddVehicles: true,
    canApproveVehicles: true,
    canAssignFleet: true,
    canAssignVehicleManager: true,
    canEditVehicles: true,
    canDeleteVehicles: true,
    canManageMaintenanceExpenses: true,
    canImportVehiclesExcel: true,
    canManageClients: true,
    canCreateClients: true,
    canEditClients: true,
    canDeleteClients: true,
    canManageTerms: true,
    canManageCompanySettings: true,
    canViewAuditLogs: true,
    canManagePermissions: true,
  },
  manager: {
    canCreateContracts: true,
    canEditContracts: true,
    canValidateContracts: true,
    canCancelContracts: false,
    canDeleteContracts: false,
    canExportData: true,
    canManageDeposits: true,
    canCollectDeposit: true,
    canReleaseDeposit: true,
    canDeductDeposit: true,
    canAddVehicles: true,
    canProposeVehicles: true,
    canDirectAddVehicles: false,
    canApproveVehicles: false,
    canAssignFleet: false,
    canAssignVehicleManager: false,
    canEditVehicles: true,
    canDeleteVehicles: true,
    canManageMaintenanceExpenses: true,
    canImportVehiclesExcel: false,
    canManageClients: true,
    canCreateClients: true,
    canEditClients: true,
    canDeleteClients: true,
    canManageTerms: false,
    canManageCompanySettings: false,
    canViewAuditLogs: false,
    canManagePermissions: false,
  },
  agent: {
    canCreateContracts: true,
    canEditContracts: false,
    canValidateContracts: false,
    canCancelContracts: false,
    canDeleteContracts: false,
    canExportData: false,
    canManageDeposits: true,
    canCollectDeposit: true,
    canReleaseDeposit: false,
    canDeductDeposit: false,
    canAddVehicles: true,
    canProposeVehicles: true,
    canDirectAddVehicles: false,
    canApproveVehicles: false,
    canAssignFleet: false,
    canAssignVehicleManager: false,
    canEditVehicles: false,
    canDeleteVehicles: false,
    canManageMaintenanceExpenses: false,
    canImportVehiclesExcel: false,
    canManageClients: true,
    canCreateClients: true,
    canEditClients: false,
    canDeleteClients: false,
    canManageTerms: false,
    canManageCompanySettings: false,
    canViewAuditLogs: false,
    canManagePermissions: false,
  },
};

export type AiToneOfVoice =
  | 'luxury_concierge'
  | 'business_formal'
  | 'warm_commercial'
  | 'direct_operational';

export type AiLanguagePreference =
  | 'french_darija'
  | 'french_only'
  | 'darija_arabic_french';

export interface AiSampleResponse {
  id: string;
  scenario: string;
  idealReply: string;
}

export interface AiAssistantSettings {
  brandVision: string;
  toneOfVoice: AiToneOfVoice;
  languagePreference: AiLanguagePreference;
  signatureGreeting: string;
  keyValues: string[];
  prohibitedBehaviors: string[];
  standardPricingRule: string;
  sampleResponses: AiSampleResponse[];
  customInstructions: string;
}

export const DEFAULT_AI_SETTINGS: AiAssistantSettings = {
  brandVision:
    "Morvello Cars incarne la conciergerie automobile haut de gamme au Maroc (Casablanca, Nouaceur, Régions) : rigueur opérationnelle, hospitalité marocaine d'exception, ponctualité absolue et transparence irréprochable sur les contrats et les cautions.",
  toneOfVoice: 'luxury_concierge',
  languagePreference: 'french_darija',
  signatureGreeting: "Sté MORVELLO CARS • Where luxury meets the road",
  keyValues: [
    'Hospitalité & élégance : accueil VIP courtois et bienveillant',
    'Rigueur & clarté : état des lieux millimétré, documents conformes (CIN, Permis, Caution)',
    'Transparence totale : explications précises sur les franchises et la restitution de caution',
    'Réactivité 24/7 : assistance rapide en cas d’imprévu ou de prolongation',
  ],
  prohibitedBehaviors: [
    'Ne jamais accorder de remises non autorisées par le gérant ou déroger au tarif standard',
    'Ne jamais divulguer d’informations sur les véhicules ou contrats d’une autre agence (cloisonnement strict)',
    'Ne jamais adopter un ton familier, arrogant ou agressif, même en cas de litige client',
    'Ne pas valider de restitution de caution sans contrôle physique complet du véhicule',
  ],
  standardPricingRule:
    'Tarif de référence : 300 MAD/jour standard pour les citadines et compactes (Peugeot 208, Citroën C3/C-Elysée, Renault Kardian). Caution standard : 5 000 MAD par pré-autorisation carte bancaire ou chèque avec accord préalable.',
  sampleResponses: [
    {
      id: 'sample-1',
      scenario: 'Accueil & Confirmation de réservation (WhatsApp)',
      idealReply:
        "Salam Marhba bikoum chez Morvello Cars ! ✨\nNous confirmons avec plaisir la mise à disposition de votre véhicule pour votre séjour. Notre équipe vous attend à l'agence avec votre contrat prêt. Pensez à vous munir de votre permis de conduire original et de votre pièce d'identité. Restant à votre entière disposition pour tout renseignement.",
    },
    {
      id: 'sample-2',
      scenario: 'Rappel courtois d’heure de retour (SMS / WhatsApp)',
      idealReply:
        "Bonjour Cher Client Morvello Cars,\nNous espérons que votre route s'est déroulée dans d'excellentes conditions. Pour rappel, la restitution de votre véhicule est prévue aujourd'hui à l'heure convenue. Merci de prévoir le véhicule avec le même niveau de carburant pour une clôture d'état des lieux rapide et la libération immédiate de votre caution.",
    },
    {
      id: 'sample-3',
      scenario: 'Demande de prolongation de contrat',
      idealReply:
        "Bonjour Cher Client,\nNous pouvons volontiers étudier la prolongation de votre contrat sous réserve de disponibilité du véhicule sur le planning. Le tarif appliqué reste notre tarif standard de 300 MAD/jour. Souhaitez-vous que nous validions dès maintenant le prolongement de X jours avec avenant contractuel ?",
    },
  ],
  customInstructions:
    "Prioriser toujours la sécurité juridique de la société Morvello Cars, valoriser la propreté et la modernité de la flotte récente 2026, et veiller à une communication chaleureuse et valorisante pour nos clients touristes et professionnels.",
};


export type ThemeMode = 'dark' | 'light';
