import React from 'react';
import { Contract, CompanySettings, TermsVersion } from '../../types';
import { CheckCircle2, XCircle, Calendar, Clock, Car, Shield, Phone, MapPin, User, Mail } from 'lucide-react';
import { CompanyStamp } from '../CompanyStamp';
import { CompanyLogo } from '../CompanyLogo';
import { DepositStatusTag } from '../DepositStatusTag';
import { formatPlateFrench } from '../../utils/plateUtils';
import { formatFranchise, resolveContractInsurance } from '../../data/insurancePacks';

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
 * Modèle 4 « Signature » : la charte du modèle Standard (bandeaux de rubrique colorés bilingues,
 * cartes à liseré, cartouche d'en-tête) alimentée par les données réelles du contrat.
 *
 * COULEURS : uniquement des valeurs littérales (`text-[#…]`, styles en ligne), jamais la palette
 * Tailwind (`text-slate-900`, `bg-amber-50`, `text-white`…). Le thème clair de l'application
 * remappe cette palette et force des couleurs sur ces classes : avec elles, le contrat imprimé
 * changeait d'aspect — jusqu'à devenir illisible — selon le thème de l'agent qui l'éditait.
 */

type Tone = 'blue' | 'amber' | 'emerald' | 'slate';

const TONES: Record<Tone, { bar: string; frame: string; accent: string; label: string; soft: string; softLine: string }> = {
  blue: {
    bar: 'linear-gradient(90deg, #172554, #1e3a8a 50%, #1e1b4b)',
    frame: '#c7d4f3',
    accent: '#1d4ed8',
    label: '#1e3a8a',
    soft: '#f1f5fd',
    softLine: '#c7d4f3',
  },
  amber: {
    bar: 'linear-gradient(90deg, #78350f, #92400e 50%, #451a03)',
    frame: '#ecd08a',
    accent: '#b45309',
    label: '#78350f',
    soft: '#fdf7e7',
    softLine: '#ecd08a',
  },
  emerald: {
    bar: 'linear-gradient(90deg, #064e3b, #134e4a 50%, #022c22)',
    frame: '#b9e3d3',
    accent: '#047857',
    label: '#065f46',
    soft: '#eefaf5',
    softLine: '#b9e3d3',
  },
  slate: {
    bar: 'linear-gradient(90deg, #0f172a, #1e293b 50%, #020617)',
    frame: '#0f172a',
    accent: '#0f172a',
    label: '#0f172a',
    soft: '#f6f8fb',
    softLine: '#dbe2ea',
  },
};

const HEADER_RULE = 'linear-gradient(90deg, #0b1638, #b7791f 50%, #0b1638)';
const DARK_BAND = 'linear-gradient(90deg, #020617, #172554 50%, #020617)';

const Section: React.FC<{
  tone: Tone;
  index: string;
  title: string;
  arabic: string;
  icon: React.ReactNode;
  strong?: boolean;
  children: React.ReactNode;
}> = ({ tone, index, title, arabic, icon, strong, children }) => (
  <section
    className={`rounded-xl bg-[#ffffff] p-1.5 ${strong ? 'border-2' : 'border'}`}
    style={{ borderColor: TONES[tone].frame }}
  >
    <div
      className="flex items-center justify-between gap-3 rounded-lg px-2.5 py-[5px] mb-1.5"
      style={{ backgroundImage: TONES[tone].bar }}
    >
      <h2 className="flex items-center gap-2 text-[11.5px] font-black uppercase tracking-wide text-[#ffffff]">
        <span className="w-5 h-5 rounded flex items-center justify-center shrink-0 bg-[#ffffff26] border border-[#ffffff40] text-[#fde9b0]">
          {icon}
        </span>
        <span>
          {index}. {title}
        </span>
      </h2>
      <span className="text-[11px] font-bold text-[#fde9b0] whitespace-nowrap">{arabic}</span>
    </div>
    {children}
  </section>
);

/** Carte de donnée à liseré gauche, de la couleur de sa rubrique. */
const Card: React.FC<{ tone: Tone; dense?: boolean; className?: string; children: React.ReactNode }> = ({
  tone,
  dense,
  className = '',
  children,
}) => (
  <div
    className={`rounded-lg bg-[#ffffff] border border-[#dbe2ea] border-l-[3px] px-2 ${dense ? 'py-1' : 'py-2'} ${className}`}
    style={{ borderLeftColor: TONES[tone].accent }}
  >
    {children}
  </div>
);

const Label: React.FC<{ tone: Tone; className?: string; children: React.ReactNode }> = ({ tone, className = '', children }) => (
  <span className={`text-[9px] font-black uppercase tracking-[0.05em] ${className}`} style={{ color: TONES[tone].label }}>
    {children}
  </span>
);

const Tag: React.FC<{ tone: Tone; children: React.ReactNode }> = ({ tone, children }) => (
  <span
    className="inline-block rounded border px-1.5 text-[8px] font-bold leading-[1.5] whitespace-nowrap"
    style={{ backgroundColor: TONES[tone].soft, borderColor: TONES[tone].softLine, color: TONES[tone].label }}
  >
    {children}
  </span>
);

/**
 * Point de contrôle de départ. État relevé à l'inspection s'il existe ; sinon deux cases à cocher
 * à la main lors de la remise des clés.
 */
const InspectionItem: React.FC<{
  label: string;
  state: boolean | undefined;
  okText: string;
  koText: string;
  boxes?: [string, string];
}> = ({ label, state, okText, koText, boxes = ['Oui', 'Non'] }) => {
  if (state === undefined) {
    const box = <span className="inline-block w-[9px] h-[9px] rounded-[2px] border border-[#475569] bg-[#ffffff] shrink-0" />;
    return (
      <div className="rounded-md border border-[#dbe2ea] bg-[#f6f8fb] px-2 py-1 flex items-center justify-between gap-1.5">
        <span className="font-bold text-[#1e293b] truncate">{label}</span>
        <span className="flex items-center gap-2 text-[#334155] shrink-0">
          {boxes.map((choice) => (
            <span key={choice} className="flex items-center gap-1">
              {box} {choice}
            </span>
          ))}
        </span>
      </div>
    );
  }
  return (
    <div
      className={`rounded-md border px-2 py-1 flex items-center gap-1.5 ${
        state ? 'bg-[#ecfdf5] border-[#a7f3d0] text-[#064e3b]' : 'bg-[#fef2f2] border-[#fecaca] text-[#7f1d1d]'
      }`}
    >
      {state ? (
        <CheckCircle2 className="w-3 h-3 shrink-0 text-[#059669]" />
      ) : (
        <XCircle className="w-3 h-3 shrink-0 text-[#dc2626]" />
      )}
      <span className="truncate">
        {label} : <strong className="font-black">{state ? okText : koText}</strong>
      </span>
    </div>
  );
};

/** Jauge carburant 8 segments à partir de valeurs du type « 6/8 » ou « 8/8 (Plein) ». */
const FuelGauge: React.FC<{ value?: string }> = ({ value }) => {
  const match = value?.match(/(\d)\s*\/\s*8/);
  const level = match ? Math.min(8, Math.max(0, Number(match[1]))) : undefined;
  return (
    <div className="mt-1">
      <div className="flex gap-[2px]">
        {Array.from({ length: 8 }).map((_, i) => (
          <span
            key={i}
            className={`h-[7px] flex-1 rounded-[1px] border ${
              level !== undefined && i < level ? 'bg-[#10b981] border-[#059669]' : 'bg-[#ffffff] border-[#cbd5e1]'
            }`}
          />
        ))}
      </div>
      <div className="text-[8.5px] text-[#334155] mt-0.5 text-right">
        Carburant : <strong className="font-black text-[#047857]">{value || 'À relever'}</strong>
      </div>
    </div>
  );
};

/** « 1988-03-22 » → « 22/03/1988 » ; toute autre saisie est rendue telle quelle. */
function formatDateFr(value?: string): string {
  const iso = value?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return iso ? `${iso[3]}/${iso[2]}/${iso[1]}` : value || '—';
}

// Géométrie du verso A4, en px CSS : largeur d'une colonne d'articles et hauteur qui leur reste
const TERMS_COLUMN_WIDTH = 343;
const TERMS_COLUMN_HEIGHT = 640;
const TERMS_LINE_HEIGHT = 1.38;
// Largeur moyenne d'un caractère, volontairement pessimiste : l'estimation penche du côté « trop long »
const TERMS_CHAR_WIDTH_EM = 0.47;
// Ligne de titre et espacements d'un article
const TERMS_CLAUSE_CHROME_EM = 2.4;

/**
 * Répartit les articles en deux colonnes de hauteur voisine, au plus grand corps qui tient dans
 * la page. Les conditions générales sont modifiables : si elles s'allongent, le corps diminue au
 * lieu de pousser les signatures du verso hors de la page.
 */
function layoutClauses<T extends { content: string }>(clauses: T[]): { columns: [T[], T[]]; fontSize: number } {
  for (let tenths = 96; ; tenths--) {
    const fontSize = tenths / 10;
    const charsPerLine = TERMS_COLUMN_WIDTH / (TERMS_CHAR_WIDTH_EM * fontSize);
    const heights = clauses.map(
      (clause) => fontSize * (TERMS_CLAUSE_CHROME_EM + Math.ceil(clause.content.length / charsPerLine) * TERMS_LINE_HEIGHT)
    );
    const total = heights.reduce((sum, height) => sum + height, 0);

    let cut = clauses.length;
    let tallest = total;
    let firstColumn = 0;
    for (let i = 1; i < clauses.length; i++) {
      firstColumn += heights[i - 1];
      const candidate = Math.max(firstColumn, total - firstColumn);
      if (candidate < tallest) {
        tallest = candidate;
        cut = i;
      }
    }

    if (tallest <= TERMS_COLUMN_HEIGHT || tenths <= 70) {
      return { columns: [clauses.slice(0, cut), clauses.slice(cut)], fontSize };
    }
  }
}

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
  const { columns: clauseColumns, fontSize: termsFontSize } = layoutClauses(termsVersion.clauses);

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
  // Le détail saisi reprend souvent le moyen (« Empreinte bancaire TPE ») : ne pas l'imprimer deux fois
  const depositDetails = contract.depositRecord?.methodDetails?.trim();
  const depositLine =
    depositDetails && depositDetails.toLowerCase().includes(depositMethod.split(' ')[0].toLowerCase())
      ? depositDetails
      : [depositMethod, depositDetails].filter(Boolean).join(' · ');

  const insurance = resolveContractInsurance(contract);

  const legalIds = (
    [
      ['IF', companySettings.taxId],
      ['RC', companySettings.rc],
      ['ICE', companySettings.ice],
      ['Patente', companySettings.patente || '35894120'],
    ] as Array<[string, string | undefined]>
  ).filter(([, value]) => Boolean(value && String(value).trim()));
  const contactItems = [companySettings.website, companySettings.email].filter((item) => Boolean(item && item.trim()));

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
      <div id={page1Id} className="a4-page contract-a4-page flex flex-col justify-between text-[#0b1220] border border-[#cbd5e1] print:border-none">
        <div className="flex-1 flex flex-col justify-between gap-1.5">
          {/* EN-TÊTE : LOGO · ASSISTANCE · CARTOUCHE */}
          <div>
            <div className="grid grid-cols-12 items-center gap-3">
              <div className="col-span-4 flex items-center gap-2.5">
                <CompanyLogo size="md" customHeight={70} variant="raw-image" className="h-[70px] w-auto max-w-[150px]" />
                <div className="border-l border-[#dbe2ea] pl-2.5">
                  <div className="text-[8.5px] font-black uppercase tracking-[0.1em] leading-[1.25] text-[#78350f]">
                    Location de voitures
                    <br />
                    de luxe
                  </div>
                  <div className="text-[7.5px] font-bold uppercase tracking-[0.2em] text-[#64748b] mt-1">Prestige &amp; VIP</div>
                </div>
              </div>

              <div className="col-span-4 flex flex-col justify-center gap-1">
                <div className="rounded-lg border border-[#e5b94a] bg-[#fdf7e7] px-2.5 py-1 text-center">
                  <div className="flex items-center justify-center gap-1.5 text-[8px] font-black uppercase tracking-[0.06em] text-[#78350f]">
                    <Phone className="w-2.5 h-2.5 shrink-0 text-[#b45309]" />
                    <span>Assistance &amp; Dépannage 24/7</span>
                  </div>
                  <div className="text-[11.5px] font-mono font-black tracking-wider text-[#0b1220] mt-0.5">{assistancePhone}</div>
                </div>
                <div className="rounded-md border border-[#dbe2ea] bg-[#f6f8fb] px-2 py-[3px] flex items-center justify-center gap-1 text-[8.5px] text-[#334155]">
                  <Phone className="w-2.5 h-2.5 shrink-0 text-[#1d4ed8]" />
                  <span className="truncate">
                    Agence : <strong className="font-mono font-black text-[#0b1220]">{activePhone}</strong>
                    {displayManagerName ? <span className="text-[#64748b]"> · {displayManagerName}</span> : null}
                  </span>
                </div>
              </div>

              <div className="col-span-4">
                <div className="rounded-lg overflow-hidden border border-[#0b1638]">
                  <div className="px-2.5 py-1 flex items-center justify-between" style={{ backgroundImage: DARK_BAND }}>
                    <span className="text-[9.5px] font-black tracking-[0.14em] uppercase text-[#ffffff]">Contrat de location</span>
                    <span className="text-[9.5px] font-bold text-[#fcd34d]">عقد كراء سيارة</span>
                  </div>
                  <div className="bg-[#ffffff] px-2 py-1 flex items-center justify-center gap-1.5">
                    <span className="text-[8.5px] font-mono font-bold uppercase text-[#64748b]">N°</span>
                    <span className="font-mono text-[16px] font-black tracking-widest leading-tight text-[#0b1220] bg-[#fdf7e7] border border-[#e5b94a] px-2.5 py-0.5 rounded">
                      {contract.contractNumber}
                    </span>
                  </div>
                  <div className="bg-[#f6f8fb] border-t border-[#dbe2ea] px-2 py-[3px] flex items-center justify-between text-[8px] text-[#475569]">
                    <span>
                      Émis le <strong className="font-mono font-black text-[#0b1220]">{formattedCreatedAt}</strong>
                    </span>
                    <span className="rounded border border-[#c7d4f3] bg-[#e8eefc] px-1.5 text-[7.5px] font-black uppercase text-[#1e3a8a]">
                      Original · Recto
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-2 h-[2px] rounded-full" style={{ backgroundImage: HEADER_RULE }} />
          </div>

          {/* 1. LOCATAIRE / CONDUCTEUR(S) */}
          <Section
            tone="blue"
            index="1"
            icon={<User className="w-3 h-3" />}
            title={secondDriver ? 'Locataire Principal & 2ème Conducteur Agréé' : 'Locataire / Conducteur'}
            arabic={secondDriver ? 'المكتري والسائق الإضافي المرخص له' : 'المكتري / السائق'}
          >
            <div className="grid grid-cols-12 gap-1.5">
              <Card tone="blue" className="col-span-6">
                <div className="flex items-center justify-between gap-2">
                  <Label tone="blue">Nom &amp; Prénom / الإسم الكامل</Label>
                  {secondDriver && <Tag tone="blue">Principal</Tag>}
                </div>
                <p className="text-[14.5px] font-black uppercase tracking-wide leading-tight text-[#0b1220] mt-0.5 line-clamp-2">{clientFullName}</p>
                <div className="flex items-center justify-between gap-2 mt-1 text-[9.5px] text-[#475569]">
                  <span>
                    Né(e) le : <strong className="font-black text-[#0b1220]">{formatDateFr(client.birthDate)}</strong>
                  </span>
                  <Tag tone="blue">{client.country || 'Maroc'}</Tag>
                </div>
              </Card>

              <Card tone="blue" className="col-span-3">
                <Label tone="blue">{client.docType} N° / رقم الهوية</Label>
                <p className="text-[13.5px] font-mono font-black leading-tight text-[#0b1220] mt-0.5">{client.docNumber}</p>
                <div className="mt-1">
                  <Tag tone="emerald">✓ Original vérifié</Tag>
                </div>
              </Card>

              <Card tone="blue" className="col-span-3">
                <Label tone="blue">Permis / رخصة السياقة</Label>
                <p className="text-[13.5px] font-mono font-black leading-tight text-[#0b1220] mt-0.5">{client.drivingLicense}</p>
                <div className="mt-1">
                  <Tag tone="emerald">Catégorie B</Tag>
                </div>
              </Card>

              {secondDriver && (
                <Card tone="blue" dense className="col-span-12 grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-5 leading-tight">
                    <Label tone="blue">2ème conducteur : </Label>
                    <strong className="text-[12px] font-black uppercase tracking-wide text-[#0b1220]">
                      {secondDriver.lastName.toUpperCase()} {secondDriver.firstName}
                    </strong>
                  </div>
                  <div className="col-span-3 text-[9.5px] text-[#475569] truncate">
                    {secondDriver.docType} : <strong className="font-mono font-black text-[#0b1220]">{secondDriver.docNumber}</strong>
                  </div>
                  <div className="col-span-2 text-[9.5px] text-[#475569] truncate">
                    Permis : <strong className="font-mono font-black text-[#0b1220]">{secondDriver.drivingLicense}</strong>
                  </div>
                  <div className="col-span-2 text-[9.5px] text-right truncate">
                    <strong className="font-mono font-black text-[#0b1220]">{secondDriver.phone || '—'}</strong>
                  </div>
                </Card>
              )}

              {/* Largeurs libres : l'adresse reçoit toute la place que le téléphone et l'email laissent */}
              <div className="col-span-12 rounded-lg border border-[#c7d4f3] bg-[#f1f5fd] px-2.5 py-1 flex items-center gap-3 text-[10px] text-[#334155]">
                <div className="shrink-0 flex items-center gap-1.5">
                  <Phone className="w-3 h-3 shrink-0 text-[#1d4ed8]" />
                  <span className="whitespace-nowrap">
                    GSM : <strong className="font-mono font-black text-[#0b1220]">{client.phone || 'Non renseigné'}</strong>
                  </span>
                </div>
                <div className="shrink-0 max-w-[215px] flex items-start gap-1.5">
                  <Mail className="w-3 h-3 shrink-0 mt-px text-[#1d4ed8]" />
                  <span className="leading-tight break-all line-clamp-2">
                    Email : {client.email ? <strong className="font-black text-[#0b1220]">{client.email}</strong> : <em>Non renseigné</em>}
                  </span>
                </div>
                <div className="flex-1 min-w-0 flex items-start gap-1.5">
                  <MapPin className="w-3 h-3 shrink-0 mt-px text-[#1d4ed8]" />
                  <span className="leading-tight line-clamp-3">
                    Adresse : <strong className="font-black text-[#0b1220]">{client.address || 'Casablanca, Maroc'}</strong>
                  </span>
                </div>
              </div>
            </div>
          </Section>

          {/* 2. VÉHICULE & CONTRÔLE DE DÉPART */}
          <Section
            tone="amber"
            index="2"
            icon={<Car className="w-3 h-3" />}
            title="Véhicule & Contrôle de Départ"
            arabic="بيانات وحالة السيارة عند التسليم"
          >
            <div className="grid grid-cols-12 gap-1.5">
              <Card tone="amber" className="col-span-5 flex flex-col justify-between">
                <Label tone="amber">Marque &amp; Modèle / النوع</Label>
                <p className="text-[14.5px] font-black uppercase tracking-wide leading-tight text-[#0b1220] mt-0.5 line-clamp-2">
                  {vehicle.brand} {vehicle.model}
                </p>
                <div className="flex gap-1 mt-1 overflow-hidden">
                  {[vehicle.fuelType, vehicle.transmission, vehicle.color, vehicle.year ? String(vehicle.year) : undefined]
                    .filter(Boolean)
                    .map((tag) => (
                      <Tag key={tag} tone="amber">
                        {tag}
                      </Tag>
                    ))}
                </div>
              </Card>

              <div className="col-span-4 rounded-lg border-2 border-[#e5b94a] bg-[#fdf7e7] px-2 py-2 flex flex-col items-center justify-center text-center">
                <Label tone="amber">Immatriculation / رقم اللوحة</Label>
                <div className="mt-1 rounded border border-[#d4a017] bg-[#0b1220] px-3.5 py-0.5">
                  <p className="font-mono text-[15px] font-black tracking-widest leading-tight text-[#fcd34d]">{formatPlateFrench(vehicle.plate)}</p>
                </div>
                <span className="text-[7.5px] font-bold tracking-wide text-[#78350f] mt-1">Royaume du Maroc • تسجيل رسمي</span>
              </div>

              <Card tone="amber" className="col-span-3 flex flex-col justify-between">
                <Label tone="amber" className="block text-right">
                  KM au départ
                </Label>
                <p className="font-mono text-[15px] font-black leading-tight text-[#0b1220] text-right mt-0.5">
                  {contract.departureKm.toLocaleString('fr-FR')} <span className="text-[9px] font-bold text-[#64748b]">KM</span>
                </p>
                <FuelGauge value={departureFuel} />
              </Card>
            </div>

            <div className="mt-1.5 grid grid-cols-4 gap-1.5 text-[8.5px]">
              <InspectionItem label="Roue de secours" state={checklist?.spareWheel} okText="Présente" koText="Absente" />
              <InspectionItem label="Documents de bord" state={documentsOk} okText="Conformes" koText="Manquants" />
              <InspectionItem label="Triangle & gilet" state={safetyOk} okText="Présents" koText="Incomplet" />
              <InspectionItem label="Carrosserie" state={bodyOk} okText="Conforme" koText="Défauts signalés" boxes={['OK', 'Défauts']} />
            </div>
            {departureNotes && (
              <div className="mt-1.5 rounded-md border border-[#ecd08a] bg-[#fdf7e7] px-2 py-1 text-[8.5px] leading-snug text-[#1e293b] line-clamp-2">
                <strong className="font-black uppercase text-[8px] text-[#78350f]">Observations au départ :</strong> {departureNotes}
              </div>
            )}
          </Section>

          {/* 3. DURÉE DE LA LOCATION */}
          <Section
            tone="emerald"
            index="3"
            icon={<Calendar className="w-3 h-3" />}
            title="Durée de la Location, Caution & Garanties"
            arabic="مدة الكراء والضمانة والتأمين"
          >
            <div className="grid grid-cols-3 gap-1.5 mb-1.5">
              {(
                [
                  ['Sortie / Départ', 'تاريخ الخروج', formattedStartDate, contract.startTime, '#047857'],
                  ['Restitution / Retour', 'تاريخ الدخول', formattedEndDate, contract.endTime, '#b45309'],
                ] as const
              ).map(([label, arabic, date, time, color]) => (
                <div key={label} className="rounded-lg bg-[#ffffff] border border-[#dbe2ea] border-t-[3px] px-2 py-2" style={{ borderTopColor: color }}>
                  <div className="flex items-center justify-between text-[9px] font-black" style={{ color }}>
                    <span className="uppercase tracking-[0.05em] flex items-center gap-1">
                      <Calendar className="w-2.5 h-2.5" /> {label}
                    </span>
                    <span>{arabic}</span>
                  </div>
                  <div className="text-[14.5px] font-black leading-tight text-[#0b1220] mt-0.5">{date}</div>
                  <div className="flex items-center gap-1 mt-0.5 text-[9.5px] text-[#475569]">
                    <Clock className="w-2.5 h-2.5 shrink-0" style={{ color }} />
                    <span>
                      Heure : <strong className="font-mono font-black text-[#0b1220]">{time}</strong>
                      <span className="text-[#64748b]"> · Nouaceur / Casablanca</span>
                    </span>
                  </div>
                </div>
              ))}

              <div className="rounded-lg bg-[#ffffff] border border-[#dbe2ea] border-t-[3px] border-t-[#0369a1] px-2 py-2">
                <div className="flex items-center justify-between text-[9px] font-black text-[#075985]">
                  <span className="uppercase tracking-[0.05em] flex items-center gap-1">
                    <Shield className="w-2.5 h-2.5" /> Prolongation
                  </span>
                  <span>التمديد</span>
                </div>
                {contract.prolongation?.isActive ? (
                  <>
                    <div className="text-[14.5px] font-black leading-tight text-[#0b1220] mt-0.5">
                      {new Date(contract.prolongation.newEndDate).toLocaleDateString('fr-FR')}
                    </div>
                    <div className="mt-0.5 text-[9.5px] text-[#475569]">
                      Heure accordée : <strong className="font-mono font-black text-[#0b1220]">{contract.prolongation.newEndTime}</strong>
                      <span className="font-black text-[#075985]"> · Validée</span>
                    </div>
                  </>
                ) : (
                  <p className="mt-1 text-[9.5px] leading-snug text-[#475569]">
                    Aucun accord de prolongation actif.
                    <br />
                    Préavis de 24 h obligatoire.
                  </p>
                )}
              </div>
            </div>

            {/* Récapitulatif : durée, kilométrage, caution et assurance (aucun tarif : les prix restent internes) */}
            <div className="grid grid-cols-4 gap-1.5 text-center">
              <div className="rounded-lg border border-[#c7d4f3] bg-[#f1f5fd] px-1.5 py-2 flex flex-col justify-center">
                <span className="block text-[9px] font-black uppercase text-[#1e3a8a]">Durée totale</span>
                <span className="block text-[14.5px] font-black leading-tight text-[#0b1220] mt-0.5">{contract.totalDays} jour(s)</span>
              </div>
              <div className="rounded-lg border border-[#b9e3d3] bg-[#eefaf5] px-1.5 py-2 flex flex-col justify-center">
                <span className="block text-[9px] font-black uppercase text-[#065f46]">Kilométrage</span>
                <span className="block text-[14.5px] font-black leading-tight text-[#0b1220] mt-0.5">Illimité (Maroc)</span>
                <span className="block text-[8.5px] text-[#065f46] mt-0.5">Carburant restitué à l'identique</span>
              </div>
              <div className="rounded-lg border border-[#ecd08a] bg-[#fdf7e7] px-1.5 py-2 flex flex-col justify-center">
                <span className="block text-[9px] font-black uppercase text-[#78350f]">Caution / الضمانة</span>
                <span className="block font-mono text-[14.5px] font-black leading-tight text-[#0b1220] mt-0.5">
                  {depositAmount > 0 ? `${depositAmount.toLocaleString('fr-FR')} MAD` : 'Aucun dépôt'}
                </span>
                <span className="block text-[8.5px] text-[#78350f] mt-0.5 truncate">
                  {depositAmount === 0 && contract.insurance?.depositMad === 0 ? `Inclus dans le ${insurance.packLabel}` : depositLine}
                </span>
                <DepositStatusTag contract={contract} className="text-[7.5px] mt-0.5 self-center" />
              </div>
              <div className="rounded-lg border border-[#0b1638] bg-[#0b1220] px-1.5 py-2 flex flex-col justify-center">
                <span className="block text-[9px] font-black uppercase text-[#fcd34d]">Couverture assurance</span>
                <span className="block text-[13.5px] font-black leading-tight text-[#ffffff] mt-0.5">{insurance.packLabel}</span>
                <span className="block text-[8.5px] leading-tight text-balance text-[#cbd5e1] mt-0.5">Franchise : {formatFranchise(insurance)}</span>
              </div>
            </div>
          </Section>

          {/* 4. SIGNATURES */}
          <Section
            tone="slate"
            strong
            index="4"
            icon={<Shield className="w-3 h-3" />}
            title="Signatures — « Lu et approuvé »"
            arabic="توقيعات الأطراف مسبوقة بعبارة قرئ وصودق عليه"
          >
            <div className={`grid ${signatureCols} gap-2`}>
              <div className="relative rounded-xl border-2 border-[#e5b94a] bg-[#fefbf1] p-1.5 flex flex-col justify-between min-h-[150px]">
                <div className="relative z-10 rounded-md border border-[#ecd08a] bg-[#fbecc4] px-2 py-0.5 text-center text-[9.5px] font-black uppercase text-[#78350f]">
                  Pour Sté {companySettings.name} • خاتم الوكالة
                </div>
                <div className="relative z-0 flex-1 flex items-center justify-center py-1">
                  <CompanyStamp size={secondDriver ? 'sm' : 'md'} rotation={-1.5} />
                  {contract.agencySignature && (
                    <img src={contract.agencySignature} alt="Signature Agence" className="absolute z-10 max-h-[50px] max-w-[130px] object-contain" />
                  )}
                </div>
                <div className="relative z-10 text-center text-[8.5px] font-bold text-[#334155]">
                  {contract.agencySignedBy
                    ? `Signé par ${contract.agencySignedBy}`
                    : displayManagerName
                    ? `Responsable : ${displayManagerName}`
                    : 'Visa & cachet légal agence'}
                </div>
              </div>

              <div className="rounded-xl border-2 border-[#9db2e6] bg-[#f6f8fe] p-1.5 flex flex-col justify-between min-h-[150px]">
                <div className="rounded-md border border-[#c7d4f3] bg-[#dfe7fb] px-2 py-0.5 text-center text-[9.5px] font-black uppercase text-[#1e3a8a]">
                  Le Locataire • توقيع المكتري
                </div>
                <div className="flex-1 flex flex-col items-center justify-center py-1">
                  {contract.clientSignature ? (
                    <img src={contract.clientSignature} alt="Signature locataire" className="max-h-[50px] max-w-[170px] object-contain" />
                  ) : (
                    <>
                      <span className="text-[8.5px] italic text-[#64748b]">Mention manuscrite obligatoire :</span>
                      <span className="text-[9.5px] font-bold italic text-[#334155]">« Lu et approuvé, bon pour accord »</span>
                    </>
                  )}
                </div>
                <div className="text-center font-mono leading-tight">
                  <span className="block truncate text-[8.5px] font-black text-[#0b1220]">{contract.clientSignedName || clientFullName}</span>
                  {contract.clientSignedAt && (
                    <span className="block text-[7.5px] text-[#047857]">
                      ✓ Signé le {new Date(contract.clientSignedAt).toLocaleDateString('fr-FR')} à{' '}
                      {new Date(contract.clientSignedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                  {contract.clientSignedAt && contract.signatureCertId && (
                    <span className="block truncate text-[7.5px] text-[#047857]">Réf. {contract.signatureCertId}</span>
                  )}
                </div>
              </div>

              {secondDriver && (
                <div className="rounded-xl border-2 border-[#9db2e6] bg-[#f6f8fe] p-1.5 flex flex-col justify-between min-h-[150px]">
                  <div className="rounded-md border border-[#c7d4f3] bg-[#dfe7fb] px-2 py-0.5 text-center text-[9.5px] font-black uppercase text-[#1e3a8a]">
                    2ème Conducteur • السائق الإضافي
                  </div>
                  <div className="flex-1 flex flex-col items-center justify-center py-1">
                    {contract.secondDriverSignature ? (
                      <img src={contract.secondDriverSignature} alt="Signature 2e conducteur" className="max-h-[50px] max-w-[170px] object-contain" />
                    ) : (
                      <span className="text-[9.5px] font-bold italic text-[#334155]">« Lu et approuvé »</span>
                    )}
                  </div>
                  <div className="text-center truncate font-mono text-[8.5px] font-black text-[#0b1220]">
                    {secondDriver.lastName.toUpperCase()} {secondDriver.firstName}
                  </div>
                </div>
              )}
            </div>
          </Section>
        </div>

        {/* PIED DE PAGE 1 */}
        <div className="mt-1.5 pt-1.5 border-t-2 border-[#0b1220] text-center text-[8.5px] leading-tight text-[#334155]">
          <div>
            <strong className="font-black uppercase tracking-wider text-[#0b1220]">{companySettings.name}</strong> • SARL au Capital de 100 000 MAD
            {legalIds.map(([label, value]) => (
              <span key={label}>
                {' '}
                • {label} : <strong className="font-black text-[#0b1220]">{value}</strong>
              </span>
            ))}
            {companySettings.address && !companySettings.address.includes('ANNAKHIL') ? (
              <span className="text-[#475569]"> • Siège : {companySettings.address}</span>
            ) : null}
          </div>
          <div className="mt-0.5 text-[#475569]">
            Tél : <strong className="font-black text-[#0b1220]">{activePhone}</strong> • Assistance :{' '}
            <strong className="font-mono font-black text-[#0b1220]">{assistancePhone}</strong>
            {contactItems.map((item) => (
              <span key={item}> • {item}</span>
            ))}
          </div>
          <div className="mt-1 pt-1 border-t border-[#dbe2ea] flex items-center justify-between font-mono text-[8px] text-[#475569]">
            <span>
              Contrat N° <strong className="font-black text-[#0b1220]">{contract.contractNumber}</strong>
            </span>
            <span className="rounded border border-[#cbd5e1] bg-[#f1f5f9] px-2.5 py-0.5 font-black text-[#0b1220]">Page 1 / 2 (Recto)</span>
            <span>Conditions Générales au verso</span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* PAGE 2 : CONDITIONS GÉNÉRALES DE LOCATION (VERSO)                         */}
      {/* ========================================================================= */}
      <div id={page2Id} className="a4-page contract-a4-page flex flex-col justify-between text-[#0b1220] border border-[#cbd5e1] print:border-none">
        <div className="flex flex-col">
          <div className="flex items-center justify-between gap-4">
            <CompanyLogo size="xs" customHeight={46} variant="raw-image" className="h-[46px] w-auto max-w-[150px]" />
            <div className="flex flex-col items-end">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-black uppercase tracking-[0.18em] text-[#0b1220]">Conditions générales de location</span>
                <span className="text-[#cbd5e1]">|</span>
                <span className="text-[10.5px] font-bold text-[#b45309]">شروط الكراء العامة</span>
              </div>
              <div className="mt-0.5 text-[8px] text-[#64748b]">
                Réf. juridique V{termsVersion.version} <span className="text-[#cbd5e1]">•</span>{' '}
                <span className="font-bold text-[#334155]">Verso contractuel officiel indissociable du recto</span>
              </div>
            </div>
          </div>
          <div className="mt-1.5 h-[2px] rounded-full" style={{ backgroundImage: HEADER_RULE }} />

          {/* Rappel du contrat */}
          <div
            className="mt-1.5 rounded-md px-2.5 py-1 flex items-center justify-between gap-2 text-[8.5px] text-[#cbd5e1]"
            style={{ backgroundImage: DARK_BAND }}
          >
            <span className="whitespace-nowrap">
              Contrat N° <strong className="font-mono font-black text-[#fcd34d]">{contract.contractNumber}</strong>
            </span>
            <span className="truncate border-l border-[#475569] pl-2">
              Locataire : <strong className="font-black text-[#ffffff]">{clientFullName}</strong>
            </span>
            <span className="truncate border-l border-[#475569] pl-2">
              Véhicule :{' '}
              <strong className="font-black text-[#ffffff]">
                {vehicle.brand} {vehicle.model}
              </strong>{' '}
              ({formatPlateFrench(vehicle.plate)})
            </span>
            <span className="whitespace-nowrap border-l border-[#475569] pl-2">
              Du <strong className="font-mono font-black text-[#ffffff]">{formattedStartDate}</strong> au{' '}
              <strong className="font-mono font-black text-[#ffffff]">{formattedEndDate}</strong>
            </span>
          </div>

          {/* Articles en deux colonnes de longueur voisine */}
          <div
            className="mt-2 grid grid-cols-2 gap-x-4 text-[#1e293b]"
            style={{ fontSize: `${termsFontSize}px`, lineHeight: TERMS_LINE_HEIGHT }}
          >
            {clauseColumns.map((clauses, colIdx) => (
              <div key={colIdx}>
                {clauses.map((clause) => (
                  <div key={clause.number} className="mb-[0.55em] pb-[0.3em] border-b border-[#e2e8f0]">
                    <div className="flex items-center gap-[0.5em] mb-[0.15em]">
                      <span className="shrink-0 rounded bg-[#172554] px-[0.6em] font-mono text-[0.78em] font-black leading-[1.6] text-[#fcd34d]">
                        Art. {clause.number}
                      </span>
                      <span className="text-[0.96em] font-black uppercase tracking-tight text-[#0b1220]">{clause.title}</span>
                    </div>
                    <p className="text-justify">{clause.content}</p>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-1 pt-1.5 border-t-2 border-[#0b1220] space-y-1.5">
          {/* Frais particuliers */}
          <div className="grid grid-cols-7 gap-1 text-[8px]">
            {(
              [
                ['Franchise sinistre', formatFranchise(insurance), 'col-span-2 bg-[#f1f5f9] border-[#cbd5e1]'],
                ['Retard restitution', 'Tarif/j + 50 %', 'bg-[#fdf7e7] border-[#ecd08a]'],
                ['Frais de dossier PV', '150 DH / infraction', 'bg-[#f1f5fd] border-[#c7d4f3]'],
                ['Écart de carburant', 'Pompe + 100 DH', 'bg-[#eefaf5] border-[#b9e3d3]'],
                ['Nettoyage spécial', '250 à 500 DH', 'bg-[#f6f3fd] border-[#d9cff5]'],
                ['Perte clés / papiers', 'Facture constructeur', 'bg-[#fef2f2] border-[#fecaca]'],
              ] as const
            ).map(([label, value, tone]) => (
              <div key={label} className={`rounded border px-1.5 py-1 leading-tight ${tone}`}>
                <span className="block text-[7.5px] font-bold uppercase text-[#475569]">{label}</span>
                <strong className="block font-black text-[#0b1220]">{value}</strong>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-1 text-[8px] leading-tight text-[#334155]">
            <div className="rounded border border-[#c7d4f3] bg-[#f1f5fd] px-1.5 py-1">
              <span className="block text-[7.5px] font-black uppercase text-[#1e3a8a]">1. Sécurité &amp; code de la route</span>
              Ceinture obligatoire, zéro alcool, respect des radars (Loi 52-05).
            </div>
            <div className="rounded border border-[#ecd08a] bg-[#fdf7e7] px-1.5 py-1">
              <span className="block text-[7.5px] font-black uppercase text-[#78350f]">2. Pistes &amp; territoire</span>
              Voies goudronnées uniquement. Pistes non carrossables et plages interdites.
            </div>
            <div className="rounded border border-[#b9e3d3] bg-[#eefaf5] px-1.5 py-1">
              <span className="block text-[7.5px] font-black uppercase text-[#065f46]">3. Sinistre &amp; déclaration</span>
              Constat ou PV de police obligatoire sous 24 h ouvrées. Avis immédiat à l'agence.
            </div>
          </div>

          <div className="rounded border border-[#a7f3d0] bg-[#ecfdf5] px-2 py-1 flex items-start gap-1.5 text-[8px] leading-tight text-[#1e293b]">
            <CheckCircle2 className="w-3 h-3 shrink-0 mt-px text-[#059669]" />
            <p>
              <strong className="font-black uppercase text-[#064e3b]">Attestation d'adhésion sans réserve : </strong>
              le locataire et les conducteurs agréés attestent avoir pris connaissance des {termsVersion.clauses.length} articles des
              conditions générales de la Sté {companySettings.name} (contrat n°{' '}
              <strong className="font-mono font-black text-[#0b1220]">{contract.contractNumber}</strong>), en approuver toutes les clauses et
              confirmer l'exactitude des déclarations du recto.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-lg border-2 border-[#9db2e6] bg-[#f6f8fe] p-1.5 flex flex-col justify-between min-h-[78px]">
              <div className="flex items-center justify-between border-b border-[#c7d4f3] pb-0.5">
                <span className="text-[8.5px] font-black uppercase text-[#1e3a8a]">Paraphe &amp; signature du locataire</span>
                <span className="text-[8.5px] font-bold text-[#1e3a8a]">توقيع ومصادقة المكتري</span>
              </div>
              <div className="flex-1 flex items-center justify-center py-0.5">
                {contract.clientSignature ? (
                  <img src={contract.clientSignature} alt="Paraphe électronique" className="max-h-[34px] max-w-[140px] object-contain" />
                ) : (
                  <span className="text-[8.5px] font-bold italic text-[#334155]">« Lu et approuvé, bon pour accord »</span>
                )}
              </div>
              <div className="border-t border-dashed border-[#cbd5e1] pt-0.5 text-center font-mono text-[8px] font-bold text-[#334155]">{clientFullName}</div>
            </div>

            <div className="relative overflow-hidden rounded-lg border-2 border-[#e5b94a] bg-[#fefbf1] p-1.5 flex flex-col justify-between min-h-[78px]">
              <div className="relative z-10 flex items-center justify-between border-b border-[#ecd08a] pb-0.5">
                <span className="text-[8.5px] font-black uppercase text-[#78350f]">Pour Sté {companySettings.name}</span>
                <span className="text-[8.5px] font-bold text-[#78350f]">خاتم وتأشيرة الوكالة</span>
              </div>
              <div className="relative z-0 flex-1 flex items-center justify-center py-0.5">
                <CompanyStamp size="xs" rotation={-1.5} />
              </div>
              <div className="relative z-10 border-t border-[#ecd08a] pt-0.5 text-center text-[8px] font-bold text-[#334155]">
                Visa légal agence • Fait à Casablanca, le {formattedStartDate}
              </div>
            </div>
          </div>

          <div className="pt-0.5 border-t border-[#dbe2ea] flex items-center justify-between font-mono text-[8px] text-[#475569]">
            <span>
              Réf. Contrat : <strong className="font-black text-[#0b1220]">{contract.contractNumber}</strong>
            </span>
            <span>Document contractuel officiel recto-verso — opposable aux tiers</span>
            <span className="rounded border border-[#cbd5e1] bg-[#f1f5f9] px-2 font-black text-[#0b1220]">Page 2 / 2 (Verso)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
