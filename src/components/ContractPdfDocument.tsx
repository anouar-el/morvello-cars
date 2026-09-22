import React from 'react';
import { Contract, CompanySettings, TermsVersion, ContractTemplateId } from '../types';
import { CheckCircle2, Calendar, Clock, Gauge, Car, Shield, Phone, MapPin, User, Mail, CreditCard, Coins } from 'lucide-react';
import { CompanyStamp } from './CompanyStamp';
import { CompanyLogo } from './CompanyLogo';
import { formatPlateFrench } from '../utils/plateUtils';
import { useApp } from '../context/AppContext';
import { PrestigeContractPdfLayout } from './templates/PrestigeContractPdfLayout';
import { CorporateContractPdfLayout } from './templates/CorporateContractPdfLayout';

interface ContractPdfDocumentProps {
  contract: Contract;
  companySettings: CompanySettings;
  termsVersion: TermsVersion;
  showPageIndicator?: boolean;
  layout?: 'stacked' | 'side-by-side';
  idPrefix?: string;
  managerPhone?: string;
  managerName?: string;
  templateId?: ContractTemplateId;
}

export const ContractPdfDocument: React.FC<ContractPdfDocumentProps> = ({
  contract,
  companySettings,
  termsVersion,
  showPageIndicator = true,
  layout = 'stacked',
  idPrefix = 'preview',
  managerPhone: propManagerPhone,
  managerName: propManagerName,
  templateId,
}) => {
  const page1Id = `${idPrefix}-contract-pdf-page-1`;
  const page2Id = `${idPrefix}-contract-pdf-page-2`;

  // Récupération du contexte pour identifier le manager responsable
  let appUsers: any[] = [];
  let appVehicles: any[] = [];
  try {
    const app = useApp();
    appUsers = app?.users || [];
    appVehicles = app?.vehicles || [];
  } catch {
    // Cas de secours si hors contexte
  }

  // Résolution du modèle de contrat applicable
  const activeTemplateId: ContractTemplateId =
    templateId ||
    contract.templateId ||
    (contract.assignedManagerId && appUsers.length > 0
      ? appUsers.find((u) => u.id === contract.assignedManagerId)?.assignedContractTemplate
      : undefined) ||
    companySettings.defaultContractTemplate ||
    'standard';

  // Résolution intelligente du Manager responsable et de son téléphone direct
  const resolvedManager = (() => {
    // 1. Props explicites passées au composant
    if (propManagerPhone) {
      return {
        phone: propManagerPhone,
        name: propManagerName || contract.assignedManagerName || '',
      };
    }

    // 2. Déjà renseigné sur l'objet contrat
    if (contract.managerPhone) {
      return {
        phone: contract.managerPhone,
        name: contract.assignedManagerName || '',
      };
    }

    // 3. Par l'ID manager assigné au contrat
    if (contract.assignedManagerId && appUsers.length > 0) {
      const u = appUsers.find((user) => user.id === contract.assignedManagerId);
      if (u) {
        return {
          phone: u.phone || companySettings.phone1,
          name: u.name,
        };
      }
    }

    // 4. Par le véhicule loué (flotte / manager attitré du véhicule)
    if (contract.vehicleId && appVehicles.length > 0) {
      const v = appVehicles.find((veh) => veh.id === contract.vehicleId);
      if (v?.assignedManagerId) {
        const u = appUsers.find((user) => user.id === v.assignedManagerId);
        if (u) {
          return {
            phone: u.phone || companySettings.phone1,
            name: u.name || v.assignedManagerName || '',
          };
        }
      }
    }

    // 5. Par l'agent / manager créateur du contrat
    if (contract.createdBy && appUsers.length > 0) {
      const u = appUsers.find((user) => user.name.toLowerCase() === contract.createdBy.toLowerCase());
      if (u?.phone) {
        return {
          phone: u.phone,
          name: u.name,
        };
      }
    }

    // 6. Secours : numéro central de l'agence
    return {
      phone: companySettings.phone1,
      name: contract.assignedManagerName || '',
    };
  })();

  const activePhone = resolvedManager.phone && resolvedManager.phone.trim().length > 0
    ? resolvedManager.phone
    : companySettings.phone1;
  const displayManagerName = resolvedManager.name;

  const formattedStartDate = new Date(contract.startDate).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const formattedEndDate = new Date(contract.endDate).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const formattedCreatedAt = new Date(contract.createdAt).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  // Balanced 2-column continuous reading order for Page 2 (Articles 1-10 in Col 1, 11-20 in Col 2)
  const halfClauses = Math.ceil(termsVersion.clauses.length / 2);
  const col1Clauses = termsVersion.clauses.slice(0, halfClauses);
  const col2Clauses = termsVersion.clauses.slice(halfClauses);

  // ROUTAGE VERS LES MAQUETTES SPÉCIFIQUES
  if (activeTemplateId === 'prestige') {
    return (
      <PrestigeContractPdfLayout
        contract={contract}
        companySettings={companySettings}
        termsVersion={termsVersion}
        layout={layout}
        page1Id={page1Id}
        page2Id={page2Id}
        activePhone={activePhone}
        displayManagerName={displayManagerName}
        formattedStartDate={formattedStartDate}
        formattedEndDate={formattedEndDate}
        formattedCreatedAt={formattedCreatedAt}
      />
    );
  }

  if (activeTemplateId === 'corporate') {
    return (
      <CorporateContractPdfLayout
        contract={contract}
        companySettings={companySettings}
        termsVersion={termsVersion}
        layout={layout}
        page1Id={page1Id}
        page2Id={page2Id}
        activePhone={activePhone}
        displayManagerName={displayManagerName}
        formattedStartDate={formattedStartDate}
        formattedEndDate={formattedEndDate}
        formattedCreatedAt={formattedCreatedAt}
      />
    );
  }

  return (
    <div
      className={`pdf-document-root flex ${
        layout === 'side-by-side' ? 'flex-col xl:flex-row' : 'flex-col'
      } items-center gap-8 print:!flex-col print:!gap-0`}
    >
      {/* ========================================================================= */}
      {/* PAGE 1: CONTRAT DE LOCATION (RECTO)                                       */}
      {/* ========================================================================= */}
      <div id={page1Id} className="a4-page contract-a4-page flex flex-col justify-between text-slate-900 border border-slate-300 print:border-none">
        <div className="flex-1 flex flex-col justify-between">
          {/* ========================================================================= */}
          {/* HEADER MODERNE HAUT DE GAMME : LOGO, INFORMATIONS D'AGENCE & CARTOUCHE    */}
          {/* ========================================================================= */}
          <div className="pb-1.5 mb-2">
            <div className="bg-white border border-slate-200/90 rounded-xl p-2.5 shadow-2xs">
              <div className="grid grid-cols-12 items-center gap-3">
                {/* 1. LOGO OFFICIEL & SIGNATURE PRESTIGE (Gauche - 4 colonnes) */}
                <div className="col-span-4 shrink-0 flex items-center gap-2">
                  <div className="flex items-center shrink-0">
                    <CompanyLogo size="md" customHeight={68} variant="raw-image" className="h-[68px] w-auto max-w-[155px]" />
                  </div>
                  <div className="h-10 w-[1px] bg-slate-200 shrink-0" />
                  <div className="flex flex-col justify-center">
                    <span className="text-[7.2px] font-sans font-black uppercase tracking-wider text-amber-950 leading-tight">
                      Location de Voitures de Luxe
                    </span>
                    <span className="text-[6px] font-sans font-semibold text-slate-500 uppercase tracking-widest mt-0.5">
                      Prestige &amp; VIP
                    </span>
                  </div>
                </div>

                {/* 2. CENTRE ACTIF : ASSISTANCE 24/7 & LIGNE DIRECTE VIP (4 colonnes) */}
                <div className="col-span-4 px-2.5 border-x border-slate-200/90 flex flex-col justify-center gap-1.5">
                  {/* Capsule Prestige Assistance 24/7 */}
                  <div className="bg-gradient-to-r from-amber-500/15 via-amber-400/20 to-amber-500/15 border border-amber-400/80 rounded-lg px-2.5 py-1 text-center shadow-2xs">
                    <div className="flex items-center justify-center gap-1.5 text-[6.8px] font-black uppercase tracking-wider text-amber-950">
                      <Phone className="w-2.5 h-2.5 text-amber-700 shrink-0" />
                      <span>Assistance &amp; Dépannage 24/7</span>
                    </div>
                    <div className="text-[10px] font-mono font-black text-slate-950 tracking-wider mt-0.5">
                      {companySettings.assistancePhone || '0522582962 / 0522589535'}
                    </div>
                  </div>

                  {/* Coordonnées directes personnalisées selon le manager responsable */}
                  <div className="flex items-center justify-center text-[7.5px] font-mono bg-slate-50 border border-slate-200 px-2 py-1 rounded-md shadow-2xs">
                    <span className="flex items-center gap-1 text-slate-800">
                      <Phone className="w-2.5 h-2.5 text-blue-700 shrink-0" />
                      <span>Tél : <strong className="text-slate-950 font-bold">{activePhone}</strong></span>
                    </span>
                  </div>
                </div>

                {/* 3. CARTOUCHE DU CONTRAT EXÉCUTIF (Droite - 4 colonnes) */}
                <div className="col-span-4 flex flex-col justify-center">
                  <div className="rounded-lg overflow-hidden border border-slate-900 shadow-2xs">
                    {/* Titre bilingue sur ruban sombre prestige */}
                    <div className="bg-gradient-to-r from-slate-950 via-blue-950 to-slate-950 text-white px-2.5 py-1 flex items-center justify-between border-b border-amber-400/40">
                      <span className="text-[8.5px] font-black tracking-[0.14em] uppercase text-white">
                        CONTRAT DE LOCATION
                      </span>
                      <span className="text-[8.5px] font-bold font-arabic text-amber-300">
                        عقد كراء سيارة
                      </span>
                    </div>

                    {/* Numéro officiel gravé */}
                    <div className="bg-white px-2 py-1 flex items-center justify-center">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[7.5px] font-mono font-bold uppercase text-slate-400">
                          N°
                        </span>
                        <span className="font-mono text-[15px] font-black tracking-widest text-slate-950 bg-amber-50/90 border border-amber-300/80 px-2.5 py-0.5 rounded shadow-2xs">
                          {contract.contractNumber}
                        </span>
                      </div>
                    </div>

                    {/* Date d'émission & Statut certifié */}
                    <div className="bg-slate-50 border-t border-slate-200 px-2 py-0.5 flex items-center justify-between text-[6.8px] font-mono text-slate-600">
                      <span>Émis le : <strong className="text-slate-950 font-bold">{formattedCreatedAt}</strong></span>
                      <span className="bg-blue-100 text-blue-950 font-bold text-[6.2px] px-1.5 py-0.2 rounded border border-blue-200 uppercase">
                        ORIGINAL (RECTO)
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* BANDEAU INFÉRIEUR : IDENTIFIANTS FISCAUX & JURIDIQUES COMPLETS */}
              <div className="mt-2 pt-1.5 border-t border-slate-200/90 flex items-center justify-between text-[7px] font-mono text-slate-700 bg-slate-50/80 rounded px-2.5 py-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-slate-950 uppercase">{companySettings.name}</span>
                  <span className="text-slate-400">• SARL au Capital de 100 000 MAD</span>
                </div>
                <div className="flex items-center gap-2.5 text-slate-800">
                  <span>IF : <strong className="font-bold text-slate-950">{companySettings.taxId}</strong></span>
                  <span className="text-slate-300">|</span>
                  <span>RC : <strong className="font-bold text-slate-950">{companySettings.rc}</strong></span>
                  <span className="text-slate-300">|</span>
                  <span>ICE : <strong className="font-bold text-slate-950">{companySettings.ice}</strong></span>
                  <span className="text-slate-300">|</span>
                  <span>Patente : <strong className="font-bold text-slate-950">{companySettings.patente || '35894120'}</strong></span>
                </div>
              </div>
            </div>

            {/* Trait de séparation moderne double finition */}
            <div className="mt-1.5 space-y-0.5">
              <div className="h-[2px] bg-gradient-to-r from-slate-950 via-amber-600 to-slate-950 rounded-full" />
              <div className="h-[0.5px] bg-gradient-to-r from-transparent via-blue-800 to-transparent" />
            </div>
          </div>

          {/* ========================================================================= */}
          {/* SECTION 1: LOCATAIRE / CONDUCTEUR(S) - THÈME SAPHIR & BLEU ROYAL           */}
          {/* ========================================================================= */}
          <div className="border border-blue-200/90 rounded-xl bg-gradient-to-b from-blue-50/25 via-white to-slate-50/40 p-2.5 mb-2 shadow-xs">
            {/* Rubrique Header Coloré */}
            <div className="flex items-center justify-between border-b border-blue-200/80 pb-1 mb-2 bg-gradient-to-r from-blue-950 via-blue-900 to-indigo-950 text-white px-2.5 py-1 rounded-lg shadow-2xs">
              <h2 className="text-[10.5px] font-black uppercase tracking-wide flex items-center gap-2 text-white">
                <span className="w-5 h-5 bg-blue-500/30 border border-blue-300/40 rounded flex items-center justify-center shrink-0">
                  <User className="w-3 h-3 text-blue-200" />
                </span>
                <span>
                  {contract.hasSecondDriver && contract.secondDriverSnapshot
                    ? '1. Locataire Principal & 2ème Conducteur Agréé'
                    : '1. Locataire / Conducteur'}
                </span>
              </h2>
              <span className="text-[9.5px] text-blue-200 font-bold font-arabic">
                {contract.hasSecondDriver && contract.secondDriverSnapshot
                  ? 'المكتري والسائق الإضافي المرخص له'
                  : 'المكتري / السائق'}
              </span>
            </div>

            {contract.hasSecondDriver && contract.secondDriverSnapshot ? (
              /* CAS AVEC 2ÈME CONDUCTEUR : 2 COLONNES HARMONIEUSES AVEC COULEURS DÉDIÉES */
              <div className="space-y-2 text-[10px]">
                <div className="grid grid-cols-2 gap-2.5">
                  {/* CONDUCTEUR 1 - PRINCIPAL */}
                  <div className="bg-white p-2 rounded-lg border border-slate-200 border-l-4 border-l-blue-600 shadow-2xs flex flex-col justify-between">
                    <div className="flex items-center justify-between border-b border-blue-100 pb-1 mb-1">
                      <span className="text-blue-900 text-[8.5px] uppercase font-black tracking-wider">
                        Locataire Principal / السائق الرئيسي
                      </span>
                      <span className="text-[7.5px] bg-blue-50 text-blue-900 border border-blue-200 px-1.5 py-0.2 rounded font-bold uppercase">
                        Principal
                      </span>
                    </div>
                    <p className="font-black text-slate-950 uppercase text-xs tracking-wide">
                      {contract.clientSnapshot.lastName} {contract.clientSnapshot.firstName}
                    </p>
                    <div className="grid grid-cols-2 gap-1 mt-1 text-[9px] text-slate-700">
                      <div>
                        {contract.clientSnapshot.docType} : <strong className="font-mono text-slate-950">{contract.clientSnapshot.docNumber}</strong>
                      </div>
                      <div>
                        Permis : <strong className="font-mono text-slate-950">{contract.clientSnapshot.drivingLicense}</strong>
                      </div>
                    </div>
                    <div className="text-[9px] text-slate-700 mt-1 flex items-center justify-between">
                      <span>GSM : <strong className="font-mono text-slate-950">{contract.clientSnapshot.phone || 'Non renseigné'}</strong></span>
                      <span className="text-[8px] text-emerald-700 font-bold bg-emerald-50 px-1 rounded border border-emerald-200">✓ Titulaire</span>
                    </div>
                  </div>

                  {/* CONDUCTEUR 2 - SECONDAIRE */}
                  <div className="bg-white p-2 rounded-lg border border-slate-200 border-l-4 border-l-purple-600 shadow-2xs flex flex-col justify-between">
                    <div className="flex items-center justify-between border-b border-purple-100 pb-1 mb-1">
                      <span className="text-purple-900 text-[8.5px] uppercase font-black tracking-wider">
                        2ème Conducteur Agréé / السائق الإضافي
                      </span>
                      <span className="text-[7.5px] bg-purple-50 text-purple-900 border border-purple-200 px-1.5 py-0.2 rounded font-bold uppercase">
                        Agréé Morvello
                      </span>
                    </div>
                    <p className="font-black text-slate-950 uppercase text-xs tracking-wide">
                      {contract.secondDriverSnapshot.lastName} {contract.secondDriverSnapshot.firstName}
                    </p>
                    <div className="grid grid-cols-2 gap-1 mt-1 text-[9px] text-slate-700">
                      <div>
                        {contract.secondDriverSnapshot.docType} : <strong className="font-mono text-slate-950">{contract.secondDriverSnapshot.docNumber}</strong>
                      </div>
                      <div>
                        Permis : <strong className="font-mono text-slate-950">{contract.secondDriverSnapshot.drivingLicense}</strong>
                      </div>
                    </div>
                    <div className="text-[9px] text-slate-700 mt-1 flex items-center justify-between">
                      <span>GSM : <strong className="font-mono text-slate-950">{contract.secondDriverSnapshot?.phone || 'Non renseigné'}</strong></span>
                      <span className="text-[8px] text-emerald-700 font-bold bg-emerald-50 px-1 rounded border border-emerald-200">✓ Permis Valide</span>
                    </div>
                  </div>
                </div>

                {/* Coordonnées & Adresse complète */}
                <div className="bg-gradient-to-r from-blue-50/80 via-white to-blue-50/60 px-2.5 py-1.5 rounded-lg border border-blue-200/80 grid grid-cols-12 gap-2 text-[9px] shadow-2xs">
                  <div className="col-span-5 text-slate-700 flex items-center gap-1.5 truncate">
                    <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span className="truncate">
                      Adresse : <strong className="text-slate-950">{contract.clientSnapshot.address || 'Casablanca, Maroc'}</strong>
                    </span>
                  </div>
                  <div className="col-span-4 text-slate-700 truncate flex items-center gap-1">
                    <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                    {contract.clientSnapshot.email ? (
                      <span className="truncate">Email : <strong className="text-slate-950">{contract.clientSnapshot.email}</strong></span>
                    ) : (
                      <span className="text-slate-500 italic">Email : Non renseigné</span>
                    )}
                  </div>
                  <div className="col-span-3 text-right text-emerald-800 font-bold text-[8.5px] flex items-center justify-end gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    <span>2 conducteurs agréés</span>
                  </div>
                </div>
              </div>
            ) : (
              /* CAS CONDUCTEUR UNIQUE AVEC ACCENTS COLORÉS ÉLÉGANTS */
              <div className="grid grid-cols-12 gap-2.5 text-[10px]">
                {/* Nom & Prénom */}
                <div className="col-span-6 bg-white p-2 rounded-lg border border-slate-200 border-l-4 border-l-blue-600 shadow-2xs flex flex-col justify-between">
                  <span className="text-blue-900 text-[8px] uppercase font-black tracking-wider">
                    Nom &amp; Prénom / الإسم الكامل :
                  </span>
                  <p className="font-black text-slate-950 uppercase text-xs tracking-wide mt-0.5">
                    {contract.clientSnapshot.lastName} {contract.clientSnapshot.firstName}
                  </p>
                  <div className="text-[8.5px] text-slate-600 mt-0.5 flex items-center justify-between">
                    <span>Né(e) le : <strong className="text-slate-900">{contract.clientSnapshot.birthDate || '—'}</strong></span>
                    <span className="bg-blue-50 text-blue-950 border border-blue-200/80 px-1.5 py-0.2 rounded font-semibold text-[8px]">
                      {contract.clientSnapshot.country || 'Maroc'}
                    </span>
                  </div>
                </div>

                {/* Pièce d'identité (CIN / Passeport) */}
                <div className="col-span-3 bg-white p-2 rounded-lg border border-slate-200 border-l-4 border-l-indigo-600 shadow-2xs flex flex-col justify-between">
                  <span className="text-indigo-900 text-[8px] uppercase font-black tracking-wider">
                    {contract.clientSnapshot.docType} N° / رقم الهوية :
                  </span>
                  <p className="font-black font-mono text-slate-950 text-xs mt-0.5">
                    {contract.clientSnapshot.docNumber}
                  </p>
                  <span className="text-[7.5px] text-emerald-800 font-bold bg-emerald-50 border border-emerald-200/80 px-1 py-0.2 rounded mt-0.5 inline-block w-max">
                    ✓ Original vérifié
                  </span>
                </div>

                {/* Permis de conduire */}
                <div className="col-span-3 bg-white p-2 rounded-lg border border-slate-200 border-l-4 border-l-emerald-600 shadow-2xs flex flex-col justify-between">
                  <span className="text-emerald-900 text-[8px] uppercase font-black tracking-wider">
                    Permis / رخصة السياقة :
                  </span>
                  <p className="font-black font-mono text-slate-950 text-xs mt-0.5">
                    {contract.clientSnapshot.drivingLicense}
                  </p>
                  <span className="text-[7.5px] text-emerald-800 font-bold bg-emerald-50 border border-emerald-200/80 px-1 py-0.2 rounded mt-0.5 inline-block w-max">
                    Catégorie B (Valide)
                  </span>
                </div>

                {/* Coordonnées & Adresse complète */}
                <div className="col-span-12 bg-gradient-to-r from-blue-50/70 via-white to-blue-50/50 px-2.5 py-1.5 rounded-lg border border-blue-200/70 grid grid-cols-12 gap-2 text-[9px] shadow-2xs">
                  <div className="col-span-4 flex items-center gap-1.5 text-slate-800">
                    <Phone className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span>GSM : <strong className="font-mono text-slate-950 text-[10px]">{contract.clientSnapshot.phone || 'Non renseigné'}</strong></span>
                  </div>
                  <div className="col-span-4 text-slate-700 truncate flex items-center gap-1">
                    <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                    {contract.clientSnapshot.email ? (
                      <span className="truncate">Email : <strong className="text-slate-900">{contract.clientSnapshot.email}</strong></span>
                    ) : (
                      <span className="text-slate-500 italic">Email : Non renseigné</span>
                    )}
                  </div>
                  <div className="col-span-4 text-slate-700 flex items-center gap-1 truncate">
                    <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span className="truncate">
                      Adresse : <strong className="text-slate-900">{contract.clientSnapshot.address || 'Casablanca, Maroc'}</strong>
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ========================================================================= */}
          {/* SECTION 2: VÉHICULE & CONTRÔLE DE DÉPART - THÈME OR IMPÉRIAL & AMBRE      */}
          {/* ========================================================================= */}
          <div className="border border-amber-300/80 rounded-xl bg-gradient-to-b from-amber-50/25 via-white to-amber-50/10 p-2.5 mb-2 shadow-xs">
            {/* Rubrique Header Coloré */}
            <div className="flex items-center justify-between border-b border-amber-300/80 pb-1 mb-2 bg-gradient-to-r from-amber-900 via-amber-800 to-amber-950 text-white px-2.5 py-1 rounded-lg shadow-2xs">
              <h2 className="text-[10.5px] font-black uppercase tracking-wide flex items-center gap-2 text-white">
                <span className="w-5 h-5 bg-amber-400/30 border border-amber-300/40 rounded flex items-center justify-center shrink-0">
                  <Car className="w-3 h-3 text-amber-200" />
                </span>
                <span>2. Véhicule &amp; Contrôle de Départ</span>
              </h2>
              <span className="text-[9.5px] text-amber-200 font-bold font-arabic">
                بيانات وحالة السيارة عند التسليم
              </span>
            </div>

            <div className="grid grid-cols-12 gap-2.5 text-[10px]">
              {/* Marque & Modèle */}
              <div className="col-span-5 bg-white p-2 rounded-lg border border-slate-200 border-l-4 border-l-amber-600 shadow-2xs flex flex-col justify-between">
                <span className="text-amber-950 text-[8px] uppercase font-black tracking-wider">Marque &amp; Modèle / النوع :</span>
                <p className="font-black text-slate-950 uppercase text-xs tracking-wide mt-0.5">
                  {contract.vehicleSnapshot.brand} {contract.vehicleSnapshot.model}
                </p>
                <div className="text-[8.5px] text-slate-700 mt-0.5 flex items-center gap-2">
                  <span className="bg-amber-50 text-amber-950 border border-amber-200/80 px-1.5 py-0.2 rounded font-semibold text-[8px]">
                    {contract.vehicleSnapshot.fuelType}
                  </span>
                  <span className="bg-slate-100 text-slate-800 border border-slate-200 px-1.5 py-0.2 rounded font-semibold text-[8px]">
                    Tourisme / Prestige
                  </span>
                </div>
              </div>

              {/* Plaque d'immatriculation marocaine stylisée */}
              <div className="col-span-4 bg-gradient-to-b from-amber-100/90 via-amber-50 to-amber-100/70 p-1.5 rounded-lg border-2 border-amber-400/90 shadow-2xs flex flex-col items-center justify-center text-center">
                <span className="text-amber-950 text-[7.5px] uppercase font-black tracking-wider">
                  Immatriculation / رقم اللوحة
                </span>
                <div className="mt-0.5 bg-slate-950 text-amber-300 border border-amber-500/80 px-3 py-0.5 rounded shadow-xs">
                  <p className="font-mono font-black text-xs tracking-widest">
                    {formatPlateFrench(contract.vehicleSnapshot.plate)}
                  </p>
                </div>
                <span className="text-[7px] text-amber-900 font-bold mt-0.5 tracking-wide">Royaume du Maroc • تسجيل رسمي</span>
              </div>

              {/* Relevé Kilométrique */}
              <div className="col-span-3 bg-white p-2 rounded-lg border border-slate-200 border-l-4 border-l-slate-800 shadow-2xs flex flex-col justify-between text-right">
                <span className="text-slate-700 text-[8px] uppercase font-black tracking-wider">KM au Départ :</span>
                <p className="font-mono font-black text-slate-950 text-[13px] mt-0.5">
                  {contract.departureKm.toLocaleString('fr-FR')} <span className="text-[8.5px] font-normal text-slate-600">KM</span>
                </p>
                <div className="text-[8px] text-slate-700 mt-0.5">
                  Carburant : <strong className="text-emerald-700 font-bold">{contract.departureFuel || contract.inspection?.departureChecklist?.fuelLevel || '8/8 (Plein)'}</strong>
                </div>
              </div>
            </div>

            {/* Checklist de contrôle des équipements aux badges colorés */}
            <div className="mt-2 pt-1.5 border-t border-amber-200/60 grid grid-cols-4 gap-2 text-[8.5px]">
              <div className="bg-emerald-50/90 border border-emerald-200/80 text-emerald-950 rounded-md px-2 py-0.5 flex items-center gap-1.5 shadow-2xs">
                <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                <span>Roue secours : <strong>Présente</strong></span>
              </div>
              <div className="bg-emerald-50/90 border border-emerald-200/80 text-emerald-950 rounded-md px-2 py-0.5 flex items-center gap-1.5 shadow-2xs">
                <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                <span>Documents bord : <strong>Conformes</strong></span>
              </div>
              <div className="bg-emerald-50/90 border border-emerald-200/80 text-emerald-950 rounded-md px-2 py-0.5 flex items-center gap-1.5 shadow-2xs">
                <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                <span>Triangle &amp; Gilet : <strong>Présents</strong></span>
              </div>
              <div className="bg-emerald-50/90 border border-emerald-200/80 text-emerald-950 rounded-md px-2 py-0.5 flex items-center gap-1.5 justify-between shadow-2xs">
                <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                <span>Carrosserie : <strong>Conforme</strong></span>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* SECTION 3: DURÉE DE LA LOCATION - THÈME ÉMERAUDE & VERT IMPÉRIAL          */}
          {/* ========================================================================= */}
          <div className="border border-emerald-200/90 rounded-xl bg-gradient-to-b from-emerald-50/20 via-white to-emerald-50/10 p-2.5 mb-2 shadow-xs">
            {/* Rubrique Header Coloré */}
            <div className="flex items-center justify-between border-b border-emerald-300/80 pb-1 mb-2 bg-gradient-to-r from-emerald-900 via-teal-900 to-emerald-950 text-white px-2.5 py-1 rounded-lg shadow-2xs">
              <h2 className="text-[10.5px] font-black uppercase tracking-wide flex items-center gap-2 text-white">
                <span className="w-5 h-5 bg-emerald-500/30 border border-emerald-300/40 rounded flex items-center justify-center shrink-0">
                  <Calendar className="w-3 h-3 text-emerald-200" />
                </span>
                <span>3. Durée de la Location &amp; Modalités de Prise en Charge</span>
              </h2>
              <span className="text-[9.5px] text-emerald-200 font-bold font-arabic">
                مدة الكراء ومواعيد التسليم والاستلام
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2.5 text-[10px] mb-2">
              {/* Prise en charge */}
              <div className="bg-white p-2 rounded-lg border border-slate-200 border-t-4 border-t-emerald-600 shadow-2xs">
                <div className="flex justify-between items-center text-emerald-900 text-[8px] mb-0.5 font-bold">
                  <span className="uppercase flex items-center gap-1">
                    <Calendar className="w-2.5 h-2.5 text-emerald-700" /> Sortie / Départ
                  </span>
                  <span className="font-arabic">تاريخ الخروج</span>
                </div>
                <div className="font-black text-slate-950 text-[11.5px]">
                  {formattedStartDate}
                </div>
                <div className="text-slate-700 font-mono text-[9px] mt-0.5 flex items-center gap-1">
                  <Clock className="w-2.5 h-2.5 text-emerald-600" /> Heure : <strong className="text-slate-950">{contract.startTime}</strong>
                </div>
                <div className="text-[8px] text-slate-500 mt-0.5">Lieu : Nouaceur / Casablanca</div>
              </div>

              {/* Restitution */}
              <div className="bg-white p-2 rounded-lg border border-slate-200 border-t-4 border-t-amber-600 shadow-2xs">
                <div className="flex justify-between items-center text-amber-900 text-[8px] mb-0.5 font-bold">
                  <span className="uppercase flex items-center gap-1">
                    <Calendar className="w-2.5 h-2.5 text-amber-700" /> Restitution / Retour
                  </span>
                  <span className="font-arabic">تاريخ الدخول</span>
                </div>
                <div className="font-black text-slate-950 text-[11.5px]">
                  {formattedEndDate}
                </div>
                <div className="text-slate-700 font-mono text-[9px] mt-0.5 flex items-center gap-1">
                  <Clock className="w-2.5 h-2.5 text-amber-600" /> Heure : <strong className="text-slate-950">{contract.endTime}</strong>
                </div>
                <div className="text-[8px] text-slate-500 mt-0.5">Lieu : Nouaceur / Casablanca</div>
              </div>

              {/* Prolongation */}
              <div className="bg-white p-2 rounded-lg border border-slate-200 border-t-4 border-t-sky-600 shadow-2xs">
                <div className="flex justify-between items-center text-sky-900 text-[8px] mb-0.5 font-bold">
                  <span className="uppercase flex items-center gap-1">
                    <Shield className="w-2.5 h-2.5 text-sky-700" /> Prolongation
                  </span>
                  <span className="font-arabic">التمديد</span>
                </div>
                {contract.prolongation?.isActive ? (
                  <>
                    <div className="font-black text-sky-950 text-[11.5px]">
                      {new Date(contract.prolongation.newEndDate).toLocaleDateString('fr-FR')}
                    </div>
                    <div className="text-sky-800 font-mono text-[9px] mt-0.5">
                      Heure accordée : <strong>{contract.prolongation.newEndTime}</strong>
                    </div>
                    <div className="text-[7.5px] text-sky-700 font-bold mt-0.5">Prolongation validée</div>
                  </>
                ) : (
                  <div className="text-slate-600 text-[8px] pt-0.5 leading-snug">
                    Aucun accord de prolongation actif. Préavis 24h obligatoire.
                  </div>
                )}
              </div>
            </div>

            {/* RÉCAPITULATIF DE MISE À DISPOSITION EN 4 CARTES COLORÉES DISTINCTES */}
            <div className="grid grid-cols-4 gap-2 text-[9px]">
              <div className="bg-blue-50/80 border border-blue-200/80 rounded-lg p-1.5 text-center shadow-2xs">
                <span className="text-blue-900 text-[8px] uppercase font-bold block">Durée Totale :</span>
                <span className="text-xs font-black text-blue-950 block mt-0.5">{contract.totalDays} Jour(s)</span>
              </div>
              <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-lg p-1.5 text-center shadow-2xs">
                <span className="text-emerald-900 text-[8px] uppercase font-bold block">Kilométrage :</span>
                <span className="text-xs font-black text-emerald-950 block mt-0.5">Illimité (Usage Maroc)</span>
              </div>
              <div className="bg-amber-50/80 border border-amber-200/80 rounded-lg p-1.5 text-center shadow-2xs">
                <span className="text-amber-900 text-[8px] uppercase font-bold block">Carburant Restitution :</span>
                <span className="text-xs font-black text-amber-950 block mt-0.5">
                  À l'identique ({contract.departureFuel || contract.inspection?.departureChecklist?.fuelLevel || '8/8'})
                </span>
              </div>
              <div className="bg-slate-950 text-white rounded-lg p-1.5 text-center border border-slate-800 shadow-2xs flex flex-col justify-center">
                <span className="text-amber-400 text-[7.5px] uppercase font-black block leading-tight">Assistance 24/7 :</span>
                <span className="text-[9.5px] font-black text-white font-mono block leading-tight mt-0.5">
                  {companySettings.assistancePhone || '0522582962'}
                </span>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* SECTION 4: CONDITIONS TARIFAIRES & DÉPÔT DE GARANTIE                      */}
          {/* ========================================================================= */}
          <div className="border border-slate-300 rounded-xl bg-gradient-to-b from-slate-50 via-white to-amber-50/20 p-2 mb-2 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-200 pb-1 mb-1.5 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-950 text-white px-2.5 py-1 rounded-lg shadow-2xs">
              <div className="flex items-center gap-2">
                <h2 className="text-[10px] font-black uppercase tracking-wide flex items-center gap-2 text-white">
                  <span className="w-5 h-5 bg-amber-500/30 border border-amber-300/40 rounded flex items-center justify-center shrink-0">
                    <CreditCard className="w-3 h-3 text-amber-300" />
                  </span>
                  <span>4. Conditions Tarifaires &amp; Dépôt de Garantie (Caution)</span>
                </h2>
                {(() => {
                  const pdfPaid = (contract.paidAmount !== undefined ? contract.paidAmount : (contract.payments?.reduce((s, p) => s + (p.amount || 0), 0) ?? 0));
                  const pdfTotal = (contract.totalAmount ?? ((contract.pricePerDay || 0) * contract.totalDays));
                  const pdfRemaining = contract.remainingAmount !== undefined ? contract.remainingAmount : Math.max(0, pdfTotal - pdfPaid);
                  if (pdfTotal === 0 || pdfRemaining === 0) {
                    return (
                      <span className="text-[7.5px] font-bold text-emerald-300 bg-emerald-500/20 border border-emerald-400/40 px-1.5 py-0.2 rounded">
                        ✓ {pdfTotal === 0 ? 'Soldé (0 MAD)' : 'Soldé'}
                      </span>
                    );
                  }
                  if (pdfPaid > 0) {
                    return (
                      <span className="text-[7.5px] font-bold text-amber-300 bg-amber-500/20 border border-amber-400/40 px-1.5 py-0.2 rounded">
                        ⚡ Acompte Versé
                      </span>
                    );
                  }
                  return (
                    <span className="text-[7.5px] font-bold text-rose-300 bg-rose-500/20 border border-rose-400/40 px-1.5 py-0.2 rounded">
                      En attente de règlement
                    </span>
                  );
                })()}
              </div>
              <span className="text-[9px] text-amber-200 font-bold font-arabic">
                الشروط المالية ومبلغ الضمان
              </span>
            </div>

            <div className="grid grid-cols-12 gap-2 text-[9.5px]">
              {/* Tarif Journalier */}
              <div className="col-span-3 bg-white p-1.5 rounded-lg border border-slate-200 border-l-4 border-l-blue-600 shadow-2xs flex flex-col justify-between">
                <span className="text-blue-900 text-[7.5px] uppercase font-black tracking-wider">
                  Tarif Journalier / اليوم
                </span>
                <p className="font-mono font-black text-slate-950 text-xs mt-0.5">
                  {contract.pricePerDay !== undefined ? `${contract.pricePerDay.toLocaleString('fr-FR')} MAD` : 'Tarif convenu'}
                  <span className="text-[7.5px] font-normal text-slate-500 ml-1">/ jour</span>
                </p>
                <span className="text-[7px] text-slate-500 mt-0.5">TTC • Kilométrage illimité</span>
              </div>

              {/* Total Location */}
              <div className="col-span-3 bg-white p-1.5 rounded-lg border border-slate-200 border-l-4 border-l-amber-600 shadow-2xs flex flex-col justify-between">
                <span className="text-amber-950 text-[7.5px] uppercase font-black tracking-wider">
                  Total Facturé ({contract.totalDays}j)
                </span>
                <p className="font-mono font-black text-amber-950 text-[13px] mt-0.5">
                  {contract.totalAmount !== undefined
                    ? `${contract.totalAmount.toLocaleString('fr-FR')} MAD`
                    : contract.pricePerDay !== undefined
                    ? `${(contract.pricePerDay * contract.totalDays).toLocaleString('fr-FR')} MAD`
                    : 'Sur devis'}
                </p>
                <div className="mt-0.5 pt-0.5 border-t border-amber-100 flex items-center justify-between text-[7px]">
                  {(() => {
                    const pdfPaid = (contract.paidAmount !== undefined ? contract.paidAmount : (contract.payments?.reduce((s, p) => s + (p.amount || 0), 0) ?? 0));
                    const pdfTotal = (contract.totalAmount ?? ((contract.pricePerDay || 0) * contract.totalDays));
                    const pdfRemaining = contract.remainingAmount !== undefined ? contract.remainingAmount : Math.max(0, pdfTotal - pdfPaid);
                    return (
                      <>
                        <span className={`font-bold ${pdfPaid > 0 ? 'text-emerald-700' : 'text-slate-500'}`}>
                          Encaissé : {pdfPaid.toLocaleString('fr-FR')} MAD
                        </span>
                        <span className={`font-bold ${pdfRemaining > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                          Reste : {pdfRemaining.toLocaleString('fr-FR')} MAD {pdfRemaining === 0 ? '(Soldé)' : ''}
                        </span>
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Caution / Dépôt de garantie */}
              <div className="col-span-3 bg-white p-1.5 rounded-lg border border-slate-200 border-l-4 border-l-purple-600 shadow-2xs flex flex-col justify-between">
                <span className="text-purple-950 text-[7.5px] uppercase font-black tracking-wider">
                  Caution / الضمانة
                </span>
                <p className="font-mono font-black text-slate-950 text-xs mt-0.5">
                  {(contract.depositAmount !== undefined ? Number(contract.depositAmount) : (contract.depositRecord?.amount !== undefined ? Number(contract.depositRecord.amount) : 5000)).toLocaleString('fr-FR')} MAD
                </p>
                <span className="text-[7px] text-purple-900 font-semibold mt-0.5">
                  {contract.depositRecord?.method === 'cheque'
                    ? 'Chèque de caution'
                    : contract.depositRecord?.method === 'cash'
                    ? 'Espèces consignées'
                    : 'Empreinte CB bancaire'}
                </span>
              </div>

              {/* Modalités & Couverture */}
              <div className="col-span-3 bg-gradient-to-br from-slate-900 to-slate-950 text-white p-1.5 rounded-lg border border-slate-800 shadow-2xs flex flex-col justify-between text-right">
                <span className="text-amber-400 text-[7.5px] uppercase font-black tracking-wider">
                  Couverture Assurance
                </span>
                <p className="text-[9px] font-bold text-white mt-0.5">
                  Tous Risques Sérénité
                </p>
                <span className="text-[7px] text-slate-300 mt-0.5">Assistance 24/7 incluse</span>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* SECTION 5: SIGNATURES MANUSCRITES - THÈME ARDOISE NOIRE & OR IMPÉRIAL      */}
          {/* ========================================================================= */}
          <div className="border-2 border-slate-900 rounded-xl bg-gradient-to-b from-slate-100/90 via-white to-slate-50 p-2.5 shadow-xs">
            {/* Rubrique Header Coloré */}
            <div className="flex items-center justify-between border-b border-slate-700 pb-1 mb-2 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 text-white px-2.5 py-1 rounded-lg shadow-2xs">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 bg-amber-500/25 border border-amber-400/40 rounded flex items-center justify-center shrink-0">
                  <Shield className="w-3 h-3 text-amber-300" />
                </span>
                <span className="text-[9.5px] font-black uppercase tracking-wider text-amber-300">
                  5. Signatures Manuscrites Obligatoires — « Lu et approuvé »
                </span>
              </div>
              <span className="text-[8.5px] text-amber-200/90 font-bold font-arabic">
                توقيعات الأطراف مسبوقة بالعبارة الإلزامية "قرئ وصودق عليه"
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* 1. MORVELLO CARS & CACHET OFFICIEL */}
              <div className="border-2 border-amber-500/60 rounded-xl p-2 flex flex-col justify-between min-h-[130px] bg-gradient-to-b from-amber-50/30 to-white shadow-2xs relative">
                <div className="text-[9px] font-black uppercase text-amber-950 bg-amber-100/80 border border-amber-300/80 px-2 py-0.5 rounded-md text-center z-10 relative">
                  Pour Sté MORVELLO CARS • خاتم وتوقيع الوكالة
                </div>
                <div className="relative flex items-center justify-center py-1 z-0 flex-1">
                  <CompanyStamp size="md" rotation={-1.5} />
                  {contract.agencySignature && (
                    <img
                      src={contract.agencySignature}
                      alt="Signature Agence"
                      className="absolute max-h-[52px] max-w-[140px] object-contain z-10"
                    />
                  )}
                </div>
                <div className="text-[8px] text-slate-500 text-center z-10 font-medium">
                  {contract.agencySignedBy ? (
                    <span className="font-semibold text-slate-700">Signé par {contract.agencySignedBy}</span>
                  ) : (
                    'Visa & Cachet légal agence'
                  )}
                </div>
              </div>

              {/* 2. LOCATAIRE & CONDUCTEUR SECONDAIRE */}
              <div className="border-2 border-blue-900/40 rounded-xl p-2 flex flex-col justify-between min-h-[130px] bg-gradient-to-b from-blue-50/30 to-white shadow-2xs">
                <div className="text-[9px] font-black uppercase text-blue-950 bg-blue-100/80 border border-blue-300/80 px-2 py-0.5 rounded-md text-center">
                  {contract.hasSecondDriver && contract.secondDriverSnapshot
                    ? 'Signatures : Locataire & 2ème Conducteur'
                    : 'Signature du Locataire (Conducteur) • توقيع المكتري'}
                </div>

                {contract.clientSignature ? (
                  /* Affichage de la signature numérique réelle du locataire */
                  <div className="flex flex-col items-center justify-center flex-1 py-1 px-2">
                    <span className="text-[7.5px] text-slate-500 italic font-serif">
                      « Lu et approuvé, bon pour accord »
                    </span>
                    <div className="relative my-0.5 max-h-[55px] flex items-center justify-center">
                      <img
                        src={contract.clientSignature}
                        alt="Signature numérique locataire"
                        className="max-h-[52px] max-w-[180px] object-contain"
                      />
                    </div>
                    <div className="text-center">
                      <span className="font-mono text-[7.5px] font-bold text-slate-800 block">
                        {contract.clientSignedName || `${contract.clientSnapshot.lastName.toUpperCase()} ${contract.clientSnapshot.firstName}`}
                      </span>
                      {contract.clientSignedAt && (
                        <span className="text-[6.5px] text-emerald-700 font-mono font-medium block">
                          ✓ Signé numériquement le {new Date(contract.clientSignedAt).toLocaleDateString('fr-FR')} à {new Date(contract.clientSignedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                          {contract.signatureCertId ? ` • Ref: ${contract.signatureCertId}` : ''}
                        </span>
                      )}
                    </div>
                  </div>
                ) : contract.hasSecondDriver && contract.secondDriverSnapshot ? (
                  <div className="grid grid-cols-2 gap-2 text-center text-[8.5px] text-slate-500 italic py-1 flex-1 items-center">
                    <div className="border-r border-slate-200 pr-1 flex flex-col justify-center h-full">
                      <span className="font-bold text-slate-800 text-[8px] uppercase not-italic">Locataire Principal</span>
                      <span className="text-[7.5px] text-slate-400 mt-1">« Lu et approuvé »</span>
                    </div>
                    <div className="pl-1 flex flex-col justify-center h-full">
                      <span className="font-bold text-slate-800 text-[8px] uppercase not-italic">2e Conducteur</span>
                      <span className="text-[7.5px] text-slate-400 mt-1">« Lu et approuvé »</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-[9px] text-slate-400 italic flex flex-col items-center justify-center flex-1">
                    <span>Mention manuscrite obligatoire :</span>
                    <span className="font-semibold text-slate-700 mt-0.5">« Lu et approuvé, bon pour accord »</span>
                  </div>
                )}

                <div className="text-[8px] text-slate-500 text-center font-medium">
                  {contract.clientSignature ? (
                    <span className="text-emerald-700 font-semibold">Signature numérique certifiée</span>
                  ) : (
                    'Signature(s) manuscrite(s) & Date'
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* LEGAL FOOTER PAGE 1 */}
        <div className="border-t-2 border-slate-900 pt-2 mt-2 text-center text-[8px] text-slate-700 leading-tight">
          <div className="font-extrabold text-slate-950 uppercase tracking-wider">
            {companySettings.name} • SARL au Capital de 100 000 MAD
          </div>
          <div className="mt-0.5">
            Identifiant Fiscal (IF) : <strong className="text-slate-900">{companySettings.taxId}</strong> • RC : <strong className="text-slate-900">{companySettings.rc}</strong> • ICE : <strong className="text-slate-900">{companySettings.ice}</strong>
          </div>
          {companySettings.address && companySettings.address.trim().length > 0 && !companySettings.address.includes('ANNAKHIL') && (
            <div className="text-slate-600 mt-0.5">
              Siège social : {companySettings.address}
            </div>
          )}
          <div className="text-slate-600 mt-0.5">
            Tél : <strong className="text-slate-900">{activePhone}</strong> • <strong>Assistance &amp; Dépannage :</strong> <span className="font-bold text-slate-900 font-mono">{companySettings.assistancePhone || '0522582962 / 0522589535'}</span> • Web : {companySettings.website} • Email : {companySettings.email}
          </div>
          {showPageIndicator && (
            <div className="flex justify-between items-center mt-1 pt-1 border-t border-slate-200 text-[8px] font-mono text-slate-600">
              <span>Contrat N° <strong>{contract.contractNumber}</strong></span>
              <span className="font-bold text-slate-950 bg-slate-100 px-2.5 py-0.5 rounded border border-slate-300">Page 1 / 2 (Recto)</span>
              <span>Conditions Générales au verso (Page 2)</span>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* PAGE 2: CONDITIONS GÉNÉRALES DE LOCATION (VERSO)                          */}
      {/* ========================================================================= */}
      <div id={page2Id} className="a4-page contract-a4-page flex flex-col justify-between text-slate-900 border border-slate-300 print:border-none">
        <div className="flex flex-col">
          {/* HEADER PRINCIPAL PAGE 2 : MODERNE ET HARMONISÉ */}
          <div className="pb-1 mb-1.5">
            <div className="flex items-center justify-between gap-4">
              {/* 1. LOGO OFFICIEL EN PJ */}
              <div className="shrink-0 flex items-center">
                <CompanyLogo size="xs" customHeight={46} variant="raw-image" className="h-[46px] w-auto max-w-[150px]" />
              </div>

              {/* 2. TITRE MODERNE CONDITIONS GÉNÉRALES */}
              <div className="text-right flex flex-col items-end justify-center">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[10px] font-sans font-black tracking-[0.2em] text-slate-950 uppercase">
                    CONDITIONS GÉNÉRALES DE LOCATION
                  </span>
                  <span className="text-slate-300 font-light">|</span>
                  <span className="text-[9.5px] font-arabic font-bold text-amber-700">
                    شروط الكراء العامة
                  </span>
                </div>
                <div className="text-[7.5px] font-mono text-slate-500 flex items-center gap-2">
                  <span>Réf. Juridique V{termsVersion.version}</span>
                  <span className="text-slate-300">•</span>
                  <span className="text-slate-700 font-medium">Verso contractuel officiel indissociable</span>
                </div>
              </div>
            </div>

            {/* Ligne Coordonnées & Identifiants */}
            <div className="border-t border-slate-200 pt-1 mt-1 flex items-center justify-between text-[7.5px] font-mono text-slate-600">
              <div className="flex items-center gap-2.5">
                <span className="flex items-center gap-1 text-slate-800">
                  <Phone className="w-2.5 h-2.5 text-amber-700 inline shrink-0" />
                  <span>
                    Tél : <strong className="font-bold text-slate-950">{activePhone}</strong>
                  </span>
                </span>
                <span className="text-slate-300">•</span>
                <span className="text-amber-950 font-bold bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200/80 flex items-center gap-1">
                  <span>Assistance 24/7 :</span>
                  <strong className="font-extrabold text-slate-950">{companySettings.assistancePhone || '0522582962 / 0522589535'}</strong>
                </span>
              </div>
              <div className="flex items-center gap-2 text-slate-700 bg-slate-50 px-2 py-0.2 rounded border border-slate-200/80">
                <span>IF : <strong className="text-slate-900 font-bold">{companySettings.taxId}</strong></span>
                <span className="text-slate-300">|</span>
                <span>RC : <strong className="text-slate-900 font-bold">{companySettings.rc}</strong></span>
                <span className="text-slate-300">|</span>
                <span>ICE : <strong className="text-slate-900 font-bold">{companySettings.ice}</strong></span>
                <span className="text-slate-300">|</span>
                <span>Patente : <strong className="text-slate-900 font-bold">{companySettings.patente || '35894120'}</strong></span>
              </div>
            </div>

            {/* Trait de séparation moderne haut de gamme */}
            <div className="h-[1.5px] bg-gradient-to-r from-slate-900 via-amber-700 to-slate-900 mt-1.5" />
          </div>
            {/* BANDEAU DE LIAISON JURIDIQUE AVEC LE RECTO (PAGE 1) AUX COULEURS DE PRESTIGE */}
            <div className="mt-1.5 bg-gradient-to-r from-slate-950 via-blue-950 to-slate-950 text-white border border-slate-800 rounded px-2.5 py-1 flex items-center justify-between text-[7.5px] font-mono shadow-2xs">
              <div className="flex items-center gap-1">
                <span className="text-amber-400 font-semibold uppercase">Contrat N° :</span>
                <strong className="text-white font-bold bg-white/10 px-1.5 py-0.2 rounded border border-white/20">{contract.contractNumber}</strong>
              </div>
              <div className="border-l border-slate-700 pl-2 flex items-center gap-1">
                <span className="text-slate-300">Locataire :</span>
                <strong className="text-amber-300 font-bold">{contract.clientSnapshot.lastName.toUpperCase()} {contract.clientSnapshot.firstName}</strong>
                <span className="text-slate-400">({contract.clientSnapshot.docType}: {contract.clientSnapshot.docNumber})</span>
              </div>
              <div className="border-l border-slate-700 pl-2 flex items-center gap-1">
                <span className="text-slate-300">Véhicule :</span>
                <strong className="text-emerald-300 font-bold">{contract.vehicleSnapshot.brand} {contract.vehicleSnapshot.model}</strong>
                <span className="text-slate-400 font-mono">({formatPlateFrench(contract.vehicleSnapshot.plate)})</span>
              </div>
              <div className="border-l border-slate-700 pl-2 flex items-center gap-1">
                <span className="text-slate-300">Période :</span>
                <strong className="text-white">{formattedStartDate}</strong> au <strong className="text-white">{formattedEndDate}</strong>
              </div>
            </div>

          {/* LES 20 ARTICLES JURIDIQUES EN DEUX COLONNES NATURELLES (LECTURE DE HAUT EN BAS) */}
          <div className="grid grid-cols-2 gap-x-4 text-[7.8px] leading-[1.38] text-slate-800 mt-1.5">
            {/* COLONNE 1 : ARTICLES 1 À 10 */}
            <div className="space-y-1">
              {col1Clauses.map((clause) => (
                <div
                  key={clause.number}
                  className="border-b border-slate-200/90 pb-0.5"
                >
                  <div className="font-bold text-slate-950 flex items-center gap-1 mb-0.2">
                    <span className="inline-flex items-center justify-center bg-blue-950 text-amber-300 border border-blue-900 rounded text-[6.5px] font-mono font-bold px-1.5 py-0.2 shrink-0">
                      Art. {clause.number}
                    </span>
                    <span className="uppercase text-[7.5px] font-black text-slate-900 tracking-tight">
                      {clause.title}
                    </span>
                  </div>
                  <p className="text-slate-700 text-justify leading-tight text-[7.5px]">
                    {clause.content}
                  </p>
                </div>
              ))}
            </div>

            {/* COLONNE 2 : ARTICLES 11 À 20 */}
            <div className="space-y-1">
              {col2Clauses.map((clause) => (
                <div
                  key={clause.number}
                  className="border-b border-slate-200/90 pb-0.5"
                >
                  <div className="font-bold text-slate-950 flex items-center gap-1 mb-0.2">
                    <span className="inline-flex items-center justify-center bg-blue-950 text-amber-300 border border-blue-900 rounded text-[6.5px] font-mono font-bold px-1.5 py-0.2 shrink-0">
                      Art. {clause.number}
                    </span>
                    <span className="uppercase text-[7.5px] font-black text-slate-900 tracking-tight">
                      {clause.title}
                    </span>
                  </div>
                  <p className="text-slate-700 text-justify leading-tight text-[7.5px]">
                    {clause.content}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* SECTION INFÉRIEURE DENSE : BARÈMES, ASSISTANCE, ATTESTATION & SIGNATURES SANS VIDE */}
        <div className="border-t-2 border-slate-900 pt-1.5 mt-1 space-y-1">
          {/* BARÈME FORFAITAIRE DES FRANCHISES ET FRAIS PARTICULIERS (6 BLOCS COMPLETS AUX COULEURS DÉDIÉES) */}
          <div className="grid grid-cols-6 gap-1 text-[6.5px] font-mono">
            <div className="bg-slate-100/90 border border-slate-300 rounded p-1 shadow-2xs">
              <span className="text-slate-500 block uppercase font-bold text-[5.5px]">Franchise Sinistre :</span>
              <strong className="text-slate-950 font-black">Selon CGV</strong>
            </div>
            <div className="bg-amber-50/90 border border-amber-300/90 rounded p-1 shadow-2xs">
              <span className="text-amber-800 block uppercase font-bold text-[5.5px]">Retard Restitution :</span>
              <strong className="text-amber-950 font-black">Tarif/j + 50%</strong>
            </div>
            <div className="bg-blue-50/90 border border-blue-300/90 rounded p-1 shadow-2xs">
              <span className="text-blue-800 block uppercase font-bold text-[5.5px]">Frais Dossier PV :</span>
              <strong className="text-blue-950 font-black">150 DH / infr.</strong>
            </div>
            <div className="bg-emerald-50/90 border border-emerald-300/90 rounded p-1 shadow-2xs">
              <span className="text-emerald-800 block uppercase font-bold text-[5.5px]">Carburant Écart :</span>
              <strong className="text-emerald-950 font-black">Pompe + 100 DH</strong>
            </div>
            <div className="bg-purple-50/90 border border-purple-300/90 rounded p-1 shadow-2xs">
              <span className="text-purple-800 block uppercase font-bold text-[5.5px]">Nettoyage Spécial :</span>
              <strong className="text-purple-950 font-black">250 à 500 DH</strong>
            </div>
            <div className="bg-rose-50/90 border border-rose-300/90 rounded p-1 shadow-2xs">
              <span className="text-rose-800 block uppercase font-bold text-[5.5px]">Perte Clés/Doc :</span>
              <strong className="text-rose-950 font-black">Facture constr.</strong>
            </div>
          </div>

          {/* DISPOSITIONS COMPLÉMENTAIRES & SÉCURITÉ ROUTIÈRE AU MAROC */}
          <div className="grid grid-cols-3 gap-1 text-[6.5px] leading-tight">
            <div className="bg-blue-50/60 border border-blue-200/80 rounded p-1">
              <span className="font-black text-blue-950 block uppercase text-[6px]">1. Sécurité &amp; Code Routier</span>
              <p className="text-slate-700 mt-0.2">Ceinture obligatoire, zéro alcool, respect des radars (Loi 52-05).</p>
            </div>
            <div className="bg-amber-50/60 border border-amber-200/80 rounded p-1">
              <span className="font-black text-amber-950 block uppercase text-[6px]">2. Pistes &amp; Territoire</span>
              <p className="text-slate-700 mt-0.2">Voies goudronnées uniquement. Pistes non carrossables et plages interdites.</p>
            </div>
            <div className="bg-emerald-50/60 border border-emerald-200/80 rounded p-1">
              <span className="font-black text-emerald-950 block uppercase text-[6px]">3. Sinistre &amp; Déclaration</span>
              <p className="text-slate-700 mt-0.2">Constat ou PV de police obligatoire sous 24h ouvrées. Avis immédiat agence.</p>
            </div>
          </div>

          {/* ASSISTANCE 24/7 & SIGNALEMENT SINISTRE */}
          <div className="bg-gradient-to-r from-amber-500/15 via-amber-400/10 to-amber-500/15 border border-amber-400/50 rounded px-2 py-0.5 flex items-center justify-between text-[7px] text-amber-950 shadow-2xs">
            <div className="flex items-center gap-1.5">
              <Phone className="w-3 h-3 text-amber-700 shrink-0" />
              <span><strong>Assistance &amp; Dépannage 24/7 :</strong> Tél : <strong className="font-mono text-amber-950 font-black">{companySettings.assistancePhone || '0522582962 / 0522589535'}</strong> (24h/24 &amp; 7j/7)</span>
            </div>
            <span className="font-mono font-bold text-amber-950 text-[6.5px] bg-white/90 px-1.5 py-0.2 rounded border border-amber-300 shadow-2xs">
              Assistance routière active
            </span>
          </div>

          {/* ATTESTATION FORMELLE D'ENGAGEMENT */}
          <div className="bg-gradient-to-r from-emerald-50/80 via-white to-emerald-50/50 border border-emerald-300/80 px-2 py-0.5 rounded text-[6.5px] text-slate-800 leading-tight shadow-2xs">
            <div className="flex items-start gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <strong className="text-emerald-950 uppercase tracking-tight">Attestation formelle d'adhésion sans réserve :</strong>
                <p className="text-slate-700 mt-0.2">
                  Le locataire et conducteurs agréés attestent avoir pris connaissance des {termsVersion.clauses.length} articles des CGV de la Sté MORVELLO CARS (contrat n° <strong className="text-slate-950 font-mono">{contract.contractNumber}</strong>), en approuver toutes les clauses sans réserve et confirmer l'exactitude des déclarations du recto.
                </p>
              </div>
            </div>
          </div>

          {/* DEUX CADRES DE SIGNATURE DU VERSO */}
          <div className="grid grid-cols-2 gap-3">
            {/* 1. PARAPHE / SIGNATURE DU LOCATAIRE */}
            <div className="border-2 border-blue-900/30 rounded p-1.5 bg-blue-50/20 flex flex-col justify-between min-h-[72px] shadow-2xs">
              <div className="flex justify-between items-center border-b border-blue-200/80 pb-0.5">
                <span className="text-[7.5px] font-black uppercase text-blue-950">
                  Paraphe &amp; Signature du Locataire
                </span>
                <span className="text-[7px] font-bold text-blue-900 font-arabic">
                  توقيع ومصادقة المكتري
                </span>
              </div>
              {contract.clientSignature ? (
                <div className="flex flex-col items-center justify-center flex-1 py-0.5">
                  <div className="max-h-[36px] flex items-center justify-center">
                    <img
                      src={contract.clientSignature}
                      alt="Paraphe électronique"
                      className="max-h-[34px] max-w-[140px] object-contain"
                    />
                  </div>
                  <span className="text-[6px] text-emerald-700 font-mono font-medium mt-0.5">
                    ✓ Paraphe numérique certifié
                  </span>
                </div>
              ) : (
                <div className="text-center py-0.5 flex-1 flex flex-col justify-center items-center">
                  <span className="text-[6.5px] text-slate-400 italic">
                    Mention manuscrite obligatoire :
                  </span>
                  <span className="text-[7px] font-semibold text-slate-700">
                    « Lu et approuvé, bon pour accord »
                  </span>
                  <span className="text-[6.5px] font-mono text-slate-500 mt-0.2">
                    {contract.clientSnapshot.lastName.toUpperCase()} {contract.clientSnapshot.firstName}
                  </span>
                </div>
              )}
              <div className="text-[6px] text-slate-400 text-center border-t border-dashed border-slate-200 pt-0.5">
                {contract.clientSignature ? 'Paraphe certifié et vérifié' : 'Paraphe ou signature manuscrite'}
              </div>
            </div>

            {/* 2. VISA & CACHET OFFICIEL DE L'AGENCE */}
            <div className="border-2 border-amber-500/40 rounded p-1.5 bg-amber-50/20 flex flex-col justify-between min-h-[72px] relative overflow-hidden shadow-2xs">
              <div className="flex justify-between items-center border-b border-amber-200/80 pb-0.5 z-10 relative">
                <span className="text-[7.5px] font-black uppercase text-amber-950">
                  Pour Sté MORVELLO CARS
                </span>
                <span className="text-[7px] font-bold text-amber-900 font-arabic">
                  خاتم وتأشيرة الوكالة
                </span>
              </div>
              <div className="relative flex items-center justify-center py-0.5 z-0 flex-1">
                <CompanyStamp size="xs" rotation={-1.5} />
              </div>
              <div className="text-[6px] text-slate-500 text-center z-10 font-medium border-t border-slate-200 pt-0.5">
                Visa légal agence • Fait à Casablanca, le {formattedStartDate}
              </div>
            </div>
          </div>

          {/* PIED DE PAGE VERSO AVEC TRAÇABILITÉ */}
          <div className="flex justify-between items-center text-[7px] text-slate-600 font-mono border-t border-slate-200 pt-0.5">
            <span>Réf. Contrat : <strong className="text-slate-900">{contract.contractNumber}</strong></span>
            <span>Document contractuel officiel recto-verso — Opposable aux tiers</span>
            <span className="font-bold text-slate-950 bg-slate-100 px-2 py-0.2 rounded border border-slate-300">
              Page 2 / 2 (Verso)
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
