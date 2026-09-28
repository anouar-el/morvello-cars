import React from 'react';
import { Contract, CompanySettings, TermsVersion } from '../../types';
import {
  CheckCircle2,
  XCircle,
  Circle,
  Calendar,
  Clock,
  Car,
  Shield,
  Phone,
  MapPin,
  User,
  Mail,
} from 'lucide-react';
import { CompanyStamp } from '../CompanyStamp';
import { CompanyLogo } from '../CompanyLogo';
import { formatPlateFrench } from '../../utils/plateUtils';
import { resolveContractInsurance } from '../../data/insurancePacks';

export interface SignatureContractPdfLayoutProps {
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

/*
 * Modèle 4 « Signature » : reprend la charte du modèle Standard (bandeaux de rubrique colorés,
 * cartes à liseré, cartouche d'en-tête) avec des données réelles là où le Standard affiche
 * des mentions fixes. Les dégradés sont réservés aux bandeaux sombres : en thème clair,
 * index.css force le texte en blanc à l'intérieur de tout élément `bg-gradient-*`.
 */

const SECTION_BARS = {
  blue: 'from-blue-950 via-blue-900 to-indigo-950',
  amber: 'from-amber-900 via-amber-800 to-amber-950',
  emerald: 'from-emerald-900 via-teal-900 to-emerald-950',
  slate: 'from-slate-900 via-slate-800 to-slate-950',
} as const;

const SectionBar: React.FC<{
  index: string;
  title: string;
  arabic: string;
  icon: React.ReactNode;
  tone: keyof typeof SECTION_BARS;
}> = ({ index, title, arabic, icon, tone }) => (
  <div
    className={`flex items-center justify-between mb-1.5 bg-gradient-to-r ${SECTION_BARS[tone]} text-white px-2.5 py-1 rounded-lg shadow-2xs`}
  >
    <h2 className="text-[10.5px] font-black uppercase tracking-wide flex items-center gap-2 text-white">
      <span className="w-5 h-5 bg-white/15 border border-white/25 rounded flex items-center justify-center shrink-0">{icon}</span>
      <span>
        {index}. {title}
      </span>
    </h2>
    <span className="text-[9.5px] text-amber-200 font-bold font-arabic">{arabic}</span>
  </div>
);

/** Badge d'état issu de l'inspection de départ ; « À vérifier » quand rien n'a été relevé. */
const InspectionBadge: React.FC<{ label: string; state: boolean | undefined; okText: string; koText: string }> = ({
  label,
  state,
  okText,
  koText,
}) => {
  const tone =
    state === true
      ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
      : state === false
      ? 'bg-rose-50 border-rose-200 text-rose-950'
      : 'bg-slate-50 border-slate-200 text-slate-700';
  return (
    <div className={`border rounded-md px-2 py-0.5 flex items-center gap-1.5 shadow-2xs ${tone}`}>
      {state === true ? (
        <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
      ) : state === false ? (
        <XCircle className="w-3 h-3 text-rose-600 shrink-0" />
      ) : (
        <Circle className="w-3 h-3 text-slate-400 shrink-0" />
      )}
      <span className="truncate">
        {label} : <strong>{state === true ? okText : state === false ? koText : 'À vérifier'}</strong>
      </span>
    </div>
  );
};

/** Jauge carburant 8 segments à partir de valeurs du type « 6/8 » ou « 8/8 (Plein) ». */
const FuelGauge: React.FC<{ value?: string }> = ({ value }) => {
  const match = value?.match(/(\d)\s*\/\s*8/);
  const level = match ? Math.min(8, Math.max(0, Number(match[1]))) : undefined;
  return (
    <div className="mt-0.5">
      <div className="flex gap-[2px]">
        {Array.from({ length: 8 }).map((_, i) => (
          <span
            key={i}
            className={`h-[7px] flex-1 rounded-[1px] border ${
              level !== undefined && i < level ? 'bg-emerald-500 border-emerald-600' : 'bg-white border-slate-300'
            }`}
          />
        ))}
      </div>
      <div className="text-[8px] text-slate-700 mt-0.5 text-right">
        Carburant : <strong className="text-emerald-700 font-bold">{value || 'À relever'}</strong>
      </div>
    </div>
  );
};

export const SignatureContractPdfLayout: React.FC<SignatureContractPdfLayoutProps> = ({
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

  const client = contract.clientSnapshot;
  const vehicle = contract.vehicleSnapshot;
  const secondDriver = contract.hasSecondDriver ? contract.secondDriverSnapshot : undefined;
  const clientFullName = `${client.lastName.toUpperCase()} ${client.firstName}`;
  const assistancePhone = companySettings.assistancePhone || '0522582962 / 0522589535';

  const checklist = contract.inspection?.departureChecklist;
  const departureFuel = contract.departureFuel || checklist?.fuelLevel;
  const departureNotes = contract.inspection?.departureNotes || contract.inspection?.notes;
  const documentsOk = checklist?.documentsPresent ?? checklist?.documents;
  const safetyOk =
    checklist?.triangle === false || checklist?.vest === false
      ? false
      : checklist?.triangle === true && checklist?.vest === true
      ? true
      : undefined;
  const bodyOk =
    checklist?.bodyCondition === 'conforme' ? true : checklist?.bodyCondition === 'defauts_signales' ? false : undefined;

  const depositAmount =
    contract.depositAmount !== undefined
      ? Number(contract.depositAmount)
      : contract.depositRecord?.amount !== undefined
      ? Number(contract.depositRecord.amount)
      : 5000;
  const depositMethod =
    contract.depositRecord?.method === 'cheque'
      ? 'Chèque de caution'
      : contract.depositRecord?.method === 'cash'
      ? 'Espèces consignées'
      : contract.depositRecord?.method === 'virement'
      ? 'Virement bancaire'
      : 'Empreinte CB bancaire';

  const insurance = resolveContractInsurance(contract);

  const signatureCols = secondDriver ? 'grid-cols-3' : 'grid-cols-2';

  return (
    <div
      className={`pdf-document-root flex ${
        layout === 'side-by-side' ? 'flex-col xl:flex-row' : 'flex-col'
      } items-center gap-8 print:!flex-col print:!gap-0`}
    >
      {/* ========================================================================= */}
      {/* PAGE 1 : CONTRAT DE LOCATION (RECTO)                                      */}
      {/* ========================================================================= */}
      <div id={page1Id} className="a4-page contract-a4-page flex flex-col justify-between text-slate-900 border border-slate-300 print:border-none">
        <div className="flex-1 flex flex-col justify-between">
          {/* EN-TÊTE : LOGO · ASSISTANCE · CARTOUCHE */}
          <div className="pb-1.5 mb-2">
            <div className="bg-white border border-slate-200/90 rounded-xl p-2.5 shadow-2xs">
              <div className="grid grid-cols-12 items-center gap-3">
                <div className="col-span-4 shrink-0 flex items-center gap-2">
                  <CompanyLogo size="md" customHeight={68} variant="raw-image" className="h-[68px] w-auto max-w-[155px]" />
                  <div className="h-10 w-[1px] bg-slate-200 shrink-0" />
                  <div className="flex flex-col justify-center">
                    <span className="text-[7.2px] font-black uppercase tracking-wider text-amber-950 leading-tight">
                      Location de Voitures de Luxe
                    </span>
                    <span className="text-[6px] font-semibold text-slate-500 uppercase tracking-widest mt-0.5">
                      Prestige &amp; VIP
                    </span>
                  </div>
                </div>

                <div className="col-span-4 px-2.5 border-x border-slate-200/90 flex flex-col justify-center gap-1.5">
                  <div className="bg-amber-50 border border-amber-400/80 rounded-lg px-2.5 py-1 text-center shadow-2xs">
                    <div className="flex items-center justify-center gap-1.5 text-[6.8px] font-black uppercase tracking-wider text-amber-950">
                      <Phone className="w-2.5 h-2.5 text-amber-700 shrink-0" />
                      <span>Assistance &amp; Dépannage 24/7</span>
                    </div>
                    <div className="text-[10px] font-mono font-black text-slate-950 tracking-wider mt-0.5">{assistancePhone}</div>
                  </div>
                  <div className="flex items-center justify-center text-[7.5px] font-mono bg-slate-50 border border-slate-200 px-2 py-1 rounded-md shadow-2xs">
                    <span className="flex items-center gap-1 text-slate-800 truncate">
                      <Phone className="w-2.5 h-2.5 text-blue-700 shrink-0" />
                      <span>
                        Tél : <strong className="text-slate-950 font-bold">{activePhone}</strong>
                        {displayManagerName ? <span className="text-slate-500"> · {displayManagerName}</span> : null}
                      </span>
                    </span>
                  </div>
                </div>

                <div className="col-span-4 flex flex-col justify-center">
                  <div className="rounded-lg overflow-hidden border border-slate-900 shadow-2xs">
                    <div className="bg-gradient-to-r from-slate-950 via-blue-950 to-slate-950 text-white px-2.5 py-1 flex items-center justify-between border-b border-amber-400/40">
                      <span className="text-[8.5px] font-black tracking-[0.14em] uppercase text-white">CONTRAT DE LOCATION</span>
                      <span className="text-[8.5px] font-bold font-arabic text-amber-300">عقد كراء سيارة</span>
                    </div>
                    <div className="bg-white px-2 py-1 flex items-center justify-center gap-1.5">
                      <span className="text-[7.5px] font-mono font-bold uppercase text-slate-400">N°</span>
                      <span className="font-mono text-[15px] font-black tracking-widest text-slate-950 bg-amber-50 border border-amber-300/80 px-2.5 py-0.5 rounded shadow-2xs">
                        {contract.contractNumber}
                      </span>
                    </div>
                    <div className="bg-slate-50 border-t border-slate-200 px-2 py-0.5 flex items-center justify-between text-[6.8px] font-mono text-slate-600">
                      <span>
                        Émis le : <strong className="text-slate-950 font-bold">{formattedCreatedAt}</strong>
                      </span>
                      <span className="bg-blue-100 text-blue-950 font-bold text-[6.2px] px-1.5 py-0.2 rounded border border-blue-200 uppercase">
                        ORIGINAL (RECTO)
                      </span>
                    </div>
                  </div>
                </div>
              </div>

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

            <div className="mt-1.5 space-y-0.5">
              <div className="h-[2px] bg-gradient-to-r from-slate-950 via-amber-600 to-slate-950 rounded-full" />
              <div className="h-[0.5px] bg-gradient-to-r from-transparent via-blue-800 to-transparent" />
            </div>
          </div>

          {/* 1. LOCATAIRE / CONDUCTEUR(S) */}
          <div className="border border-blue-200/90 rounded-xl bg-white p-2 mb-1.5 shadow-xs">
            <SectionBar
              index="1"
              tone="blue"
              icon={<User className="w-3 h-3 text-blue-200" />}
              title={secondDriver ? 'Locataire Principal & 2ème Conducteur Agréé' : 'Locataire / Conducteur'}
              arabic={secondDriver ? 'المكتري والسائق الإضافي المرخص له' : 'المكتري / السائق'}
            />

            <div className="grid grid-cols-12 gap-2 text-[10px]">
              <div className="col-span-6 bg-white p-2 rounded-lg border border-slate-200 border-l-4 border-l-blue-600 shadow-2xs flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-blue-900 text-[8px] uppercase font-black tracking-wider">Nom &amp; Prénom / الإسم الكامل</span>
                  {secondDriver && (
                    <span className="text-[7px] bg-blue-50 text-blue-900 border border-blue-200 px-1.5 rounded font-bold uppercase">Principal</span>
                  )}
                </div>
                <p className="font-black text-slate-950 uppercase text-xs tracking-wide mt-0.5">{clientFullName}</p>
                <div className="text-[8.5px] text-slate-600 mt-0.5 flex items-center justify-between">
                  <span>
                    Né(e) le : <strong className="text-slate-900">{client.birthDate || '—'}</strong>
                  </span>
                  <span className="bg-blue-50 text-blue-950 border border-blue-200/80 px-1.5 rounded font-semibold text-[8px]">
                    {client.country || 'Maroc'}
                  </span>
                </div>
              </div>

              <div className="col-span-3 bg-white p-2 rounded-lg border border-slate-200 border-l-4 border-l-indigo-600 shadow-2xs flex flex-col justify-between">
                <span className="text-indigo-900 text-[8px] uppercase font-black tracking-wider">{client.docType} N° / رقم الهوية</span>
                <p className="font-black font-mono text-slate-950 text-xs mt-0.5">{client.docNumber}</p>
                <span className="text-[7.5px] text-emerald-800 font-bold bg-emerald-50 border border-emerald-200/80 px-1 rounded mt-0.5 inline-block w-max">
                  ✓ Original vérifié
                </span>
              </div>

              <div className="col-span-3 bg-white p-2 rounded-lg border border-slate-200 border-l-4 border-l-emerald-600 shadow-2xs flex flex-col justify-between">
                <span className="text-emerald-900 text-[8px] uppercase font-black tracking-wider">Permis / رخصة السياقة</span>
                <p className="font-black font-mono text-slate-950 text-xs mt-0.5">{client.drivingLicense}</p>
                <span className="text-[7.5px] text-emerald-800 font-bold bg-emerald-50 border border-emerald-200/80 px-1 rounded mt-0.5 inline-block w-max">
                  Catégorie B
                </span>
              </div>

              {secondDriver && (
                <div className="col-span-12 bg-white px-2 py-1 rounded-lg border border-slate-200 border-l-4 border-l-purple-600 shadow-2xs grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-5 truncate">
                    <span className="text-purple-900 text-[7.5px] uppercase font-black tracking-wider">2ème Conducteur : </span>
                    <strong className="font-black text-slate-950 uppercase text-[10.5px] tracking-wide">
                      {secondDriver.lastName.toUpperCase()} {secondDriver.firstName}
                    </strong>
                  </div>
                  <div className="col-span-3 text-[9px] text-slate-700">
                    {secondDriver.docType} : <strong className="font-mono text-slate-950">{secondDriver.docNumber}</strong>
                  </div>
                  <div className="col-span-2 text-[9px] text-slate-700">
                    Permis : <strong className="font-mono text-slate-950">{secondDriver.drivingLicense}</strong>
                  </div>
                  <div className="col-span-2 text-[9px] text-slate-700 text-right">
                    <strong className="font-mono text-slate-950">{secondDriver.phone || '—'}</strong>
                  </div>
                </div>
              )}

              <div className="col-span-12 bg-blue-50/60 px-2.5 py-1.5 rounded-lg border border-blue-200/70 grid grid-cols-12 gap-2 text-[9px] shadow-2xs">
                <div className="col-span-4 flex items-center gap-1.5 text-slate-800">
                  <Phone className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span>
                    GSM : <strong className="font-mono text-slate-950 text-[10px]">{client.phone || 'Non renseigné'}</strong>
                  </span>
                </div>
                <div className="col-span-4 text-slate-700 truncate flex items-center gap-1">
                  <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                  {client.email ? (
                    <span className="truncate">
                      Email : <strong className="text-slate-900">{client.email}</strong>
                    </span>
                  ) : (
                    <span className="text-slate-500 italic">Email : Non renseigné</span>
                  )}
                </div>
                <div className="col-span-4 text-slate-700 flex items-center gap-1 truncate">
                  <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span className="truncate">
                    Adresse : <strong className="text-slate-900">{client.address || 'Casablanca, Maroc'}</strong>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 2. VÉHICULE & CONTRÔLE DE DÉPART */}
          <div className="border border-amber-300/80 rounded-xl bg-white p-2 mb-1.5 shadow-xs">
            <SectionBar
              index="2"
              tone="amber"
              icon={<Car className="w-3 h-3 text-amber-200" />}
              title="Véhicule & Contrôle de Départ"
              arabic="بيانات وحالة السيارة عند التسليم"
            />

            <div className="grid grid-cols-12 gap-2 text-[10px]">
              <div className="col-span-5 bg-white p-2 rounded-lg border border-slate-200 border-l-4 border-l-amber-600 shadow-2xs flex flex-col justify-between">
                <span className="text-amber-950 text-[8px] uppercase font-black tracking-wider">Marque &amp; Modèle / النوع</span>
                <p className="font-black text-slate-950 uppercase text-xs tracking-wide mt-0.5">
                  {vehicle.brand} {vehicle.model}
                </p>
                <div className="flex flex-wrap gap-1 mt-0.5">
                  {[vehicle.fuelType, vehicle.transmission, vehicle.color, vehicle.year ? String(vehicle.year) : undefined]
                    .filter(Boolean)
                    .map((tag) => (
                      <span key={tag} className="bg-amber-50 text-amber-950 border border-amber-200/80 px-1.5 rounded font-semibold text-[7.5px]">
                        {tag}
                      </span>
                    ))}
                </div>
              </div>

              <div className="col-span-4 bg-amber-50 p-1.5 rounded-lg border-2 border-amber-400/90 shadow-2xs flex flex-col items-center justify-center text-center">
                <span className="text-amber-950 text-[7.5px] uppercase font-black tracking-wider">Immatriculation / رقم اللوحة</span>
                <div className="mt-0.5 bg-slate-950 border border-amber-500/80 px-3 py-0.5 rounded shadow-xs">
                  <p className="font-mono font-black text-xs tracking-widest text-amber-300">{formatPlateFrench(vehicle.plate)}</p>
                </div>
                <span className="text-[7px] text-amber-900 font-bold mt-0.5 tracking-wide">Royaume du Maroc • تسجيل رسمي</span>
              </div>

              <div className="col-span-3 bg-white p-2 rounded-lg border border-slate-200 border-l-4 border-l-slate-800 shadow-2xs flex flex-col justify-between">
                <span className="text-slate-700 text-[8px] uppercase font-black tracking-wider text-right">KM au Départ</span>
                <p className="font-mono font-black text-slate-950 text-[13px] mt-0.5 text-right">
                  {contract.departureKm.toLocaleString('fr-FR')} <span className="text-[8.5px] font-normal text-slate-600">KM</span>
                </p>
                <FuelGauge value={departureFuel} />
              </div>
            </div>

            {/* Contrôle réel issu de l'inspection de départ */}
            <div className="mt-2 pt-1.5 border-t border-amber-200/60 grid grid-cols-4 gap-2 text-[8.5px]">
              <InspectionBadge label="Roue secours" state={checklist?.spareWheel} okText="Présente" koText="Absente" />
              <InspectionBadge label="Documents bord" state={documentsOk} okText="Conformes" koText="Manquants" />
              <InspectionBadge label="Triangle & Gilet" state={safetyOk} okText="Présents" koText="Incomplet" />
              <InspectionBadge label="Carrosserie" state={bodyOk} okText="Conforme" koText="Défauts signalés" />
            </div>
            {departureNotes && (
              <div className="mt-1.5 text-[8px] text-slate-800 bg-amber-50/60 border border-amber-200/80 rounded-md px-2 py-1 leading-snug line-clamp-2">
                <strong className="text-amber-950 uppercase text-[7.5px]">Observations au départ :</strong> {departureNotes}
              </div>
            )}
          </div>

          {/* 3. DURÉE DE LA LOCATION */}
          <div className="border border-emerald-200/90 rounded-xl bg-white p-2 mb-1.5 shadow-xs">
            <SectionBar
              index="3"
              tone="emerald"
              icon={<Calendar className="w-3 h-3 text-emerald-200" />}
              title="Durée de la Location, Caution & Garanties"
              arabic="مدة الكراء والضمانة والتأمين"
            />

            <div className="grid grid-cols-3 gap-2 text-[10px] mb-2">
              <div className="bg-white p-2 rounded-lg border border-slate-200 border-t-4 border-t-emerald-600 shadow-2xs">
                <div className="flex justify-between items-center text-emerald-900 text-[8px] mb-0.5 font-bold">
                  <span className="uppercase flex items-center gap-1">
                    <Calendar className="w-2.5 h-2.5 text-emerald-700" /> Sortie / Départ
                  </span>
                  <span className="font-arabic">تاريخ الخروج</span>
                </div>
                <div className="font-black text-slate-950 text-[11.5px]">{formattedStartDate}</div>
                <div className="text-slate-700 font-mono text-[9px] mt-0.5 flex items-center gap-1">
                  <Clock className="w-2.5 h-2.5 text-emerald-600" /> Heure : <strong className="text-slate-950">{contract.startTime}</strong> <span className="text-slate-500 font-sans text-[8px]">· Nouaceur / Casablanca</span>
                </div>
              </div>

              <div className="bg-white p-2 rounded-lg border border-slate-200 border-t-4 border-t-amber-600 shadow-2xs">
                <div className="flex justify-between items-center text-amber-900 text-[8px] mb-0.5 font-bold">
                  <span className="uppercase flex items-center gap-1">
                    <Calendar className="w-2.5 h-2.5 text-amber-700" /> Restitution / Retour
                  </span>
                  <span className="font-arabic">تاريخ الدخول</span>
                </div>
                <div className="font-black text-slate-950 text-[11.5px]">{formattedEndDate}</div>
                <div className="text-slate-700 font-mono text-[9px] mt-0.5 flex items-center gap-1">
                  <Clock className="w-2.5 h-2.5 text-amber-600" /> Heure : <strong className="text-slate-950">{contract.endTime}</strong> <span className="text-slate-500 font-sans text-[8px]">· Nouaceur / Casablanca</span>
                </div>
              </div>

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

            {/* Récapitulatif : durée, kilométrage, caution et assurance (aucun tarif : les prix restent internes) */}
            <div className="grid grid-cols-4 gap-2 text-[9px]">
              <div className="bg-blue-50 border border-blue-200/80 rounded-lg p-1.5 text-center shadow-2xs">
                <span className="text-blue-900 text-[8px] uppercase font-bold block">Durée Totale</span>
                <span className="text-xs font-black text-blue-950 block mt-0.5">{contract.totalDays} Jour(s)</span>
              </div>
              <div className="bg-emerald-50 border border-emerald-200/80 rounded-lg p-1.5 text-center shadow-2xs">
                <span className="text-emerald-900 text-[8px] uppercase font-bold block">Kilométrage</span>
                <span className="text-xs font-black text-emerald-950 block mt-0.5">Illimité (Maroc)</span>
                <span className="text-[6.8px] text-emerald-900 block">Carburant restitué à l'identique</span>
              </div>
              <div className="bg-purple-50 border border-purple-200/80 rounded-lg p-1.5 text-center shadow-2xs">
                <span className="text-purple-900 text-[8px] uppercase font-bold block">Caution / الضمانة</span>
                <span className="text-xs font-black font-mono text-purple-950 block mt-0.5">
                  {depositAmount > 0 ? `${depositAmount.toLocaleString('fr-FR')} MAD` : 'Aucun dépôt'}
                </span>
                <span className="text-[6.8px] text-purple-900 block truncate">
                  {depositAmount === 0 && contract.insurance?.depositMad === 0
                    ? `Inclus dans le ${insurance.packLabel}`
                    : `${depositMethod}${contract.depositRecord?.methodDetails ? ` · ${contract.depositRecord.methodDetails}` : ''}`}
                </span>
              </div>
              <div className="bg-slate-950 text-white rounded-lg p-1.5 text-center border border-slate-800 shadow-2xs flex flex-col justify-center">
                <span className="text-amber-400 text-[7.5px] uppercase font-black block leading-tight">Couverture Assurance</span>
                <span className="text-[9.5px] font-black text-white block leading-tight mt-0.5">{insurance.packLabel}</span>
                <span className="text-[6.8px] text-slate-300 block">Franchise : {insurance.franchiseMad.toLocaleString('fr-FR')} MAD</span>
              </div>
            </div>
          </div>

          {/* 4. SIGNATURES */}
          <div className="border-2 border-slate-900 rounded-xl bg-white p-2 shadow-xs">
            <SectionBar
              index="4"
              tone="slate"
              icon={<Shield className="w-3 h-3 text-amber-300" />}
              title="Signatures — « Lu et approuvé »"
              arabic="توقيعات الأطراف مسبوقة بعبارة قرئ وصودق عليه"
            />

            <div className={`grid ${signatureCols} gap-2.5`}>
              <div className="border-2 border-amber-500/60 rounded-xl p-2 flex flex-col justify-between min-h-[104px] bg-amber-50/40 shadow-2xs relative">
                <div className="text-[8.5px] font-black uppercase text-amber-950 bg-amber-100 border border-amber-300/80 px-2 py-0.5 rounded-md text-center z-10 relative">
                  Pour Sté {companySettings.name} • خاتم الوكالة
                </div>
                <div className="relative flex items-center justify-center py-1 z-0 flex-1">
                  <CompanyStamp size={secondDriver ? 'sm' : 'md'} rotation={-1.5} />
                  {contract.agencySignature && (
                    <img src={contract.agencySignature} alt="Signature Agence" className="absolute max-h-[50px] max-w-[130px] object-contain z-10" />
                  )}
                </div>
                <div className="text-[7.5px] text-slate-500 text-center z-10 font-medium">
                  {contract.agencySignedBy ? (
                    <span className="font-semibold text-slate-700">Signé par {contract.agencySignedBy}</span>
                  ) : (
                    'Visa & Cachet légal agence'
                  )}
                </div>
              </div>

              <div className="border-2 border-blue-900/40 rounded-xl p-2 flex flex-col justify-between min-h-[104px] bg-blue-50/40 shadow-2xs">
                <div className="text-[8.5px] font-black uppercase text-blue-950 bg-blue-100 border border-blue-300/80 px-2 py-0.5 rounded-md text-center">
                  Le Locataire • توقيع المكتري
                </div>
                <div className="flex flex-col items-center justify-center flex-1 py-1">
                  {contract.clientSignature ? (
                    <img src={contract.clientSignature} alt="Signature locataire" className="max-h-[50px] max-w-[170px] object-contain" />
                  ) : (
                    <>
                      <span className="text-[8px] text-slate-400 italic">Mention manuscrite obligatoire :</span>
                      <span className="text-[8.5px] font-semibold text-slate-700 italic">« Lu et approuvé, bon pour accord »</span>
                    </>
                  )}
                </div>
                <div className="text-center text-[7.5px] text-slate-500 font-medium truncate">
                  <span className="font-mono font-bold text-slate-800">{contract.clientSignedName || clientFullName}</span>
                  {contract.clientSignedAt && (
                    <span className="block text-[6.5px] text-emerald-700 font-mono truncate">
                      ✓ Signé le {new Date(contract.clientSignedAt).toLocaleDateString('fr-FR')} à{' '}
                      {new Date(contract.clientSignedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      {contract.signatureCertId ? ` • Réf. ${contract.signatureCertId}` : ''}
                    </span>
                  )}
                </div>
              </div>

              {secondDriver && (
                <div className="border-2 border-purple-900/30 rounded-xl p-2 flex flex-col justify-between min-h-[104px] bg-purple-50/40 shadow-2xs">
                  <div className="text-[8.5px] font-black uppercase text-purple-950 bg-purple-100 border border-purple-300/80 px-2 py-0.5 rounded-md text-center">
                    2ème Conducteur • السائق الإضافي
                  </div>
                  <div className="flex flex-col items-center justify-center flex-1 py-1">
                    {contract.secondDriverSignature ? (
                      <img src={contract.secondDriverSignature} alt="Signature 2e conducteur" className="max-h-[50px] max-w-[170px] object-contain" />
                    ) : (
                      <span className="text-[8.5px] font-semibold text-slate-700 italic">« Lu et approuvé »</span>
                    )}
                  </div>
                  <div className="text-center text-[7.5px] font-mono font-bold text-slate-800 truncate">
                    {secondDriver.lastName.toUpperCase()} {secondDriver.firstName}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* PIED DE PAGE 1 */}
        <div className="border-t-2 border-slate-900 pt-1.5 mt-1.5 text-center text-[8px] text-slate-700 leading-tight">
          <div>
            <strong className="font-extrabold text-slate-950 uppercase tracking-wider">{companySettings.name}</strong> • SARL au
            Capital de 100 000 MAD • IF : <strong className="text-slate-900">{companySettings.taxId}</strong> • RC :{' '}
            <strong className="text-slate-900">{companySettings.rc}</strong> • ICE :{' '}
            <strong className="text-slate-900">{companySettings.ice}</strong>
            {companySettings.address && !companySettings.address.includes('ANNAKHIL') ? (
              <span className="text-slate-600"> • Siège : {companySettings.address}</span>
            ) : null}
          </div>
          <div className="text-slate-600 mt-0.5">
            Tél : <strong className="text-slate-900">{activePhone}</strong> • Assistance :{' '}
            <span className="font-bold text-slate-900 font-mono">{assistancePhone}</span> • {companySettings.website} •{' '}
            {companySettings.email}
          </div>
          <div className="flex justify-between items-center mt-1 pt-1 border-t border-slate-200 text-[8px] font-mono text-slate-600">
            <span>
              Contrat N° <strong>{contract.contractNumber}</strong>
            </span>
            <span className="font-bold text-slate-950 bg-slate-100 px-2.5 py-0.5 rounded border border-slate-300">Page 1 / 2 (Recto)</span>
            <span>Conditions Générales au verso</span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* PAGE 2 : CONDITIONS GÉNÉRALES DE LOCATION (VERSO)                         */}
      {/* ========================================================================= */}
      <div id={page2Id} className="a4-page contract-a4-page flex flex-col justify-between text-slate-900 border border-slate-300 print:border-none">
        <div className="flex flex-col">
          <div className="pb-1 mb-1.5">
            <div className="flex items-center justify-between gap-4">
              <CompanyLogo size="xs" customHeight={46} variant="raw-image" className="h-[46px] w-auto max-w-[150px]" />
              <div className="text-right flex flex-col items-end justify-center">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[10px] font-black tracking-[0.2em] text-slate-950 uppercase">CONDITIONS GÉNÉRALES DE LOCATION</span>
                  <span className="text-slate-300 font-light">|</span>
                  <span className="text-[9.5px] font-arabic font-bold text-amber-700">شروط الكراء العامة</span>
                </div>
                <div className="text-[7.5px] font-mono text-slate-500 flex items-center gap-2">
                  <span>Réf. Juridique V{termsVersion.version}</span>
                  <span className="text-slate-300">•</span>
                  <span className="text-slate-700 font-medium">Verso contractuel officiel indissociable</span>
                </div>
              </div>
            </div>
            <div className="h-[1.5px] bg-gradient-to-r from-slate-900 via-amber-700 to-slate-900 mt-1.5" />
          </div>

          {/* Rappel du contrat */}
          <div className="bg-gradient-to-r from-slate-950 via-blue-950 to-slate-950 text-white border border-slate-800 rounded px-2.5 py-1 flex items-center justify-between text-[7.5px] font-mono shadow-2xs">
            <div className="flex items-center gap-1">
              <span className="text-amber-400 font-semibold uppercase">Contrat N° :</span>
              <strong className="text-white font-bold bg-white/10 px-1.5 rounded border border-white/20">{contract.contractNumber}</strong>
            </div>
            <div className="border-l border-slate-700 pl-2 flex items-center gap-1">
              <span className="text-slate-300">Locataire :</span>
              <strong className="text-amber-300 font-bold">{clientFullName}</strong>
            </div>
            <div className="border-l border-slate-700 pl-2 flex items-center gap-1">
              <span className="text-slate-300">Véhicule :</span>
              <strong className="text-emerald-300 font-bold">
                {vehicle.brand} {vehicle.model}
              </strong>
              <span className="text-slate-400">({formatPlateFrench(vehicle.plate)})</span>
            </div>
            <div className="border-l border-slate-700 pl-2 flex items-center gap-1">
              <span className="text-slate-300">Période :</span>
              <strong className="text-white">{formattedStartDate}</strong> au <strong className="text-white">{formattedEndDate}</strong>
            </div>
          </div>

          {/* Articles en deux colonnes */}
          <div className="grid grid-cols-2 gap-x-4 text-[8.7px] leading-[1.45] text-slate-800 mt-2">
            {[col1Clauses, col2Clauses].map((clauses, colIdx) => (
              <div key={colIdx} className="space-y-1.5">
                {clauses.map((clause) => (
                  <div key={clause.number} className="border-b border-slate-200/90 pb-0.5">
                    <div className="font-bold text-slate-950 flex items-center gap-1 mb-0.5">
                      <span className="inline-flex items-center justify-center bg-blue-950 text-amber-300 border border-blue-900 rounded text-[6.5px] font-mono font-bold px-1.5 shrink-0">
                        Art. {clause.number}
                      </span>
                      <span className="uppercase text-[8.3px] font-black text-slate-900 tracking-tight">{clause.title}</span>
                    </div>
                    <p className="text-slate-700 text-justify leading-snug">{clause.content}</p>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="border-t-2 border-slate-900 pt-1.5 mt-1 space-y-1.5">
          {/* Frais particuliers */}
          <div className="grid grid-cols-6 gap-1 text-[6.8px] font-mono">
            {[
              ['Franchise Sinistre', `${insurance.franchiseMad.toLocaleString('fr-FR')} MAD`, 'bg-slate-100 border-slate-300 text-slate-950'],
              ['Retard Restitution', 'Tarif/j + 50%', 'bg-amber-50 border-amber-300 text-amber-950'],
              ['Frais Dossier PV', '150 DH / infr.', 'bg-blue-50 border-blue-300 text-blue-950'],
              ['Carburant Écart', 'Pompe + 100 DH', 'bg-emerald-50 border-emerald-300 text-emerald-950'],
              ['Nettoyage Spécial', '250 à 500 DH', 'bg-purple-50 border-purple-300 text-purple-950'],
              ['Perte Clés/Doc', 'Facture constr.', 'bg-rose-50 border-rose-300 text-rose-950'],
            ].map(([label, value, tone]) => (
              <div key={label} className={`border rounded p-1 shadow-2xs ${tone}`}>
                <span className="block uppercase font-bold text-[5.8px] opacity-80">{label} :</span>
                <strong className="font-black">{value}</strong>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-1 text-[6.8px] leading-tight">
            <div className="bg-blue-50/60 border border-blue-200/80 rounded p-1">
              <span className="font-black text-blue-950 block uppercase text-[6.2px]">1. Sécurité &amp; Code Routier</span>
              <p className="text-slate-700">Ceinture obligatoire, zéro alcool, respect des radars (Loi 52-05).</p>
            </div>
            <div className="bg-amber-50/60 border border-amber-200/80 rounded p-1">
              <span className="font-black text-amber-950 block uppercase text-[6.2px]">2. Pistes &amp; Territoire</span>
              <p className="text-slate-700">Voies goudronnées uniquement. Pistes non carrossables et plages interdites.</p>
            </div>
            <div className="bg-emerald-50/60 border border-emerald-200/80 rounded p-1">
              <span className="font-black text-emerald-950 block uppercase text-[6.2px]">3. Sinistre &amp; Déclaration</span>
              <p className="text-slate-700">Constat ou PV de police obligatoire sous 24h ouvrées. Avis immédiat agence.</p>
            </div>
          </div>

          <div className="bg-emerald-50/70 border border-emerald-300/80 px-2 py-1 rounded text-[6.8px] text-slate-800 leading-tight shadow-2xs flex items-start gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0 mt-0.5" />
            <p>
              <strong className="text-emerald-950 uppercase">Attestation d'adhésion sans réserve : </strong>
              Le locataire et les conducteurs agréés attestent avoir pris connaissance des {termsVersion.clauses.length} articles des
              CGV de la Sté {companySettings.name} (contrat n° <strong className="text-slate-950 font-mono">{contract.contractNumber}</strong>),
              en approuver toutes les clauses et confirmer l'exactitude des déclarations du recto.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="border-2 border-blue-900/30 rounded p-1.5 bg-blue-50/30 flex flex-col justify-between min-h-[76px] shadow-2xs">
              <div className="flex justify-between items-center border-b border-blue-200/80 pb-0.5">
                <span className="text-[7.5px] font-black uppercase text-blue-950">Paraphe &amp; Signature du Locataire</span>
                <span className="text-[7px] font-bold text-blue-900 font-arabic">توقيع ومصادقة المكتري</span>
              </div>
              <div className="flex-1 flex items-center justify-center py-0.5">
                {contract.clientSignature ? (
                  <img src={contract.clientSignature} alt="Paraphe électronique" className="max-h-[34px] max-w-[140px] object-contain" />
                ) : (
                  <span className="text-[7px] font-semibold text-slate-700 italic">« Lu et approuvé, bon pour accord »</span>
                )}
              </div>
              <div className="text-[6.5px] font-mono text-slate-500 text-center border-t border-dashed border-slate-200 pt-0.5">{clientFullName}</div>
            </div>

            <div className="border-2 border-amber-500/40 rounded p-1.5 bg-amber-50/30 flex flex-col justify-between min-h-[76px] relative overflow-hidden shadow-2xs">
              <div className="flex justify-between items-center border-b border-amber-200/80 pb-0.5 z-10 relative">
                <span className="text-[7.5px] font-black uppercase text-amber-950">Pour Sté {companySettings.name}</span>
                <span className="text-[7px] font-bold text-amber-900 font-arabic">خاتم وتأشيرة الوكالة</span>
              </div>
              <div className="relative flex items-center justify-center py-0.5 z-0 flex-1">
                <CompanyStamp size="xs" rotation={-1.5} />
              </div>
              <div className="text-[6.5px] text-slate-500 text-center z-10 font-medium border-t border-slate-200 pt-0.5">
                Visa légal agence • Fait à Casablanca, le {formattedStartDate}
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center text-[7px] text-slate-600 font-mono border-t border-slate-200 pt-0.5">
            <span>
              Réf. Contrat : <strong className="text-slate-900">{contract.contractNumber}</strong>
            </span>
            <span>Document contractuel officiel recto-verso — Opposable aux tiers</span>
            <span className="font-bold text-slate-950 bg-slate-100 px-2 rounded border border-slate-300">Page 2 / 2 (Verso)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
