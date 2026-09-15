import React from 'react';
import { Contract, CompanySettings, TermsVersion } from '../../types';
import { Briefcase, Phone, Mail, MapPin, CheckCircle2, ShieldCheck, Building2, UserCheck, Car, FileSpreadsheet } from 'lucide-react';
import { CompanyStamp } from '../CompanyStamp';
import { CompanyLogo } from '../CompanyLogo';
import { formatPlateFrench } from '../../utils/plateUtils';

export interface CorporateContractPdfLayoutProps {
  contract: Contract;
  companySettings: CompanySettings;
  termsVersion: TermsVersion;
  layout?: 'stacked' | 'side-by-side';
  page1Id: string;
  page2Id: string;
  activePhone: string;
  displayManagerName?: string;
  formattedStartDate: string;
  formattedEndDate: string;
  formattedCreatedAt: string;
}

export const CorporateContractPdfLayout: React.FC<CorporateContractPdfLayoutProps> = ({
  contract,
  companySettings,
  termsVersion,
  layout = 'stacked',
  page1Id,
  page2Id,
  activePhone,
  displayManagerName,
  formattedStartDate,
  formattedEndDate,
  formattedCreatedAt,
}) => {
  const halfClauses = Math.ceil(termsVersion.clauses.length / 2);
  const col1Clauses = termsVersion.clauses.slice(0, halfClauses);
  const col2Clauses = termsVersion.clauses.slice(halfClauses);

  // Calculate HT and TVA 20% for professional accounting
  const totalTTC = contract.totalAmount || 0;
  const totalHT = Math.round((totalTTC / 1.2) * 100) / 100;
  const tvaAmount = Math.round((totalTTC - totalHT) * 100) / 100;

  return (
    <div
      className={`pdf-document-root flex ${
        layout === 'side-by-side' ? 'flex-col xl:flex-row' : 'flex-col'
      } items-center gap-8 print:!flex-col print:!gap-0`}
    >
      {/* ========================================================================= */}
      {/* PAGE 1: CONTRAT PROFESSIONNEL B2B & FLOTTES (RECTO)                       */}
      {/* ========================================================================= */}
      <div
        id={page1Id}
        className="a4-page contract-a4-page flex flex-col justify-between text-slate-900 border border-blue-400 print:border-none relative bg-white overflow-hidden shadow-2xl"
      >
        {/* EXECUTIVE BLUE STRIP */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-900 via-blue-600 to-indigo-900" />

        <div className="flex-1 flex flex-col justify-between pt-1">
          {/* ========================================================================= */}
          {/* HEADER CORPORATE : LOGO B2B, GESTIONNAIRE DE FLOTTE & CARTOUCHE SOCIÉTÉ    */}
          {/* ========================================================================= */}
          <div className="pb-1 mb-2">
            <div className="bg-gradient-to-b from-blue-50/40 via-white to-slate-50/50 border-2 border-blue-300 rounded-xl p-2.5 shadow-xs relative">
              <div className="grid grid-cols-12 items-center gap-3">
                {/* 1. LOGO & PÔLE ENTREPRISE (Gauche - 4 cols) */}
                <div className="col-span-4 shrink-0 flex items-center gap-2.5">
                  <div className="flex items-center shrink-0">
                    <CompanyLogo size="md" customHeight={66} variant="raw-image" className="h-[66px] w-auto max-w-[150px]" />
                  </div>
                  <div className="h-10 w-[1px] bg-blue-200 shrink-0" />
                  <div className="flex flex-col justify-center">
                    <div className="flex items-center gap-1">
                      <Briefcase className="w-3 h-3 text-blue-700" />
                      <span className="text-[7.5px] font-sans font-black uppercase tracking-wider text-blue-950 leading-tight">
                        MORVELLO CORPORATE
                      </span>
                    </div>
                    <span className="text-[6.2px] font-sans font-extrabold text-blue-700 uppercase tracking-widest mt-0.5">
                      Flottes &amp; Longue Durée (B2B)
                    </span>
                  </div>
                </div>

                {/* 2. DÉPARTEMENT FLOTTE & LIGNE PRO (Centre - 4 cols) */}
                <div className="col-span-4 px-2.5 border-x border-blue-200 flex flex-col justify-center gap-1.5">
                  <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 border border-blue-400 rounded-lg px-2.5 py-1 text-center shadow-xs">
                    <div className="flex items-center justify-center gap-1 text-[7px] font-black uppercase tracking-wider text-blue-200">
                      <Building2 className="w-2.5 h-2.5 text-blue-300" />
                      <span>Support Grands Comptes &amp; Flotte 24/7</span>
                    </div>
                    <div className="text-[10px] font-mono font-black text-white tracking-wider mt-0.5">
                      {companySettings.assistancePhone || '0522582962 / 0522589535'}
                    </div>
                  </div>

                  <div className="flex items-center justify-center text-[7.5px] font-mono bg-blue-50/70 border border-blue-200 px-2 py-0.8 rounded-md">
                    <span className="flex items-center gap-1 text-blue-950 font-bold">
                      <Phone className="w-2.5 h-2.5 text-blue-700 shrink-0" />
                      <span>Ligne Pro : <strong className="font-extrabold">{activePhone}</strong></span>
                    </span>
                  </div>
                </div>

                {/* 3. CARTOUCHE B2B / LLD (Droite - 4 cols) */}
                <div className="col-span-4 flex flex-col justify-center">
                  <div className="rounded-lg overflow-hidden border-2 border-blue-900 shadow-xs">
                    <div className="bg-gradient-to-r from-blue-950 via-slate-900 to-blue-950 text-white px-2.5 py-1 flex items-center justify-between border-b border-blue-400">
                      <div className="flex items-center gap-1">
                        <Briefcase className="w-3 h-3 text-blue-300 shrink-0" />
                        <span className="text-[8px] font-black tracking-[0.12em] uppercase text-white">
                          CONTRAT B2B / ENTREPRISE
                        </span>
                      </div>
                      <span className="text-[8.5px] font-bold font-arabic text-blue-300">
                        عقد كراء للشركات
                      </span>
                    </div>

                    <div className="bg-white px-2 py-1 flex items-center justify-center">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[7.5px] font-mono font-bold uppercase text-slate-500">
                          RÉF. PRO
                        </span>
                        <span className="font-mono text-[15px] font-black tracking-widest text-blue-950 bg-blue-50 border border-blue-300 px-2.5 py-0.5 rounded shadow-2xs">
                          {contract.contractNumber}
                        </span>
                      </div>
                    </div>

                    <div className="bg-blue-50/80 border-t border-blue-200 px-2 py-0.5 flex items-center justify-between text-[6.8px] font-mono text-blue-950 font-medium">
                      <span>Date : <strong>{formattedCreatedAt}</strong></span>
                      <span className="bg-blue-200 text-blue-950 font-black text-[6.2px] px-1.5 py-0.2 rounded border border-blue-300 uppercase">
                        EXEMPLAIRE SOCIÉTÉ (RECTO)
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* BANDEAU FISCAL ENTREPRISE */}
              <div className="mt-2 pt-1 border-t border-blue-200 flex items-center justify-between text-[7px] font-mono text-blue-950 bg-blue-50/50 rounded px-2.5 py-0.8">
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-slate-950 uppercase">{companySettings.name}</span>
                  <span className="text-blue-800">• Pôle Solutions de Flottes Entreprises &amp; LLD</span>
                </div>
                <div className="flex items-center gap-2.5 text-slate-800 font-semibold">
                  <span>IF : <strong className="font-bold text-slate-950">{companySettings.taxId}</strong></span>
                  <span className="text-blue-300">|</span>
                  <span>RC : <strong className="font-bold text-slate-950">{companySettings.rc}</strong></span>
                  <span className="text-blue-300">|</span>
                  <span>ICE : <strong className="font-bold text-slate-950">{companySettings.ice}</strong></span>
                  <span className="text-blue-300">|</span>
                  <span>Patente : <strong className="font-bold text-slate-950">{companySettings.patente || '35894120'}</strong></span>
                </div>
              </div>
            </div>

            <div className="mt-1 space-y-0.5">
              <div className="h-[2px] bg-gradient-to-r from-blue-900 via-blue-500 to-blue-900 rounded-full" />
            </div>
          </div>

          {/* ========================================================================= */}
          {/* SECTION 1: ENTREPRISE LOCATAIRE & SALARIÉS MANDATÉS                       */}
          {/* ========================================================================= */}
          <div className="border-2 border-blue-200 rounded-xl bg-gradient-to-b from-blue-50/20 via-white to-slate-50/30 p-2 mb-2 shadow-xs">
            <div className="flex items-center justify-between border-b border-blue-200 pb-1 mb-1.5 bg-gradient-to-r from-blue-950 via-slate-900 to-blue-950 text-white px-2.5 py-1 rounded-lg">
              <h2 className="text-[10px] font-black uppercase tracking-wide flex items-center gap-2 text-white">
                <span className="w-5 h-5 bg-blue-500/20 border border-blue-400/40 rounded flex items-center justify-center shrink-0">
                  <Building2 className="w-3 h-3 text-blue-300" />
                </span>
                <span>1. Entreprise Locataire &amp; Conducteur Salarié Mandaté</span>
              </h2>
              <span className="text-[9px] text-blue-200 font-bold font-arabic">
                الشركة المكترية والسائق المستخدم المرخص له
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[10px]">
              {/* RAISON SOCIALE & IDENTIFIANTS FISCAUX DE LA SOCIÉTÉ */}
              <div className="bg-white p-2 rounded-lg border border-blue-200 border-l-4 border-l-blue-700 shadow-2xs flex flex-col justify-between">
                <div className="flex items-center justify-between border-b border-blue-100 pb-1 mb-1">
                  <span className="text-blue-950 text-[8.5px] uppercase font-black tracking-wider flex items-center gap-1">
                    <Building2 className="w-2.5 h-2.5 text-blue-600" />
                    Société / Personne Morale
                  </span>
                  <span className="text-[7.5px] bg-blue-100 text-blue-950 border border-blue-300 px-1.5 py-0.2 rounded font-bold uppercase">
                    Compte Entreprise
                  </span>
                </div>
                <p className="font-black text-slate-950 uppercase text-xs tracking-wide">
                  {contract.clientSnapshot.lastName} {contract.clientSnapshot.firstName}
                </p>
                <div className="grid grid-cols-2 gap-1 mt-1 text-[9px] text-slate-700">
                  <div>
                    ICE Société : <strong className="font-mono text-slate-950">00329481900045</strong>
                  </div>
                  <div>
                    Réf. Mandat / PO : <strong className="font-mono text-slate-950">PO-{contract.contractNumber.replace('MC-', 'B2B-')}</strong>
                  </div>
                </div>
                <div className="text-[9px] text-slate-700 mt-1 flex items-center justify-between">
                  <span>Centre de coût : <strong className="font-mono text-slate-950">Flotte Commerciale 2026</strong></span>
                  <span className="text-[8px] text-blue-900 font-bold bg-blue-50 px-1 rounded border border-blue-200">✓ Compte Agrée</span>
                </div>
              </div>

              {/* CONDUCTEUR SALARIÉ HABILITÉ & CLAUSE PRÉPOSÉS */}
              <div className="bg-white p-2 rounded-lg border border-blue-200 border-l-4 border-l-indigo-600 shadow-2xs flex flex-col justify-between">
                <div className="flex items-center justify-between border-b border-blue-100 pb-1 mb-1">
                  <span className="text-indigo-950 text-[8.5px] uppercase font-black tracking-wider flex items-center gap-1">
                    <UserCheck className="w-2.5 h-2.5 text-indigo-600" />
                    Collaborateur / Conducteur Habilité
                  </span>
                  <span className="text-[7.5px] bg-indigo-100 text-indigo-950 border border-indigo-300 px-1.5 py-0.2 rounded font-bold uppercase">
                    Salarié Désigné
                  </span>
                </div>
                <p className="font-black text-slate-950 uppercase text-xs tracking-wide">
                  {contract.hasSecondDriver && contract.secondDriverSnapshot
                    ? `${contract.secondDriverSnapshot.lastName} ${contract.secondDriverSnapshot.firstName}`
                    : `${contract.clientSnapshot.lastName} ${contract.clientSnapshot.firstName}`}
                </p>
                <div className="grid grid-cols-2 gap-1 mt-1 text-[9px] text-slate-700">
                  <div>
                    CIN / Passeport : <strong className="font-mono text-slate-950">{contract.clientSnapshot.docNumber}</strong>
                  </div>
                  <div>
                    Permis Pro : <strong className="font-mono text-slate-950">{contract.clientSnapshot.drivingLicense}</strong>
                  </div>
                </div>
                <div className="text-[9px] text-slate-700 mt-1 flex items-center justify-between">
                  <span>Contact Mobile : <strong className="font-mono text-slate-950">{contract.clientSnapshot.phone || 'Non renseigné'}</strong></span>
                  <span className="text-[8px] text-emerald-800 font-bold bg-emerald-50 px-1 rounded border border-emerald-200">✓ Mandat Validé</span>
                </div>
              </div>
            </div>

            {/* ADRESSE DU SIÈGE & MENTIONS DE FACTURATION */}
            <div className="mt-1.5 bg-white px-2.5 py-1 rounded-lg border border-blue-200 grid grid-cols-12 gap-2 text-[8.5px]">
              <div className="col-span-6 text-slate-700 flex items-center gap-1.5 truncate">
                <MapPin className="w-3 h-3 text-blue-600 shrink-0" />
                <span className="truncate">
                  Siège Social / Facturation : <strong className="text-slate-950">{contract.clientSnapshot.address || 'Quartier d’Affaires, Sidi Maârouf, Casablanca'}</strong>
                </span>
              </div>
              <div className="col-span-4 text-slate-700 truncate flex items-center gap-1">
                <Mail className="w-3 h-3 text-blue-600 shrink-0" />
                <span className="truncate">Facturation Électronique : <strong className="text-slate-950">{contract.clientSnapshot.email || 'comptabilite@entreprise.ma'}</strong></span>
              </div>
              <div className="col-span-2 text-right text-blue-900 font-extrabold text-[8px] flex items-center justify-end gap-1">
                <Briefcase className="w-3 h-3 text-blue-600" />
                <span>Clause Salariés Active</span>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* SECTION 2: VÉHICULE DE FLOTTE & ENGAGEMENTS DE MOBILITÉ                   */}
          {/* ========================================================================= */}
          <div className="border-2 border-blue-200 rounded-xl bg-white p-2 mb-2 shadow-xs">
            <div className="flex items-center justify-between border-b border-blue-200 pb-1 mb-1.5 bg-gradient-to-r from-blue-950 via-slate-900 to-blue-950 text-white px-2.5 py-1 rounded-lg">
              <h2 className="text-[10px] font-black uppercase tracking-wide flex items-center gap-2 text-white">
                <span className="w-5 h-5 bg-blue-500/20 border border-blue-400/40 rounded flex items-center justify-center shrink-0">
                  <Car className="w-3 h-3 text-blue-300" />
                </span>
                <span>2. Véhicule de Flotte &amp; Conditions Commerciales Pro</span>
              </h2>
              <span className="text-[9px] text-blue-200 font-bold font-arabic">
                سيارة المصلحة والشروط التجارية
              </span>
            </div>

            <div className="grid grid-cols-12 gap-2 text-[9.5px]">
              {/* VÉHICULE */}
              <div className="col-span-6 bg-blue-50/40 p-2 rounded-lg border border-blue-200 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-xs text-slate-950 uppercase tracking-wide">
                    {contract.vehicleSnapshot.brand} {contract.vehicleSnapshot.model}
                  </span>
                  <span className="text-[8px] font-mono font-bold bg-blue-900 text-white px-2 py-0.5 rounded">
                    FLOTTE ENTREPRISE
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1 mt-1 font-mono text-[9px]">
                  <div>
                    Immat : <strong className="text-slate-950">{formatPlateFrench(contract.vehicleSnapshot.plate)}</strong>
                  </div>
                  <div>
                    Énergie : <strong className="text-slate-950 capitalize">{contract.vehicleSnapshot.fuelType || 'Diesel'}</strong>
                  </div>
                  <div>
                    Boîte : <strong className="text-slate-950 capitalize">{contract.vehicleSnapshot.transmission || 'Manuelle'}</strong>
                  </div>
                </div>
                <div className="mt-1 pt-1 border-t border-blue-200 flex items-center justify-between text-[8.5px]">
                  <span className="text-slate-700">Km compteur initial : <strong className="font-mono text-slate-950 font-bold">{contract.departureKm.toLocaleString()} km</strong></span>
                  <span className="text-blue-900 font-bold bg-blue-100 px-1.5 py-0.2 rounded border border-blue-300">
                    Forfait 3 000 km/mois
                  </span>
                </div>
              </div>

              {/* DÉLAIS & MOBILITÉ */}
              <div className="col-span-6 bg-slate-50 p-2 rounded-lg border border-slate-200 flex flex-col justify-between">
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-white p-1.5 rounded border border-slate-200">
                    <span className="text-[7.5px] uppercase font-bold text-slate-500 block">Mise à Disposition :</span>
                    <span className="font-mono font-bold text-slate-950 text-[10px]">
                      {formattedStartDate} à {contract.startTime}
                    </span>
                  </div>
                  <div className="bg-white p-1.5 rounded border border-slate-200">
                    <span className="text-[7.5px] uppercase font-bold text-slate-500 block">Restitution Prévue :</span>
                    <span className="font-mono font-bold text-slate-950 text-[10px]">
                      {formattedEndDate} à {contract.endTime}
                    </span>
                  </div>
                </div>
                <div className="mt-1 pt-1 border-t border-slate-200 flex items-center justify-between text-[8.5px]">
                  <span className="text-slate-700">Durée contractuelle : <strong className="text-slate-950 font-bold">{contract.totalDays} jours</strong></span>
                  <span className="text-emerald-800 font-bold bg-emerald-50 px-2 py-0.2 rounded border border-emerald-300">
                    Véhicule Relais sous 2h garanti
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* SECTION 3: VENTILATION COMPTABLE B2B & DÉDUCTIBILITÉ TVA 20%              */}
          {/* ========================================================================= */}
          <div className="border-2 border-blue-400 rounded-xl bg-gradient-to-r from-blue-50/60 via-white to-blue-50/60 p-2 mb-2 shadow-xs">
            <div className="grid grid-cols-12 items-center gap-3 text-center">
              <div className="col-span-3 border-r border-blue-200 pr-2">
                <span className="text-[8px] uppercase font-bold text-slate-500 block">Montant Net Hors Taxes (HT)</span>
                <span className="font-mono text-xs font-black text-slate-950">
                  {totalHT.toLocaleString()} MAD HT
                </span>
              </div>
              <div className="col-span-3 border-r border-blue-200 pr-2">
                <span className="text-[8px] uppercase font-bold text-slate-500 block">TVA Déductible (20%)</span>
                <span className="font-mono text-xs font-black text-blue-900">
                  {tvaAmount.toLocaleString()} MAD TVA
                </span>
              </div>
              <div className="col-span-3 border-r border-blue-200 pr-2">
                <span className="text-[8px] uppercase font-bold text-slate-500 block">Total Toutes Taxes Comprises</span>
                <span className="font-mono text-sm font-black text-blue-950">
                  {totalTTC.toLocaleString()} MAD TTC
                </span>
              </div>
              <div className="col-span-3 pl-2 text-right">
                <span className="text-[8px] uppercase font-bold text-slate-500 block">Dépôt de Garantie Flotte</span>
                <span className="font-mono text-xs font-black text-slate-950 bg-blue-100 border border-blue-300 px-2 py-0.5 rounded inline-block">
                  {contract.depositAmount ? `${contract.depositAmount.toLocaleString()} MAD (Caution)` : 'Convention cadre'}
                </span>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* SECTION 4: PROTOCOLE TECHNIQUE DE FLOTTE                                  */}
          {/* ========================================================================= */}
          <div className="border border-blue-200 rounded-xl bg-white p-2 mb-2 shadow-2xs">
            <div className="flex items-center justify-between border-b border-blue-200 pb-1 mb-1">
              <span className="text-[9px] font-black uppercase text-blue-950 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-700" />
                4. Charte Flotte Pro &amp; Barème Kilométrique
              </span>
              <span className="text-[8px] bg-blue-100 text-blue-950 font-bold px-2 py-0.2 rounded border border-blue-300">
                Assistance Pro &amp; Remorquage National
              </span>
            </div>

            <div className="grid grid-cols-4 gap-2 text-[8px] text-slate-800 text-center">
              <div className="bg-slate-50 p-1 rounded border border-slate-200">
                <span className="block font-bold text-slate-950">Entretien &amp; Vidange</span>
                <span className="text-emerald-700 font-semibold">100% à charge Morvello</span>
              </div>
              <div className="bg-slate-50 p-1 rounded border border-slate-200">
                <span className="block font-bold text-slate-950">Km Excédentaire</span>
                <span className="text-slate-700 font-semibold">1.50 MAD HT / km</span>
              </div>
              <div className="bg-slate-50 p-1 rounded border border-slate-200">
                <span className="block font-bold text-slate-950">Équipements de Sécurité</span>
                <span className="text-emerald-700 font-semibold">Gilet, Triangle, Trousse</span>
              </div>
              <div className="bg-slate-50 p-1 rounded border border-slate-200">
                <span className="block font-bold text-slate-950">Carburant Départ</span>
                <span className="font-mono font-bold text-blue-900">{contract.departureFuel || 'Plein 100%'}</span>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* SECTION 5: SIGNATURES CORPORATE B2B                                       */}
          {/* ========================================================================= */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            {/* SIGNATURE ENTREPRISE */}
            <div className="border-2 border-blue-400 rounded-xl p-2 bg-white flex flex-col justify-between min-h-[90px] shadow-xs">
              <div className="flex justify-between items-center border-b border-blue-200 pb-1">
                <span className="text-[8.5px] font-black uppercase text-blue-950 flex items-center gap-1">
                  <Building2 className="w-3 h-3 text-blue-700" />
                  Pour l'Entreprise Locataire (Mandataire &amp; Cachet)
                </span>
                <span className="text-[7.5px] font-bold text-blue-900 font-arabic">
                  توقيع وخاتم الشركة المكترية
                </span>
              </div>
              {contract.clientSignature ? (
                <div className="flex flex-col items-center justify-center flex-1 py-1">
                  <span className="text-[6.5px] text-slate-400 italic font-serif">
                    « Bon pour accord, mandat professionnel agréé »
                  </span>
                  <div className="my-0.5 max-h-[44px] flex items-center justify-center">
                    <img
                      src={contract.clientSignature}
                      alt="Signature Entreprise"
                      className="max-h-[42px] max-w-[170px] object-contain"
                    />
                  </div>
                  <span className="text-[6.5px] text-blue-700 font-mono font-bold">
                    ✓ Signé numériquement le {new Date(contract.clientSignedAt || '').toLocaleDateString('fr-FR')}
                  </span>
                </div>
              ) : (
                <div className="text-center py-1 flex-1 flex flex-col justify-center items-center">
                  <span className="text-[7px] text-slate-400 italic">Mention obligatoire :</span>
                  <span className="text-[7.5px] font-bold text-slate-800">« Bon pour accord, mandat professionnel agréé »</span>
                  <span className="text-[7px] font-mono text-slate-600 mt-0.5 font-bold">
                    {contract.clientSnapshot.lastName.toUpperCase()} {contract.clientSnapshot.firstName}
                  </span>
                </div>
              )}
              <div className="text-[6.5px] text-slate-400 text-center border-t border-dashed border-slate-200 pt-0.5">
                {contract.clientSignature ? 'Signature électronique d\'entreprise certifiée' : 'Signature du représentant légal & Cachet commercial'}
              </div>
            </div>

            {/* CACHET DIRECTION FLOTTES MORVELLO */}
            <div className="border-2 border-slate-900 rounded-xl p-2 bg-gradient-to-b from-white to-blue-50/20 flex flex-col justify-between min-h-[90px] relative overflow-hidden shadow-xs">
              <div className="flex justify-between items-center border-b border-slate-200 pb-1 z-10 relative">
                <span className="text-[8.5px] font-black uppercase text-slate-950 flex items-center gap-1">
                  <Briefcase className="w-3 h-3 text-blue-700" />
                  Pour Sté MORVELLO CARS • Division Flottes
                </span>
                <span className="text-[7.5px] font-bold text-slate-700 font-arabic">
                  تأشيرة إدارة الأساطيل
                </span>
              </div>
              <div className="relative flex items-center justify-center py-1 z-0 flex-1">
                <CompanyStamp size="xs" rotation={-1.5} />
                {contract.agencySignature && (
                  <img
                    src={contract.agencySignature}
                    alt="Signature Direction Flottes"
                    className="absolute max-h-[44px] max-w-[130px] object-contain z-10"
                  />
                )}
              </div>
              <div className="text-[6.5px] text-slate-600 text-center z-10 font-bold border-t border-slate-200 pt-0.5">
                Comptes Entreprises • Fait à Casablanca, le {formattedStartDate}
              </div>
            </div>
          </div>

          {/* FOOTER RECTO */}
          <div className="flex justify-between items-center text-[7px] text-blue-900 font-mono border-t border-blue-300 pt-1 mt-1">
            <span>Contrat B2B Entreprise Réf : <strong className="text-slate-950">{contract.contractNumber}</strong></span>
            <span>Document contractuel commercial — Déductibilité fiscale garantie</span>
            <span className="font-bold text-slate-950 bg-blue-100 px-2 py-0.2 rounded border border-blue-300">
              Page 1 / 2 (Recto B2B)
            </span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* PAGE 2: CONDITIONS GÉNÉRALES PROFESSIONNELLES B2B (VERSO)                  */}
      {/* ========================================================================= */}
      <div
        id={page2Id}
        className="a4-page contract-a4-page flex flex-col justify-between text-slate-900 border border-blue-400 print:border-none relative bg-white overflow-hidden shadow-2xl"
      >
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-900 via-blue-600 to-indigo-900" />

        <div className="flex-1 flex flex-col justify-between pt-1">
          {/* HEADER VERSO */}
          <div className="border-b-2 border-blue-400 pb-1.5 mb-1.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-blue-700" />
              <div>
                <h3 className="text-[10px] font-black tracking-wider uppercase text-slate-950">
                  CONDITIONS GÉNÉRALES PROFESSIONNELLES B2B &amp; GESTION DE FLOTTE
                </h3>
                <p className="text-[7.5px] text-blue-800 font-semibold">
                  Responsabilité Morale, Facturation Périodique &amp; Barème d'Usure Flotte
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[9px] font-bold font-arabic text-blue-900">
                الشروط العامة للشركات وعقود العمل B2B
              </span>
              <div className="text-[7px] font-mono text-slate-500">
                Réf : Contrat {contract.contractNumber}
              </div>
            </div>
          </div>

          {/* 20 ARTICLES EN 2 COLONNES */}
          <div className="grid grid-cols-2 gap-3 text-[7.2px] leading-tight text-slate-700 flex-1 overflow-hidden">
            {/* COLONNE 1 */}
            <div className="space-y-1.5 pr-1 border-r border-blue-200">
              {col1Clauses.map((clause) => (
                <div key={clause.number} className="bg-blue-50/20 p-1 rounded border border-blue-100">
                  <strong className="text-slate-950 font-bold block mb-0.5">
                    {clause.number}. {clause.title}
                  </strong>
                  <p className="text-justify">{clause.content}</p>
                </div>
              ))}
            </div>

            {/* COLONNE 2 */}
            <div className="space-y-1.5 pl-1">
              {col2Clauses.map((clause) => (
                <div key={clause.number} className="bg-blue-50/20 p-1 rounded border border-blue-100">
                  <strong className="text-slate-950 font-bold block mb-0.5">
                    {clause.number}. {clause.title}
                  </strong>
                  <p className="text-justify">{clause.content}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ATTESTATION VERSO */}
          <div className="bg-blue-50 border border-blue-300 rounded p-1.5 text-[7px] text-blue-950 my-1 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Briefcase className="w-3 h-3 text-blue-700 shrink-0" />
              <span>
                La société locataire atteste de la conformité de l'usage professionnel et de l'habilitation de ses préposés selon les conditions B2B Morvello Cars.
              </span>
            </div>
            <span className="font-mono font-bold text-slate-950">{contract.contractNumber}</span>
          </div>

          {/* SIGNATURES VERSO */}
          <div className="grid grid-cols-2 gap-3">
            <div className="border border-blue-300 rounded p-1 bg-white text-center min-h-[60px] flex flex-col justify-between">
              <span className="text-[7.5px] font-bold text-blue-950 uppercase">Visa de l'Entreprise Locataire</span>
              {contract.clientSignature ? (
                <div className="flex flex-col items-center justify-center flex-1 py-0.5">
                  <img
                    src={contract.clientSignature}
                    alt="Paraphe Entreprise"
                    className="max-h-[30px] max-w-[120px] object-contain"
                  />
                  <span className="text-[5.5px] text-blue-700 font-mono">✓ Paraphe certifié B2B</span>
                </div>
              ) : (
                <>
                  <span className="text-[6.5px] text-slate-500 font-mono">« Lu et approuvé, bon pour accord B2B »</span>
                  <span className="text-[6px] text-slate-400">Cachet &amp; Signature</span>
                </>
              )}
            </div>
            <div className="border border-blue-300 rounded p-1 bg-white text-center min-h-[60px] flex flex-col justify-between relative overflow-hidden">
              <span className="text-[7.5px] font-bold text-blue-950 uppercase z-10">Pour Sté MORVELLO CARS Flottes</span>
              <div className="relative flex items-center justify-center py-0.5 z-0 flex-1">
                <CompanyStamp size="xs" rotation={-1.5} />
              </div>
              <span className="text-[6px] text-slate-500 z-10">Casablanca, le {formattedStartDate}</span>
            </div>
          </div>

          {/* FOOTER VERSO */}
          <div className="flex justify-between items-center text-[7px] text-blue-900 font-mono border-t border-blue-300 pt-1 mt-1">
            <span>Réf. Contrat B2B : <strong className="text-slate-950">{contract.contractNumber}</strong></span>
            <span>Conditions Générales Professionnelles B2B Morvello Cars</span>
            <span className="font-bold text-slate-950 bg-blue-100 px-2 py-0.2 rounded border border-blue-300">
              Page 2 / 2 (Verso B2B)
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
