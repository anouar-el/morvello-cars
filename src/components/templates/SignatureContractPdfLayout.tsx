import React from 'react';
import { Contract, CompanySettings, TermsVersion } from '../../types';
import { Phone, Mail, MapPin, ShieldCheck, Clock, ArrowRight } from 'lucide-react';
import { CompanyStamp } from '../CompanyStamp';
import { CompanyLogo } from '../CompanyLogo';
import { formatPlateFrench } from '../../utils/plateUtils';

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

// Solid colours only: the light theme forces white text inside any `bg-gradient-*` element of a contract page.
const INK = 'bg-[#0b1b33]';

/** Section title: numbered label, hairline rule, Arabic subtitle. */
const SectionTitle: React.FC<{ index: string; title: string; arabic: string }> = ({ index, title, arabic }) => (
  <div className="flex items-center gap-2 mb-1.5">
    <span className="font-mono text-[9px] font-black text-amber-600">{index}</span>
    <h2 className="text-[9.5px] font-black uppercase tracking-[0.16em] text-[#0b1b33] shrink-0">{title}</h2>
    <div className="h-px flex-1 bg-slate-300" />
    <span className="font-arabic text-[9px] font-bold text-slate-500 shrink-0">{arabic}</span>
  </div>
);

/** Form-style labelled cell. */
const Field: React.FC<{ label: string; value?: React.ReactNode; mono?: boolean; className?: string }> = ({
  label,
  value,
  mono,
  className = '',
}) => (
  <div className={`border border-slate-200 rounded-md px-2 py-1.5 bg-white ${className}`}>
    <div className="text-[6.8px] font-bold uppercase tracking-wider text-slate-500">{label}</div>
    <div className={`text-[10.5px] font-bold text-slate-950 leading-tight mt-0.5 truncate ${mono ? 'font-mono' : ''}`}>
      {value !== undefined && value !== null && value !== '' ? value : <span className="text-slate-300 font-normal">—</span>}
    </div>
  </div>
);

/** Checkbox reflecting the recorded departure inspection; left blank (to tick by hand) when nothing was recorded. */
const CheckItem: React.FC<{ label: string; state: boolean | undefined }> = ({ label, state }) => (
  <div className="flex items-center gap-1.5 text-[8px] text-slate-800">
    <span
      className={`w-3 h-3 rounded-[3px] border flex items-center justify-center text-[8px] font-black leading-none shrink-0 ${
        state === true
          ? 'bg-[#0b1b33] border-[#0b1b33] text-white'
          : state === false
          ? 'border-rose-500 text-rose-600'
          : 'border-slate-400'
      }`}
    >
      {state === true ? '✓' : state === false ? '✕' : ''}
    </span>
    <span>{label}</span>
  </div>
);

/** Eight-segment fuel gauge parsed from values such as "6/8" or "8/8 (Plein)". */
const FuelGauge: React.FC<{ value?: string }> = ({ value }) => {
  const match = value?.match(/(\d)\s*\/\s*8/);
  const level = match ? Math.min(8, Math.max(0, Number(match[1]))) : undefined;
  return (
    <div>
      <div className="flex gap-[2px]">
        {Array.from({ length: 8 }).map((_, i) => (
          <span
            key={i}
            className={`h-2 flex-1 rounded-[1px] border ${
              level !== undefined && i < level ? 'bg-amber-500 border-amber-500' : 'bg-white border-slate-300'
            }`}
          />
        ))}
      </div>
      <div className="flex justify-between text-[6px] font-mono text-slate-400 mt-0.5">
        <span>E</span>
        <span className="font-bold text-slate-800">{level !== undefined ? `${level}/8` : value || 'À relever'}</span>
        <span>F</span>
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

  const legalIds = (
    <>
      <span>IF <strong className="text-slate-950">{companySettings.taxId}</strong></span>
      <span className="text-slate-300">·</span>
      <span>RC <strong className="text-slate-950">{companySettings.rc}</strong></span>
      <span className="text-slate-300">·</span>
      <span>ICE <strong className="text-slate-950">{companySettings.ice}</strong></span>
      <span className="text-slate-300">·</span>
      <span>Patente <strong className="text-slate-950">{companySettings.patente || '35894120'}</strong></span>
    </>
  );

  return (
    <div
      className={`pdf-document-root flex ${
        layout === 'side-by-side' ? 'flex-col xl:flex-row' : 'flex-col'
      } items-center gap-8 print:!flex-col print:!gap-0`}
    >
      {/* ========================================================================= */}
      {/* PAGE 1 : CONTRAT (RECTO)                                                  */}
      {/* ========================================================================= */}
      <div
        id={page1Id}
        className="a4-page contract-a4-page flex flex-col justify-between text-slate-900 border border-slate-300 print:border-none bg-white relative overflow-hidden"
      >
        {/* Filet d'accent vertical */}
        <div className="absolute top-0 left-0 bottom-0 w-[3px] bg-amber-500" />

        <div className="flex flex-col gap-4">
          {/* EN-TÊTE */}
          <header>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <CompanyLogo size="md" customHeight={60} variant="raw-image" className="h-[60px] w-auto max-w-[150px]" />
                <div className="border-l border-slate-200 pl-3 leading-tight">
                  <div className="text-[10px] font-black uppercase tracking-wide text-[#0b1b33]">{companySettings.name}</div>
                  <div className="text-[7px] text-slate-500 mt-0.5">SARL au Capital de 100 000 MAD</div>
                  <div className="text-[7px] text-slate-600 mt-1 flex items-center gap-1">
                    <Phone className="w-2.5 h-2.5 text-amber-600" />
                    <span>
                      Agence <strong className="font-mono text-slate-950">{activePhone}</strong>
                      {displayManagerName ? <span className="text-slate-500"> · {displayManagerName}</span> : null}
                    </span>
                  </div>
                  <div className="text-[7px] text-slate-600 flex items-center gap-1">
                    <ShieldCheck className="w-2.5 h-2.5 text-amber-600" />
                    <span>
                      Assistance 24/7 <strong className="font-mono text-slate-950">{assistancePhone}</strong>
                    </span>
                  </div>
                </div>
              </div>

              <div className="text-right">
                <div className="flex items-baseline justify-end gap-2">
                  <span className="text-[13px] font-black uppercase tracking-[0.18em] text-[#0b1b33]">Contrat de location</span>
                </div>
                <div className="font-arabic text-[10px] font-bold text-slate-500 -mt-0.5">عقد كراء سيارة</div>
                <div className="mt-1.5 inline-flex items-stretch rounded-md overflow-hidden border border-[#0b1b33]">
                  <span className={`${INK} text-white text-[7px] font-bold uppercase tracking-widest px-2 flex items-center`}>N°</span>
                  <span className="font-mono text-[15px] font-black tracking-widest text-[#0b1b33] px-2.5 py-0.5 bg-white">
                    {contract.contractNumber}
                  </span>
                </div>
                <div className="text-[7px] font-mono text-slate-500 mt-1">
                  Émis le <strong className="text-slate-900">{formattedCreatedAt}</strong> · Original
                </div>
              </div>
            </div>

            <div className="mt-2 flex items-center justify-between border-y border-slate-200 py-1 text-[7px] font-mono text-slate-600">
              <div className="flex items-center gap-1.5">{legalIds}</div>
              <span className="text-slate-500">Conditions générales au verso · V{termsVersion.version}</span>
            </div>
          </header>

          {/* 01 — LOCATAIRE */}
          <section>
            <SectionTitle
              index="01"
              title={secondDriver ? 'Locataire & conducteur additionnel' : 'Locataire / Conducteur'}
              arabic={secondDriver ? 'المكتري والسائق الإضافي' : 'المكتري / السائق'}
            />
            <div className="grid grid-cols-12 gap-1.5">
              <Field className="col-span-5" label="Nom & prénom / الإسم الكامل" value={clientFullName} />
              <Field className="col-span-3" label="Date de naissance" value={client.birthDate} />
              <Field className="col-span-4" label="Nationalité" value={client.country || 'Maroc'} />
              <Field className="col-span-4" label={`${client.docType} N° / رقم الهوية`} value={client.docNumber} mono />
              <Field className="col-span-4" label="Permis de conduire / رخصة السياقة" value={client.drivingLicense} mono />
              <Field className="col-span-4" label="Téléphone" value={client.phone} mono />
              <Field
                className="col-span-7"
                label="Adresse"
                value={
                  <span className="flex items-center gap-1">
                    <MapPin className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                    <span className="truncate">{client.address || 'Casablanca, Maroc'}</span>
                  </span>
                }
              />
              <Field
                className="col-span-5"
                label="E-mail"
                value={
                  client.email ? (
                    <span className="flex items-center gap-1">
                      <Mail className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                      <span className="truncate">{client.email}</span>
                    </span>
                  ) : undefined
                }
              />
            </div>

            {secondDriver && (
              <div className="mt-1.5 grid grid-cols-12 gap-1.5 pl-2 border-l-2 border-amber-500">
                <Field
                  className="col-span-5"
                  label="Conducteur additionnel / السائق الإضافي"
                  value={`${secondDriver.lastName.toUpperCase()} ${secondDriver.firstName}`}
                />
                <Field className="col-span-3" label={`${secondDriver.docType} N°`} value={secondDriver.docNumber} mono />
                <Field className="col-span-2" label="Permis" value={secondDriver.drivingLicense} mono />
                <Field className="col-span-2" label="Téléphone" value={secondDriver.phone} mono />
              </div>
            )}
          </section>

          {/* 02 — VÉHICULE */}
          <section>
            <SectionTitle index="02" title="Véhicule" arabic="بيانات السيارة" />
            <div className="grid grid-cols-12 gap-1.5">
              <div className="col-span-5 border border-slate-200 rounded-md px-2 py-1.5 bg-white flex flex-col justify-between">
                <div className="text-[6.5px] font-bold uppercase tracking-wider text-slate-500">Marque & modèle / النوع</div>
                <div className="text-[12px] font-black uppercase text-[#0b1b33] leading-tight mt-0.5">
                  {vehicle.brand} {vehicle.model}
                </div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {[vehicle.fuelType, vehicle.transmission, vehicle.color, vehicle.year ? String(vehicle.year) : undefined]
                    .filter(Boolean)
                    .map((tag) => (
                      <span key={tag} className="text-[7px] font-semibold text-slate-700 bg-slate-100 border border-slate-200 rounded px-1.5">
                        {tag}
                      </span>
                    ))}
                </div>
              </div>

              <div className="col-span-3 border border-slate-200 rounded-md px-2 py-1.5 bg-white flex flex-col items-center justify-center">
                <div className="text-[6.5px] font-bold uppercase tracking-wider text-slate-500 self-start">Immatriculation</div>
                <div className="mt-1 border-2 border-[#0b1b33] rounded px-2.5 py-0.5 bg-white">
                  <span className="font-mono font-black text-[11px] tracking-widest text-[#0b1b33]">
                    {formatPlateFrench(vehicle.plate)}
                  </span>
                </div>
                <div className="text-[6px] text-slate-400 mt-0.5 font-arabic">المغرب</div>
              </div>

              <div className="col-span-4 border border-slate-200 rounded-md px-2 py-1.5 bg-white grid grid-cols-2 gap-2">
                <div>
                  <div className="text-[6.5px] font-bold uppercase tracking-wider text-slate-500">KM départ</div>
                  <div className="font-mono text-[12px] font-black text-[#0b1b33] mt-0.5">
                    {contract.departureKm.toLocaleString('fr-FR')}
                    <span className="text-[7px] font-normal text-slate-500 ml-0.5">km</span>
                  </div>
                </div>
                <div>
                  <div className="text-[6.5px] font-bold uppercase tracking-wider text-slate-500 mb-1">Carburant</div>
                  <FuelGauge value={departureFuel} />
                </div>
              </div>
            </div>
          </section>

          {/* 03 — PÉRIODE */}
          <section>
            <SectionTitle index="03" title="Période de location" arabic="مدة الكراء" />
            <div className="grid grid-cols-12 gap-1.5 items-stretch">
              <div className="col-span-4 border border-slate-200 rounded-md px-2 py-1.5 bg-white">
                <div className="text-[6.5px] font-bold uppercase tracking-wider text-slate-500">Départ / تاريخ الخروج</div>
                <div className="text-[12px] font-black text-[#0b1b33] mt-0.5">{formattedStartDate}</div>
                <div className="text-[7.5px] text-slate-600 flex items-center gap-1 mt-0.5">
                  <Clock className="w-2.5 h-2.5 text-amber-600" /> {contract.startTime} · Nouaceur / Casablanca
                </div>
              </div>

              <div className="col-span-4 flex flex-col items-center justify-center">
                <div className="flex items-center w-full gap-1">
                  <div className="h-px flex-1 bg-slate-300" />
                  <div className={`${INK} text-white rounded-full px-3 py-1 text-center`}>
                    <div className="text-[13px] font-black leading-none">{contract.totalDays}</div>
                    <div className="text-[6px] font-bold uppercase tracking-widest text-amber-300">Jour(s)</div>
                  </div>
                  <div className="h-px flex-1 bg-slate-300" />
                  <ArrowRight className="w-3 h-3 text-slate-400 -ml-1" />
                </div>
                <div className="text-[7px] text-slate-500 mt-1">Kilométrage illimité · Usage Maroc</div>
              </div>

              <div className="col-span-4 border border-slate-200 rounded-md px-2 py-1.5 bg-white text-right">
                <div className="text-[6.5px] font-bold uppercase tracking-wider text-slate-500">Retour / تاريخ الدخول</div>
                <div className="text-[12px] font-black text-[#0b1b33] mt-0.5">{formattedEndDate}</div>
                <div className="text-[7.5px] text-slate-600 flex items-center justify-end gap-1 mt-0.5">
                  <Clock className="w-2.5 h-2.5 text-amber-600" /> {contract.endTime} · Nouaceur / Casablanca
                </div>
              </div>
            </div>

            {contract.prolongation?.isActive ? (
              <div className="mt-1.5 text-[7.5px] border border-sky-200 bg-sky-50 text-sky-900 rounded-md px-2 py-1">
                <strong>Prolongation accordée</strong> jusqu'au{' '}
                <strong>{new Date(contract.prolongation.newEndDate).toLocaleDateString('fr-FR')}</strong> à{' '}
                <strong>{contract.prolongation.newEndTime}</strong>.
              </div>
            ) : (
              <div className="mt-1 text-[7px] text-slate-500">
                Toute prolongation doit être demandée à l'agence au moins 24h avant la date de retour.
              </div>
            )}
          </section>

          {/* 04 — GARANTIES (aucun tarif : les prix restent internes) */}
          <section>
            <SectionTitle index="04" title="Caution & garanties" arabic="الضمانة والتأمين" />
            <div className="grid grid-cols-3 gap-1.5">
              <div className="border border-slate-200 rounded-md px-2 py-1.5 bg-white">
                <div className="text-[6.5px] font-bold uppercase tracking-wider text-slate-500">Dépôt de garantie / الضمانة</div>
                <div className="font-mono text-[12px] font-black text-[#0b1b33] mt-0.5">
                  {depositAmount.toLocaleString('fr-FR')} <span className="text-[7px] font-normal text-slate-500">MAD</span>
                </div>
                <div className="text-[7px] text-slate-600 mt-0.5">
                  {depositMethod}
                  {contract.depositRecord?.methodDetails ? ` · ${contract.depositRecord.methodDetails}` : ''}
                </div>
              </div>
              <div className="border border-slate-200 rounded-md px-2 py-1.5 bg-white">
                <div className="text-[6.5px] font-bold uppercase tracking-wider text-slate-500">Couverture assurance</div>
                <div className="text-[10px] font-black text-[#0b1b33] mt-0.5">Tous Risques Sérénité</div>
                <div className="text-[7px] text-slate-600 mt-0.5">Franchise selon conditions générales</div>
              </div>
              <div className={`${INK} rounded-md px-2 py-1.5 text-white`}>
                <div className="text-[6.5px] font-bold uppercase tracking-wider text-amber-300">Assistance & dépannage 24/7</div>
                <div className="font-mono text-[10px] font-black mt-0.5">{assistancePhone}</div>
                <div className="text-[7px] text-slate-300 mt-0.5">Partout au Maroc, 24h/24 et 7j/7</div>
              </div>
            </div>
          </section>

          {/* 05 — ÉTAT AU DÉPART */}
          <section>
            <SectionTitle index="05" title="État du véhicule au départ" arabic="حالة السيارة عند التسليم" />
            <div className="grid grid-cols-12 gap-1.5">
              <div className="col-span-5 border border-slate-200 rounded-md px-2 py-1.5 bg-white grid grid-cols-2 gap-y-1 gap-x-2">
                <CheckItem label="Roue de secours" state={checklist?.spareWheel} />
                <CheckItem label="Cric" state={checklist?.jack} />
                <CheckItem label="Triangle" state={checklist?.triangle} />
                <CheckItem label="Gilet" state={checklist?.vest} />
                <CheckItem label="Documents de bord" state={checklist?.documentsPresent ?? checklist?.documents} />
                <CheckItem label="Carrosserie conforme" state={bodyOk} />
              </div>
              <div className="col-span-7 border border-slate-200 rounded-md px-2 py-1.5 bg-white flex flex-col">
                <div className="text-[6.5px] font-bold uppercase tracking-wider text-slate-500">Observations / ملاحظات</div>
                {departureNotes ? (
                  <p className="text-[8px] text-slate-800 mt-0.5 leading-snug line-clamp-3">{departureNotes}</p>
                ) : (
                  <div className="flex-1 flex flex-col justify-evenly mt-1">
                    <div className="border-b border-dotted border-slate-300 h-2" />
                    <div className="border-b border-dotted border-slate-300 h-2" />
                    <div className="border-b border-dotted border-slate-300 h-2" />
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* 06 — SIGNATURES */}
          <section>
            <SectionTitle index="06" title="Signatures — « Lu et approuvé »" arabic="التوقيعات" />
            <div className={`grid ${secondDriver ? 'grid-cols-3' : 'grid-cols-2'} gap-1.5`}>
              <div className="border border-slate-300 rounded-md p-1.5 flex flex-col min-h-[150px] bg-white">
                <div className="text-[7px] font-black uppercase tracking-wider text-[#0b1b33]">Pour {companySettings.name}</div>
                <div className="text-[6.5px] text-slate-500 font-arabic">خاتم وتوقيع الوكالة</div>
                <div className="relative flex-1 flex items-center justify-center">
                  <CompanyStamp size="sm" rotation={-1.5} />
                  {contract.agencySignature && (
                    <img src={contract.agencySignature} alt="Signature agence" className="absolute max-h-[46px] max-w-[130px] object-contain" />
                  )}
                </div>
                <div className="text-[6.5px] text-slate-500 border-t border-slate-200 pt-0.5">
                  {contract.agencySignedBy ? `Signé par ${contract.agencySignedBy}` : 'Cachet & visa agence'}
                </div>
              </div>

              <div className="border border-slate-300 rounded-md p-1.5 flex flex-col min-h-[150px] bg-white">
                <div className="text-[7px] font-black uppercase tracking-wider text-[#0b1b33]">Le locataire</div>
                <div className="text-[6.5px] text-slate-500 font-arabic">توقيع المكتري</div>
                <div className="flex-1 flex items-center justify-center">
                  {contract.clientSignature ? (
                    <img src={contract.clientSignature} alt="Signature locataire" className="max-h-[50px] max-w-[160px] object-contain" />
                  ) : (
                    <span className="text-[7px] italic text-slate-400">« Lu et approuvé, bon pour accord »</span>
                  )}
                </div>
                <div className="text-[6.5px] text-slate-500 border-t border-slate-200 pt-0.5 truncate">
                  {contract.clientSignedName || clientFullName}
                  {contract.clientSignedAt && (
                    <span className="text-emerald-700 font-mono">
                      {' '}
                      · ✓ {new Date(contract.clientSignedAt).toLocaleDateString('fr-FR')}{' '}
                      {new Date(contract.clientSignedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
              </div>

              {secondDriver && (
                <div className="border border-slate-300 rounded-md p-1.5 flex flex-col min-h-[150px] bg-white">
                  <div className="text-[7px] font-black uppercase tracking-wider text-[#0b1b33]">Conducteur additionnel</div>
                  <div className="text-[6.5px] text-slate-500 font-arabic">توقيع السائق الإضافي</div>
                  <div className="flex-1 flex items-center justify-center">
                    {contract.secondDriverSignature ? (
                      <img src={contract.secondDriverSignature} alt="Signature 2e conducteur" className="max-h-[50px] max-w-[160px] object-contain" />
                    ) : (
                      <span className="text-[7px] italic text-slate-400">« Lu et approuvé »</span>
                    )}
                  </div>
                  <div className="text-[6.5px] text-slate-500 border-t border-slate-200 pt-0.5 truncate">
                    {secondDriver.lastName.toUpperCase()} {secondDriver.firstName}
                  </div>
                </div>
              )}
            </div>
            {contract.signatureCertId && (
              <div className="text-[6.5px] font-mono text-emerald-700 mt-1">
                Signature électronique certifiée · Réf. {contract.signatureCertId}
              </div>
            )}
          </section>
        </div>

        {/* PIED DE PAGE 1 */}
        <footer className="border-t border-slate-300 pt-1.5 mt-2 flex items-center justify-between text-[6.5px] font-mono text-slate-500">
          <span>
            {companySettings.website} · {companySettings.email}
            {companySettings.address && !companySettings.address.includes('ANNAKHIL') ? ` · ${companySettings.address}` : ''}
          </span>
          <span className="font-bold text-slate-900">N° {contract.contractNumber} · Page 1 / 2</span>
        </footer>
      </div>

      {/* ========================================================================= */}
      {/* PAGE 2 : CONDITIONS GÉNÉRALES (VERSO)                                     */}
      {/* ========================================================================= */}
      <div
        id={page2Id}
        className="a4-page contract-a4-page flex flex-col justify-between text-slate-900 border border-slate-300 print:border-none bg-white relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 bottom-0 w-[3px] bg-amber-500" />

        <div className="flex flex-col">
          <header className="flex items-center justify-between gap-4 pb-1.5 border-b border-slate-300">
            <CompanyLogo size="xs" customHeight={40} variant="raw-image" className="h-[40px] w-auto max-w-[130px]" />
            <div className="text-right">
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#0b1b33]">Conditions générales de location</div>
              <div className="text-[7px] font-mono text-slate-500 flex items-center justify-end gap-1.5">
                <span className="font-arabic text-[9px] font-bold text-slate-500">شروط الكراء العامة</span>
                <span className="text-slate-300">·</span>
                <span>Version {termsVersion.version} · Indissociable du recto</span>
              </div>
            </div>
          </header>

          {/* Rappel du contrat */}
          <div className="mt-1.5 grid grid-cols-4 gap-1.5 text-[7px]">
            <div className="border border-slate-200 rounded px-1.5 py-0.5">
              <span className="text-slate-500 uppercase font-bold text-[6px] block">Contrat</span>
              <strong className="font-mono text-slate-950">{contract.contractNumber}</strong>
            </div>
            <div className="border border-slate-200 rounded px-1.5 py-0.5 truncate">
              <span className="text-slate-500 uppercase font-bold text-[6px] block">Locataire</span>
              <strong className="text-slate-950">{clientFullName}</strong>
            </div>
            <div className="border border-slate-200 rounded px-1.5 py-0.5 truncate">
              <span className="text-slate-500 uppercase font-bold text-[6px] block">Véhicule</span>
              <strong className="text-slate-950">
                {vehicle.brand} {vehicle.model} · <span className="font-mono">{formatPlateFrench(vehicle.plate)}</span>
              </strong>
            </div>
            <div className="border border-slate-200 rounded px-1.5 py-0.5">
              <span className="text-slate-500 uppercase font-bold text-[6px] block">Période</span>
              <strong className="text-slate-950">
                {formattedStartDate} → {formattedEndDate}
              </strong>
            </div>
          </div>

          {/* Articles en deux colonnes */}
          <div className="grid grid-cols-2 gap-x-5 mt-2.5 text-[8.7px] leading-[1.45] text-slate-800">
            {[col1Clauses, col2Clauses].map((clauses, colIdx) => (
              <div key={colIdx} className="space-y-1.5">
                {clauses.map((clause) => (
                  <div key={clause.number} className="pb-0.5 border-b border-slate-100">
                    <div className="flex items-baseline gap-1.5">
                      <span className="font-mono text-[7.8px] font-black text-amber-600 shrink-0">{String(clause.number).padStart(2, '0')}</span>
                      <span className="uppercase text-[8.2px] font-black tracking-wide text-[#0b1b33]">{clause.title}</span>
                    </div>
                    <p className="text-slate-700 text-justify leading-tight">{clause.content}</p>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-slate-300 pt-1.5 mt-1 space-y-1.5">
          {/* Frais particuliers */}
          <div>
            <div className="text-[6.5px] font-black uppercase tracking-[0.16em] text-[#0b1b33] mb-0.5">Frais particuliers</div>
            <div className="grid grid-cols-6 gap-1 text-[6.5px]">
              {[
                ['Franchise sinistre', 'Selon CGV'],
                ['Retard de restitution', 'Tarif/j + 50%'],
                ['Dossier PV', '150 DH / infr.'],
                ['Écart carburant', 'Pompe + 100 DH'],
                ['Nettoyage spécial', '250 à 500 DH'],
                ['Perte clés / documents', 'Facture constr.'],
              ].map(([label, value]) => (
                <div key={label} className="border border-slate-200 rounded px-1 py-0.5">
                  <span className="block text-[5.5px] uppercase font-bold text-slate-500">{label}</span>
                  <strong className="text-slate-950 font-mono">{value}</strong>
                </div>
              ))}
            </div>
          </div>

          {/* Attestation */}
          <p className="text-[6.8px] text-slate-700 leading-snug border-l-2 border-amber-500 pl-1.5">
            Le locataire et, le cas échéant, le conducteur additionnel reconnaissent avoir pris connaissance des{' '}
            {termsVersion.clauses.length} articles des présentes conditions générales (contrat n°{' '}
            <strong className="font-mono text-slate-950">{contract.contractNumber}</strong>), les accepter sans réserve et
            certifient l'exactitude des informations portées au recto.
          </p>

          {/* Paraphes */}
          <div className="grid grid-cols-2 gap-1.5">
            <div className="border border-slate-300 rounded-md p-1.5 flex flex-col min-h-[80px]">
              <div className="flex justify-between text-[6.5px] font-black uppercase text-[#0b1b33]">
                <span>Paraphe du locataire</span>
                <span className="font-arabic text-slate-500">توقيع المكتري</span>
              </div>
              <div className="flex-1 flex items-center justify-center">
                {contract.clientSignature ? (
                  <img src={contract.clientSignature} alt="Paraphe" className="max-h-[32px] max-w-[130px] object-contain" />
                ) : (
                  <span className="text-[6.5px] italic text-slate-400">« Lu et approuvé »</span>
                )}
              </div>
            </div>
            <div className="border border-slate-300 rounded-md p-1.5 flex flex-col min-h-[80px] relative overflow-hidden">
              <div className="flex justify-between text-[6.5px] font-black uppercase text-[#0b1b33]">
                <span>Pour {companySettings.name}</span>
                <span className="font-arabic text-slate-500">خاتم الوكالة</span>
              </div>
              <div className="flex-1 flex items-center justify-center">
                <CompanyStamp size="xs" rotation={-1.5} />
              </div>
              <div className="text-[6px] text-slate-500 text-center">Fait à Casablanca, le {formattedStartDate}</div>
            </div>
          </div>

          <footer className="flex items-center justify-between text-[6.5px] font-mono text-slate-500 border-t border-slate-200 pt-1">
            <span className="flex items-center gap-1.5">{legalIds}</span>
            <span className="font-bold text-slate-900">N° {contract.contractNumber} · Page 2 / 2</span>
          </footer>
        </div>
      </div>
    </div>
  );
};
