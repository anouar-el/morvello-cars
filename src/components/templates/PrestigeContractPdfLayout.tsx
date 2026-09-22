import React from 'react';
import { Contract, CompanySettings, TermsVersion } from '../../types';
import { Crown, Phone, Mail, MapPin, CheckCircle2, Star, Shield, ShieldCheck, Sparkles, User, Car } from 'lucide-react';
import { CompanyStamp } from '../CompanyStamp';
import { CompanyLogo } from '../CompanyLogo';
import { formatPlateFrench } from '../../utils/plateUtils';

export interface PrestigeContractPdfLayoutProps {
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

export const PrestigeContractPdfLayout: React.FC<PrestigeContractPdfLayoutProps> = ({
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

  return (
    <div
      className={`pdf-document-root flex ${
        layout === 'side-by-side' ? 'flex-col xl:flex-row' : 'flex-col'
      } items-center gap-8 print:!flex-col print:!gap-0`}
    >
      {/* ========================================================================= */}
      {/* PAGE 1: CONTRAT PRESTIGE VIP & CONCIERGERIE (RECTO)                       */}
      {/* ========================================================================= */}
      <div
        id={page1Id}
        className="a4-page contract-a4-page flex flex-col justify-between text-slate-900 border border-amber-300 print:border-none relative bg-white overflow-hidden shadow-2xl"
      >
        {/* GOLD ACCENT BARS */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-600 via-yellow-400 to-amber-600" />

        <div className="flex-1 flex flex-col justify-between pt-1">
          {/* ========================================================================= */}
          {/* HEADER PRESTIGE : LOGO VIP, CONCIERGERIE 24/7 & CARTOUCHE IMPÉRIAL         */}
          {/* ========================================================================= */}
          <div className="pb-1 mb-2">
            <div className="bg-gradient-to-b from-amber-50/40 via-white to-amber-50/20 border-2 border-amber-400/90 rounded-xl p-2.5 shadow-xs relative">
              <div className="grid grid-cols-12 items-center gap-3">
                {/* 1. LOGO PRESTIGE & MARQUE (Gauche - 4 cols) */}
                <div className="col-span-4 shrink-0 flex items-center gap-2.5">
                  <div className="flex items-center shrink-0">
                    <CompanyLogo size="md" customHeight={66} variant="raw-image" className="h-[66px] w-auto max-w-[150px]" />
                  </div>
                  <div className="h-10 w-[1px] bg-amber-300 shrink-0" />
                  <div className="flex flex-col justify-center">
                    <div className="flex items-center gap-1">
                      <Crown className="w-3 h-3 text-amber-600 fill-amber-500" />
                      <span className="text-[7.5px] font-sans font-black uppercase tracking-wider text-amber-950 leading-tight">
                        PRESTIGE &amp; VIP
                      </span>
                    </div>
                    <span className="text-[6.2px] font-sans font-extrabold text-amber-700 uppercase tracking-widest mt-0.5">
                      Service Conciergerie Privée
                    </span>
                  </div>
                </div>

                {/* 2. ASSISTANCE & DÉPANNAGE (Centre - 4 cols) */}
                <div className="col-span-4 px-2.5 border-x border-amber-300/80 flex flex-col justify-center gap-1.5">
                  <div className="bg-gradient-to-r from-zinc-950 via-slate-900 to-zinc-950 border border-amber-400/80 rounded-lg px-2.5 py-1 text-center shadow-xs">
                    <div className="flex items-center justify-center gap-1 text-[7px] font-black uppercase tracking-wider text-amber-300">
                      <Shield className="w-2.5 h-2.5 text-amber-400" />
                      <span>Assistance et Dépannage</span>
                    </div>
                    <div className="text-[10px] font-mono font-black text-white tracking-wider mt-0.5">
                      {companySettings.assistancePhone || '0522582962 / 0522589535'}
                    </div>
                  </div>

                  <div className="flex items-center justify-center text-[7.5px] font-mono bg-amber-50/70 border border-amber-300/80 px-2 py-0.8 rounded-md">
                    <span className="flex items-center gap-1 text-amber-950 font-bold">
                      <Phone className="w-2.5 h-2.5 text-amber-700 shrink-0" />
                      <span>Ligne Directe : <strong className="font-extrabold">{activePhone}</strong></span>
                    </span>
                  </div>
                </div>

                {/* 3. CARTOUCHE DU CONTRAT PRESTIGE VIP (Droite - 4 cols) */}
                <div className="col-span-4 flex flex-col justify-center">
                  <div className="rounded-lg overflow-hidden border-2 border-amber-500 shadow-xs">
                    <div className="bg-gradient-to-r from-zinc-950 via-amber-950 to-zinc-950 text-white px-2.5 py-1 flex items-center justify-between border-b border-amber-400">
                      <div className="flex items-center gap-1">
                        <Crown className="w-3 h-3 text-amber-400 fill-amber-400 shrink-0" />
                        <span className="text-[8px] font-black tracking-[0.12em] uppercase text-amber-300">
                          CONTRAT PRIVILÈGE VIP
                        </span>
                      </div>
                      <span className="text-[8.5px] font-bold font-arabic text-amber-300">
                        عقد كراء سيارات فاخرة
                      </span>
                    </div>

                    <div className="bg-white px-2 py-1 flex items-center justify-center">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[7.5px] font-mono font-bold uppercase text-amber-800">
                          N°
                        </span>
                        <span className="font-mono text-[15px] font-black tracking-widest text-slate-950 bg-amber-100/80 border border-amber-400 px-2.5 py-0.5 rounded shadow-2xs">
                          {contract.contractNumber}
                        </span>
                      </div>
                    </div>

                    <div className="bg-amber-50 border-t border-amber-200 px-2 py-0.5 flex items-center justify-between text-[6.8px] font-mono text-amber-900 font-medium">
                      <span>Émis le : <strong>{formattedCreatedAt}</strong></span>
                      <span className="bg-amber-200 text-amber-950 font-black text-[6.2px] px-1.5 py-0.2 rounded border border-amber-300 uppercase">
                        EXEMPLAIRE VIP (RECTO)
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* BANDEAU LÉGAL ET FISCAL */}
              <div className="mt-2 pt-1 border-t border-amber-200 flex items-center justify-between text-[7px] font-mono text-amber-950 bg-amber-50/60 rounded px-2.5 py-0.8">
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-slate-950 uppercase">{companySettings.name}</span>
                  <span className="text-amber-800">• Division Véhicules d'Exception &amp; Conciergerie</span>
                </div>
                <div className="flex items-center gap-2.5 text-slate-800 font-semibold">
                  <span>IF : <strong className="font-bold text-slate-950">{companySettings.taxId}</strong></span>
                  <span className="text-amber-300">|</span>
                  <span>RC : <strong className="font-bold text-slate-950">{companySettings.rc}</strong></span>
                  <span className="text-amber-300">|</span>
                  <span>ICE : <strong className="font-bold text-slate-950">{companySettings.ice}</strong></span>
                  <span className="text-amber-300">|</span>
                  <span>Patente : <strong className="font-bold text-slate-950">{companySettings.patente || '35894120'}</strong></span>
                </div>
              </div>
            </div>

            {/* GOLD SEPARATOR LINE */}
            <div className="mt-1 space-y-0.5">
              <div className="h-[2px] bg-gradient-to-r from-amber-600 via-yellow-400 to-amber-600 rounded-full" />
            </div>
          </div>

          {/* ========================================================================= */}
          {/* SECTION 1: LOCATAIRE VIP & CONDUCTEUR PRIVILÉGIÉ                           */}
          {/* ========================================================================= */}
          <div className="border-2 border-amber-300 rounded-xl bg-gradient-to-b from-amber-50/30 via-white to-amber-50/15 p-2 mb-2 shadow-xs">
            <div className="flex items-center justify-between border-b border-amber-300 pb-1 mb-1.5 bg-gradient-to-r from-zinc-950 via-slate-900 to-zinc-950 text-white px-2.5 py-1 rounded-lg">
              <h2 className="text-[10px] font-black uppercase tracking-wide flex items-center gap-2 text-amber-300">
                <span className="w-5 h-5 bg-amber-500/20 border border-amber-400/50 rounded flex items-center justify-center shrink-0">
                  <Crown className="w-3 h-3 text-amber-400 fill-amber-400" />
                </span>
                <span>
                  {contract.hasSecondDriver && contract.secondDriverSnapshot
                    ? '1. Client Privilégié VIP & Second Conducteur Agréé'
                    : '1. Client Privilégié VIP / Locataire'}
                </span>
              </h2>
              <span className="text-[9px] text-amber-300 font-bold font-arabic">
                الزبون المتميز VIP والسائق الإضافي
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[10px]">
              {/* LOCATAIRE PRINCIPAL VIP */}
              <div className="bg-white p-2 rounded-lg border border-amber-200 border-l-4 border-l-amber-500 shadow-2xs flex flex-col justify-between">
                <div className="flex items-center justify-between border-b border-amber-100 pb-1 mb-1">
                  <span className="text-amber-950 text-[8.5px] uppercase font-black tracking-wider flex items-center gap-1">
                    <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />
                    Locataire Principal VIP
                  </span>
                  <span className="text-[7.5px] bg-amber-100 text-amber-900 border border-amber-300 px-1.5 py-0.2 rounded font-bold uppercase">
                    Membre Privilège
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
                  <span>Tél VIP : <strong className="font-mono text-slate-950">{contract.clientSnapshot.phone || 'Non renseigné'}</strong></span>
                  <span className="text-[8px] text-amber-800 font-bold bg-amber-50 px-1 rounded border border-amber-300">✓ Profil Vérifié</span>
                </div>
              </div>

              {/* SECOND CONDUCTEUR OU PRESTATION CONCIERGERIE */}
              {contract.hasSecondDriver && contract.secondDriverSnapshot ? (
                <div className="bg-white p-2 rounded-lg border border-amber-200 border-l-4 border-l-zinc-700 shadow-2xs flex flex-col justify-between">
                  <div className="flex items-center justify-between border-b border-zinc-200 pb-1 mb-1">
                    <span className="text-zinc-900 text-[8.5px] uppercase font-black tracking-wider">
                      2ème Conducteur Agréé VIP
                    </span>
                    <span className="text-[7.5px] bg-zinc-100 text-zinc-900 border border-zinc-300 px-1.5 py-0.2 rounded font-bold uppercase">
                      Agréé Prestige
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
                    <span>Tél : <strong className="font-mono text-slate-950">{contract.secondDriverSnapshot.phone || 'Non renseigné'}</strong></span>
                    <span className="text-[8px] text-emerald-800 font-bold bg-emerald-50 px-1 rounded border border-emerald-200">✓ Conduite Autorisée</span>
                  </div>
                </div>
              ) : (
                <div className="bg-gradient-to-br from-amber-50/80 via-white to-amber-100/50 p-2 rounded-lg border border-amber-200 flex flex-col justify-between">
                  <div className="flex items-center justify-between border-b border-amber-200 pb-1 mb-1">
                    <span className="text-amber-950 text-[8.5px] uppercase font-black tracking-wider flex items-center gap-1">
                      <Sparkles className="w-2.5 h-2.5 text-amber-600 fill-amber-500" />
                      Prestation Conciergerie VIP
                    </span>
                    <span className="text-[7.5px] bg-amber-200 text-amber-950 font-bold px-1.5 py-0.2 rounded">
                      Inclus
                    </span>
                  </div>
                  <p className="text-[9px] text-slate-700 leading-tight">
                    Livraison &amp; reprise personnalisées à l'hôtel, salon VIP aéroport ou résidence privée sur simple demande.
                  </p>
                  <div className="text-[8.5px] font-bold text-amber-900 mt-1 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                    <span>Protocole de Discrétion &amp; Confidentialité Totale</span>
                  </div>
                </div>
              )}
            </div>

            {/* ADRESSE & LOCALISATION VIP */}
            <div className="mt-1.5 bg-white px-2.5 py-1 rounded-lg border border-amber-200 grid grid-cols-12 gap-2 text-[8.5px]">
              <div className="col-span-6 text-slate-700 flex items-center gap-1.5 truncate">
                <MapPin className="w-3 h-3 text-amber-600 shrink-0" />
                <span className="truncate">
                  Lieu de mise à disposition : <strong className="text-slate-950">{contract.clientSnapshot.address || 'Aéroport Mohammed V / Casablanca VIP Lounge'}</strong>
                </span>
              </div>
              <div className="col-span-4 text-slate-700 truncate flex items-center gap-1">
                <Mail className="w-3 h-3 text-amber-600 shrink-0" />
                <span className="truncate">Contact direct : <strong className="text-slate-950">{contract.clientSnapshot.email || 'Email VIP protégé'}</strong></span>
              </div>
              <div className="col-span-2 text-right text-amber-900 font-extrabold text-[8px] flex items-center justify-end gap-1">
                <Crown className="w-3 h-3 text-amber-600 fill-amber-400" />
                <span>Service 5 Étoiles</span>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* SECTION 2: VÉHICULE D'EXCEPTION & GARANTIES SÉRÉNITÉ PRESTIGE             */}
          {/* ========================================================================= */}
          <div className="border-2 border-amber-300 rounded-xl bg-white p-2 mb-2 shadow-xs">
            <div className="flex items-center justify-between border-b border-amber-300 pb-1 mb-1.5 bg-gradient-to-r from-zinc-950 via-slate-900 to-zinc-950 text-white px-2.5 py-1 rounded-lg">
              <h2 className="text-[10px] font-black uppercase tracking-wide flex items-center gap-2 text-amber-300">
                <span className="w-5 h-5 bg-amber-500/20 border border-amber-400/50 rounded flex items-center justify-center shrink-0">
                  <Car className="w-3 h-3 text-amber-400" />
                </span>
                <span>2. Véhicule d’Exception Loué &amp; Période Privilège</span>
              </h2>
              <span className="text-[9px] text-amber-300 font-bold font-arabic">
                السيارة الفاخرة وفترة الكراء
              </span>
            </div>

            <div className="grid grid-cols-12 gap-2 text-[9.5px]">
              {/* VÉHICULE */}
              <div className="col-span-6 bg-amber-50/50 p-2 rounded-lg border border-amber-200 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-xs text-slate-950 uppercase tracking-wide">
                    {contract.vehicleSnapshot.brand} {contract.vehicleSnapshot.model}
                  </span>
                  <span className="text-[8px] font-mono font-bold bg-zinc-950 text-amber-300 px-2 py-0.5 rounded border border-amber-400">
                    PRESTIGE
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1 mt-1 font-mono text-[9px]">
                  <div>
                    Immat : <strong className="text-slate-950">{formatPlateFrench(contract.vehicleSnapshot.plate)}</strong>
                  </div>
                  <div>
                    Énergie : <strong className="text-slate-950 capitalize">{contract.vehicleSnapshot.fuelType || 'Essence'}</strong>
                  </div>
                  <div>
                    Boîte : <strong className="text-slate-950 capitalize">{contract.vehicleSnapshot.transmission || 'Automatique'}</strong>
                  </div>
                </div>
                <div className="mt-1 pt-1 border-t border-amber-200 flex items-center justify-between text-[8.5px]">
                  <span className="text-slate-700">Km au départ : <strong className="font-mono text-slate-950 font-bold">{contract.departureKm.toLocaleString()} km</strong></span>
                  <span className="text-emerald-800 font-bold bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                    ✓ Préparation Concierge
                  </span>
                </div>
              </div>

              {/* PÉRIODE & DATES */}
              <div className="col-span-6 bg-slate-50 p-2 rounded-lg border border-slate-200 flex flex-col justify-between">
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-white p-1.5 rounded border border-slate-200">
                    <span className="text-[7.5px] uppercase font-bold text-slate-500 block">Date &amp; Heure Départ :</span>
                    <span className="font-mono font-bold text-slate-950 text-[10px]">
                      {formattedStartDate} à {contract.startTime}
                    </span>
                  </div>
                  <div className="bg-white p-1.5 rounded border border-slate-200">
                    <span className="text-[7.5px] uppercase font-bold text-slate-500 block">Date &amp; Heure Retour :</span>
                    <span className="font-mono font-bold text-slate-950 text-[10px]">
                      {formattedEndDate} à {contract.endTime}
                    </span>
                  </div>
                </div>
                <div className="mt-1 pt-1 border-t border-slate-200 flex items-center justify-between text-[8.5px]">
                  <span className="text-slate-700">Durée : <strong className="text-slate-950 font-bold">{contract.totalDays} jour{contract.totalDays > 1 ? 's' : ''}</strong></span>
                  <span className="text-amber-900 font-bold bg-amber-100/80 px-2 py-0.2 rounded border border-amber-300">
                    Tolérance retour 2h incluse
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* SECTION 3: PROTOCOLE D'INSPECTION & CONDITIONS SÉRÉNITÉ                   */}
          {/* ========================================================================= */}
          <div className="border border-amber-200 rounded-xl bg-gradient-to-b from-white to-amber-50/20 p-2 mb-2 shadow-2xs">
            <div className="flex items-center justify-between border-b border-amber-200 pb-1 mb-1">
              <span className="text-[9px] font-black uppercase text-amber-950 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                3. Protocole d’Inspection Haute Joaillerie &amp; Garantie Zéro Franchise
              </span>
              <span className="text-[8px] bg-emerald-100 text-emerald-950 font-bold px-2 py-0.2 rounded border border-emerald-300">
                Couverture Tous Risques Sérénité
              </span>
            </div>

            <div className="grid grid-cols-4 gap-2 text-[8px] text-slate-800 text-center">
              <div className="bg-white p-1 rounded border border-amber-200">
                <span className="block font-bold text-slate-950">Jantes &amp; Pneumatiques</span>
                <span className="text-emerald-700 font-semibold">État Impeccable</span>
              </div>
              <div className="bg-white p-1 rounded border border-amber-200">
                <span className="block font-bold text-slate-950">Sellerie Cuir Noble</span>
                <span className="text-emerald-700 font-semibold">Traitement Luxe</span>
              </div>
              <div className="bg-white p-1 rounded border border-amber-200">
                <span className="block font-bold text-slate-950">Vitrage Athermique</span>
                <span className="text-emerald-700 font-semibold">Conforme Zéro Rayure</span>
              </div>
              <div className="bg-white p-1 rounded border border-amber-200">
                <span className="block font-bold text-slate-950">Niveau Carburant</span>
                <span className="font-mono font-bold text-amber-900">{contract.departureFuel || 'Plein 100%'}</span>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* SECTION 4: RÉCAPITULATIF FINANCIER & CAUTION VIP                          */}
          {/* ========================================================================= */}
          <div className="border-2 border-amber-400/80 rounded-xl bg-gradient-to-r from-amber-50/50 via-white to-amber-50/50 p-2 mb-2 shadow-xs">
            <div className="grid grid-cols-12 items-center gap-3">
              <div className="col-span-4 border-r border-amber-300 pr-2">
                <span className="text-[8px] uppercase font-bold text-slate-500 block">Tarif Journalier Prestige</span>
                <span className="font-mono text-xs font-bold text-slate-950">
                  {contract.pricePerDay !== undefined ? `${contract.pricePerDay.toLocaleString()} MAD / jour` : 'Sur Mesure VIP'}
                </span>
              </div>
              <div className="col-span-4 border-r border-amber-300 pr-2 text-center">
                <span className="text-[8px] uppercase font-bold text-slate-500 block">Montant Total Location</span>
                <span className="font-mono text-sm font-black text-amber-950">
                  {contract.totalAmount !== undefined ? `${contract.totalAmount.toLocaleString()} MAD` : 'Inclus Pack'}
                </span>
                <div className="mt-0.5 flex items-center justify-center gap-2 text-[7px]">
                  {(() => {
                    const pdfPaid = (contract.paidAmount !== undefined ? contract.paidAmount : (contract.payments?.reduce((s, p) => s + (p.amount || 0), 0) ?? 0));
                    const pdfTotal = (contract.totalAmount ?? ((contract.pricePerDay || 0) * contract.totalDays));
                    const pdfRemaining = contract.remainingAmount !== undefined ? contract.remainingAmount : Math.max(0, pdfTotal - pdfPaid);
                    return (
                      <>
                        <span className={`font-bold ${pdfPaid > 0 ? 'text-emerald-700' : 'text-slate-500'}`}>
                          Encaissé : {pdfPaid.toLocaleString('fr-FR')} MAD
                        </span>
                        <span className="text-slate-300">•</span>
                        <span className={`font-bold ${pdfRemaining > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                          Reste : {pdfRemaining.toLocaleString('fr-FR')} MAD {pdfRemaining === 0 ? '(Soldé)' : ''}
                        </span>
                      </>
                    );
                  })()}
                </div>
              </div>
              <div className="col-span-4 pl-2 text-right">
                <span className="text-[8px] uppercase font-bold text-slate-500 block">Dépôt de Garantie VIP</span>
                <span className="font-mono text-xs font-black text-slate-950 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded inline-block">
                  {contract.depositAmount !== undefined
                    ? `${Number(contract.depositAmount).toLocaleString()} MAD (Empreinte)`
                    : contract.depositRecord?.amount !== undefined
                    ? `${Number(contract.depositRecord.amount).toLocaleString()} MAD (Empreinte)`
                    : 'Pré-autorisation'}
                </span>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* SECTION 5: SIGNATURES PRESTIGE VIP                                        */}
          {/* ========================================================================= */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            {/* SIGNATURE CLIENT VIP */}
            <div className="border-2 border-amber-400 rounded-xl p-2 bg-white flex flex-col justify-between min-h-[90px] shadow-xs">
              <div className="flex justify-between items-center border-b border-amber-200 pb-1">
                <span className="text-[8.5px] font-black uppercase text-amber-950 flex items-center gap-1">
                  <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                  Signature du Client Privilégié VIP
                </span>
                <span className="text-[7.5px] font-bold text-amber-900 font-arabic">
                  توقيع الزبون المتميز
                </span>
              </div>
              {contract.clientSignature ? (
                <div className="flex flex-col items-center justify-center flex-1 py-1">
                  <span className="text-[6.5px] text-slate-400 italic font-serif">
                    « Lu et approuvé, bon pour accord VIP »
                  </span>
                  <div className="my-0.5 max-h-[44px] flex items-center justify-center">
                    <img
                      src={contract.clientSignature}
                      alt="Signature VIP"
                      className="max-h-[42px] max-w-[170px] object-contain"
                    />
                  </div>
                  <span className="text-[6.5px] text-emerald-700 font-mono font-bold">
                    ✓ Signé numériquement le {new Date(contract.clientSignedAt || '').toLocaleDateString('fr-FR')}
                  </span>
                </div>
              ) : (
                <div className="text-center py-1 flex-1 flex flex-col justify-center items-center">
                  <span className="text-[7px] text-slate-400 italic">Mention manuscrite :</span>
                  <span className="text-[7.5px] font-bold text-slate-800">« Lu et approuvé, bon pour accord VIP »</span>
                  <span className="text-[7px] font-mono text-slate-600 mt-0.5 font-bold">
                    {contract.clientSnapshot.lastName.toUpperCase()} {contract.clientSnapshot.firstName}
                  </span>
                </div>
              )}
              <div className="text-[6.5px] text-slate-400 text-center border-t border-dashed border-slate-200 pt-0.5">
                {contract.clientSignature ? 'Signature certifiée e-Sign VIP' : 'Signature manuelle certifiée'}
              </div>
            </div>

            {/* CACHET ET VISA DIRECTION MORVELLO PRESTIGE */}
            <div className="border-2 border-zinc-900 rounded-xl p-2 bg-gradient-to-b from-white to-amber-50/20 flex flex-col justify-between min-h-[90px] relative overflow-hidden shadow-xs">
              <div className="flex justify-between items-center border-b border-slate-200 pb-1 z-10 relative">
                <span className="text-[8.5px] font-black uppercase text-slate-950 flex items-center gap-1">
                  <Crown className="w-3 h-3 text-amber-600 fill-amber-500" />
                  Pour Sté MORVELLO CARS • Prestige
                </span>
                <span className="text-[7.5px] font-bold text-slate-700 font-arabic">
                  خاتم وتأشيرة الوكالة
                </span>
              </div>
              <div className="relative flex items-center justify-center py-1 z-0 flex-1">
                <CompanyStamp size="xs" rotation={-1.5} />
                {contract.agencySignature && (
                  <img
                    src={contract.agencySignature}
                    alt="Signature Agence"
                    className="absolute max-h-[44px] max-w-[130px] object-contain z-10"
                  />
                )}
              </div>
              <div className="text-[6.5px] text-slate-600 text-center z-10 font-bold border-t border-slate-200 pt-0.5">
                Division Conciergerie • Fait à Casablanca, le {formattedStartDate}
              </div>
            </div>
          </div>

          {/* FOOTER RECTO */}
          <div className="flex justify-between items-center text-[7px] text-amber-900 font-mono border-t border-amber-300 pt-1 mt-1">
            <span>Contrat Privilège VIP N° <strong className="text-slate-950">{contract.contractNumber}</strong></span>
            <span>Document contractuel d’exception • Tous droits réservés</span>
            <span className="font-bold text-slate-950 bg-amber-200 px-2 py-0.2 rounded border border-amber-300">
              Page 1 / 2 (Recto VIP)
            </span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* PAGE 2: CHARTE DE CONCIERGERIE & CONDITIONS GÉNÉRALES PRESTIGE (VERSO)    */}
      {/* ========================================================================= */}
      <div
        id={page2Id}
        className="a4-page contract-a4-page flex flex-col justify-between text-slate-900 border border-amber-300 print:border-none relative bg-white overflow-hidden shadow-2xl"
      >
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-600 via-yellow-400 to-amber-600" />

        <div className="flex-1 flex flex-col justify-between pt-1">
          {/* HEADER VERSO */}
          <div className="border-b-2 border-amber-400 pb-1.5 mb-1.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Crown className="w-4 h-4 text-amber-600 fill-amber-500" />
              <div>
                <h3 className="text-[10px] font-black tracking-wider uppercase text-slate-950">
                  CHARTE DE CONCIERGERIE VIP &amp; CONDITIONS GÉNÉRALES PRESTIGE
                </h3>
                <p className="text-[7.5px] text-amber-800 font-semibold">
                  Engagements d'Excellence, Discrétion Absolue &amp; Couverture Sérénité
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[9px] font-bold font-arabic text-amber-900">
                ميثاق خدمة كبار الشخصيات والشروط العامة الممتازة
              </span>
              <div className="text-[7px] font-mono text-slate-500">
                Réf : Contrat {contract.contractNumber}
              </div>
            </div>
          </div>

          {/* 20 ARTICLES EN 2 COLONNES */}
          <div className="grid grid-cols-2 gap-3 text-[7.2px] leading-tight text-slate-700 flex-1 overflow-hidden">
            {/* COLONNE 1 */}
            <div className="space-y-1.5 pr-1 border-r border-amber-200">
              {col1Clauses.map((clause) => (
                <div key={clause.number} className="bg-amber-50/20 p-1 rounded border border-amber-100">
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
                <div key={clause.number} className="bg-amber-50/20 p-1 rounded border border-amber-100">
                  <strong className="text-slate-950 font-bold block mb-0.5">
                    {clause.number}. {clause.title}
                  </strong>
                  <p className="text-justify">{clause.content}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ATTESTATION VERSO */}
          <div className="bg-amber-50 border border-amber-300 rounded p-1.5 text-[7px] text-amber-950 my-1 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Crown className="w-3 h-3 text-amber-600 fill-amber-400 shrink-0" />
              <span>
                Le locataire VIP atteste avoir pris pleine connaissance des clauses de conciergerie de la Sté MORVELLO CARS et en accepter l'application.
              </span>
            </div>
            <span className="font-mono font-bold text-slate-950">{contract.contractNumber}</span>
          </div>

          {/* SIGNATURES VERSO */}
          <div className="grid grid-cols-2 gap-3">
            <div className="border border-amber-300 rounded p-1 bg-white text-center min-h-[60px] flex flex-col justify-between">
              <span className="text-[7.5px] font-bold text-amber-950 uppercase">Paraphe du Client VIP</span>
              {contract.clientSignature ? (
                <div className="flex flex-col items-center justify-center flex-1 py-0.5">
                  <img
                    src={contract.clientSignature}
                    alt="Paraphe VIP"
                    className="max-h-[30px] max-w-[120px] object-contain"
                  />
                  <span className="text-[5.5px] text-emerald-700 font-mono">✓ Paraphe certifié</span>
                </div>
              ) : (
                <>
                  <span className="text-[6.5px] text-slate-500 font-mono">« Lu et approuvé »</span>
                  <span className="text-[6px] text-slate-400">Signature</span>
                </>
              )}
            </div>
            <div className="border border-amber-300 rounded p-1 bg-white text-center min-h-[60px] flex flex-col justify-between relative overflow-hidden">
              <span className="text-[7.5px] font-bold text-amber-950 uppercase z-10">Pour Sté MORVELLO CARS Prestige</span>
              <div className="relative flex items-center justify-center py-0.5 z-0 flex-1">
                <CompanyStamp size="xs" rotation={-1.5} />
              </div>
              <span className="text-[6px] text-slate-500 z-10">Casablanca, le {formattedStartDate}</span>
            </div>
          </div>

          {/* FOOTER VERSO */}
          <div className="flex justify-between items-center text-[7px] text-amber-900 font-mono border-t border-amber-300 pt-1 mt-1">
            <span>Réf. Contrat VIP : <strong className="text-slate-950">{contract.contractNumber}</strong></span>
            <span>Charte Officielle de Conciergerie Morvello Prestige</span>
            <span className="font-bold text-slate-950 bg-amber-200 px-2 py-0.2 rounded border border-amber-300">
              Page 2 / 2 (Verso VIP)
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
