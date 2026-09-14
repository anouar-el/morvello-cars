import React, { useState } from 'react';
import { User, Vehicle, FuelType } from '../../types';
import { formatPlateFrench } from '../../utils/plateUtils';
import * as XLSX from 'xlsx';
import {
  FileSpreadsheet,
  Download,
  Layers,
  AlertTriangle,
  CheckCircle2,
  X,
} from 'lucide-react';

interface VehicleImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddVehicle: (vehicle: Omit<Vehicle, 'id'>) => void;
  users: User[];
  onToast: (msg: string) => void;
}

export const VehicleImportModal: React.FC<VehicleImportModalProps> = ({
  isOpen,
  onClose,
  onAddVehicle,
  users,
  onToast,
}) => {
  const [importText, setImportText] = useState<string>('');
  const [importError, setImportError] = useState<string | null>(null);

  if (!isOpen) return null;

  const downloadExcelTemplate = () => {
    try {
      const templateHeaders = [
        'Marque',
        'Modèle',
        'Immatriculation',
        'Carburant',
        'Statut',
        'Kilométrage',
        'Tarif_Journalier_MAD',
        'Année',
        'Couleur',
        'Responsable',
        'Compagnie_Assurance',
        'Expiration_Assurance',
        'Expiration_Controle_Tech',
        'Vignette_Payee_Annee',
        'Prochaine_Vidange_KM',
        'Date_Achat',
        'Notes',
      ];

      const templateRows = [
        [
          'RENAULT',
          'Kardian 1.0 TCe EDC Techno',
          '54210 | A | 6',
          'Essence',
          'available',
          12500,
          450,
          2025,
          'Orange Énergie',
          'Anouar',
          'Wafa Assurance',
          '2027-06-30',
          '2028-05-15',
          2026,
          20000,
          '2025-01-15',
          'Véhicule neuf, boîte automatique EDC',
        ],
        [
          'RENAULT',
          'Clio 5 1.5 dCi',
          '84920 | A | 6',
          'Diesel',
          'available',
          42350,
          350,
          2024,
          'Gris Titanium',
          'Said Khomri',
          'Wafa Assurance',
          '2026-11-20',
          '2026-12-15',
          2026,
          50000,
          '2024-03-10',
          'Révision 40 000 km faite',
        ],
        [
          'HYUNDAI',
          'Tucson 1.6 CRDi DCT',
          '19384 | D | 6',
          'Diesel',
          'available',
          58400,
          650,
          2024,
          'Noir Fantôme',
          'Said Khomri',
          'Sanlam Maroc',
          '2026-09-18',
          '2026-11-30',
          2026,
          65000,
          '2024-01-15',
          'SUV familial tout confort',
        ],
      ];

      const wb = XLSX.utils.book_new();
      const wsVehicles = XLSX.utils.aoa_to_sheet([templateHeaders, ...templateRows]);
      wsVehicles['!cols'] = [
        { wch: 16 },
        { wch: 28 },
        { wch: 18 },
        { wch: 14 },
        { wch: 14 },
        { wch: 14 },
        { wch: 22 },
        { wch: 10 },
        { wch: 18 },
        { wch: 20 },
        { wch: 22 },
        { wch: 20 },
        { wch: 22 },
        { wch: 16 },
        { wch: 22 },
        { wch: 14 },
        { wch: 40 },
      ];
      XLSX.utils.book_append_sheet(wb, wsVehicles, 'Vehicules');

      const instructions = [
        ['GUIDE D UTILISATION DU MODELE D IMPORTATION MORVELLO'],
        [''],
        ['Colonne', 'Description', 'Exemples', 'Obligatoire'],
        ['Marque', 'Marque constructeur', 'RENAULT, DACIA, HYUNDAI...', 'OUI'],
        ['Modèle', 'Modèle et finition', 'Kardian 1.0 TCe, Clio 5...', 'OUI'],
        ['Immatriculation', 'Immatriculation marocaine', '54210 | A | 6', 'OUI'],
        ['Carburant', 'Type d énergie', 'Diesel, Essence, Hybride, Électrique', 'OUI'],
        ['Statut', 'État du véhicule', 'available, rented, maintenance', 'Optionnel'],
        ['Kilométrage', 'Kilométrage actuel', '12500', 'OUI'],
        ['Tarif_Journalier_MAD', 'Prix par jour en Dirhams', '450', 'OUI'],
        ['Année', 'Année de mise en circulation', '2025', 'Optionnel'],
        ['Couleur', 'Couleur extérieure', 'Orange Énergie, Gris...', 'Optionnel'],
        ['Responsable', 'Gestionnaire assigné', 'Anouar, Said Khomri...', 'Optionnel'],
        ['Compagnie_Assurance', 'Assureur marocain', 'Wafa Assurance, RMA...', 'Optionnel'],
        ['Expiration_Assurance', 'Date fin assurance (AAAA-MM-JJ)', '2027-06-30', 'Optionnel'],
        ['Expiration_Controle_Tech', 'Date fin contrôle technique', '2028-05-15', 'Optionnel'],
        ['Vignette_Payee_Annee', 'Année dernière vignette payée', '2026', 'Optionnel'],
        ['Prochaine_Vidange_KM', 'Kilométrage prochaine vidange', '20000', 'Optionnel'],
        ['Date_Achat', 'Date acquisition (AAAA-MM-JJ)', '2025-01-15', 'Optionnel'],
        ['Notes', 'Commentaires et options', 'Texte libre', 'Optionnel'],
      ];
      const wsInst = XLSX.utils.aoa_to_sheet(instructions);
      wsInst['!cols'] = [{ wch: 26 }, { wch: 36 }, { wch: 36 }, { wch: 14 }];
      XLSX.utils.book_append_sheet(wb, wsInst, 'Instructions');

      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([wbout], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'modele_import_vehicules_morvello.xlsx';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      onToast('Modèle Excel (.xlsx) généré et téléchargé avec succès.');
    } catch {
      downloadCsvTemplate();
    }
  };

  const downloadCsvTemplate = () => {
    const csvContent =
      '\uFEFF' +
      [
        'Marque;Modèle;Immatriculation;Carburant;Statut;Kilométrage;Tarif_Journalier_MAD;Année;Couleur;Responsable;Compagnie_Assurance;Expiration_Assurance;Expiration_Controle_Tech;Vignette_Payee_Annee;Prochaine_Vidange_KM;Date_Achat;Notes',
        'RENAULT;Kardian 1.0 TCe EDC Techno;54210 | A | 6;Essence;available;12500;450;2025;Orange Énergie;Anouar;Wafa Assurance;2027-06-30;2028-05-15;2026;20000;2025-01-15;Nouveau Renault Kardian',
        'RENAULT;Clio 5 1.5 dCi;84920 | A | 6;Diesel;available;42350;350;2024;Gris Titanium;Said Khomri;Wafa Assurance;2026-11-20;2026-12-15;2026;50000;2024-03-10;Parc réel Morvello',
        'HYUNDAI;Tucson 1.6 CRDi DCT;19384 | D | 6;Diesel;available;58400;650;2024;Noir Fantôme;Said Khomri;Sanlam Maroc;2026-09-18;2026-11-30;2026;65000;2024-01-15;SUV premium',
      ].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'modele_import_vehicules_morvello.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    onToast('Modèle CSV (compatible 100% Excel) téléchargé avec succès.');
  };

  const loadMorvelloTemplate = () => {
    const template = `Marque;Modèle;Immatriculation;Carburant;Statut;Kilométrage;Tarif_Journalier;Année;Couleur;Responsable;Compagnie_Assurance;Expiration_Assurance;Expiration_Controle_Tech;Vignette_Payee_Annee;Prochaine_Vidange_KM;Date_Achat;Notes
RENAULT;Kardian 1.0 TCe EDC Techno;54210 | A | 6;Essence;available;12500;450;2025;Orange Énergie;Anouar;Wafa Assurance;2027-06-30;2028-05-15;2026;20000;2025-01-15;Nouveau Renault Kardian
RENAULT;Clio 5 1.5 dCi;84920 | A | 6;Diesel;available;42350;350;2024;Gris Titanium;Said Khomri;Wafa Assurance;2026-11-20;2026-12-15;2026;50000;2024-03-10;Parc réel Morvello
HYUNDAI;Tucson 1.6 CRDi DCT;19384 | D | 6;Diesel;available;58400;650;2024;Noir Fantôme;Said Khomri;Sanlam Maroc;2026-09-18;2026-11-30;2026;65000;2024-01-15;SUV premium`;
    setImportText(template);
    setImportError(null);
  };

  const handleFileUpload = async (file: File) => {
    setImportError(null);
    const fileName = file.name.toLowerCase();

    if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      try {
        const buffer = await file.arrayBuffer();
        const wb = XLSX.read(buffer, { type: 'array' });
        const targetSheetName =
          wb.SheetNames.find(
            (name) =>
              name.toLowerCase().includes('vehicule') ||
              name.toLowerCase().includes('véhicule') ||
              name.toLowerCase().includes('flotte')
          ) || wb.SheetNames[0];

        const sheet = wb.Sheets[targetSheetName];
        if (!sheet) {
          setImportError('Aucune feuille exploitable trouvée dans le classeur Excel.');
          return;
        }

        const csvString = XLSX.utils.sheet_to_csv(sheet, { FS: ';' });
        setImportText(csvString);
        onToast(`Feuille Excel "${targetSheetName}" analysée avec succès.`);
      } catch (err) {
        setImportError(
          `Impossible de lire le fichier Excel : ${err instanceof Error ? err.message : 'Format corrompu'}`
        );
      }
    } else {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        if (content) {
          setImportText(content);
          onToast(`Fichier texte/CSV "${file.name}" chargé.`);
        }
      };
      reader.readAsText(file, 'UTF-8');
    }
  };

  const handleProcessImportCSV = () => {
    if (!importText.trim()) {
      setImportError('Veuillez sélectionner un fichier Excel / CSV ou coller des lignes de données.');
      return;
    }

    try {
      const lines = importText
        .trim()
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

      if (lines.length === 0) {
        setImportError('Aucune ligne détectée dans le fichier.');
        return;
      }

      let startIndex = 0;
      const firstLineLower = lines[0].toLowerCase();
      if (
        firstLineLower.includes('marque') ||
        firstLineLower.includes('brand') ||
        firstLineLower.includes('immat') ||
        firstLineLower.includes('modele') ||
        firstLineLower.includes('model')
      ) {
        startIndex = 1;
      }

      let importedCount = 0;
      const separator = lines[0].includes(';') ? ';' : lines[0].includes('\t') ? '\t' : ',';

      for (let i = startIndex; i < lines.length; i++) {
        const line = lines[i];
        if (!line) continue;

        const cols = line
          .split(separator)
          .map((c) => c.replace(/^["']|["']$/g, '').trim());

        if (cols.length < 2) continue;

        const brand = cols[0] || 'Véhicule';
        const model = cols[1] || '';
        const plate = cols[2] ? formatPlateFrench(cols[2]) : `100${i} | A | 6`;
        const fuelTypeRaw = (cols[3] || 'Diesel').toLowerCase();
        const fuelType: FuelType = fuelTypeRaw.includes('ess')
          ? 'Essence'
          : fuelTypeRaw.includes('hyb')
          ? 'Hybride'
          : fuelTypeRaw.includes('elec')
          ? 'Électrique'
          : 'Diesel';
        const currentKm = parseInt(cols[5] || '0', 10) || 30000;
        const dailyRate = parseInt(cols[6] || '400', 10) || 400;
        const year = parseInt(cols[7] || '2024', 10) || 2024;
        const color = cols[8] || 'Blanc';
        const managerName = cols[9] || '';
        const matchedManager = users.find((u) => u.name.toLowerCase() === managerName.toLowerCase());

        onAddVehicle({
          brand,
          model,
          plate,
          fuelType,
          status: 'available',
          currentKm,
          dailyRate,
          year,
          color,
          assignedManagerId: matchedManager ? matchedManager.id : undefined,
          assignedManagerName: matchedManager ? matchedManager.name : managerName || undefined,
          insuranceCompany: cols[10] || 'Wafa Assurance',
          insuranceExpiryDate: cols[11] || '',
          technicalInspectionExpiryDate: cols[12] || '',
          vignettePaidYear: parseInt(cols[13] || '2026', 10) || 2026,
          nextOilChangeKm: parseInt(cols[14] || '0', 10) || currentKm + 10000,
          purchaseDate: cols[15] || '',
          notes: cols[16] || 'Importé dans le parc réel Morvello',
          approvalStatus: 'approved',
        });
        importedCount++;
      }

      if (importedCount === 0) {
        setImportError('Aucun véhicule valide n’a pu être extrait. Vérifiez le format des colonnes.');
        return;
      }

      onToast(`${importedCount} véhicule(s) importé(s) avec succès dans le parc Morvello !`);
      onClose();
      setImportText('');
      setImportError(null);
    } catch (err) {
      setImportError(`Erreur d'analyse : ${err instanceof Error ? err.message : 'Format invalide'}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-150 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 my-8">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30 shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Importation du Parc Automobile (Excel / CSV)</h3>
              <p className="text-xs text-slate-400">Intégrez votre flotte en masse via le modèle Excel officiel ou fichier CSV</p>
            </div>
          </div>
          <button
            onClick={() => {
              onClose();
              setImportError(null);
            }}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3.5">
          {/* BANDEAU MODÈLES OFFICIELS TÉLÉCHARGEABLES */}
          <div className="bg-gradient-to-r from-emerald-950/70 via-slate-900 to-slate-900 border border-emerald-500/40 p-4 rounded-2xl shadow-lg space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30 shrink-0">
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-emerald-300">Fichier Modèle Officiel Morvello</div>
                  <div className="text-[11px] text-slate-300">
                    Téléchargez le gabarit type pré-rempli pour préparer votre liste de véhicules
                  </div>
                </div>
              </div>
              <span className="text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30 shrink-0">
                Format Garanti
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
              <button
                type="button"
                onClick={downloadExcelTemplate}
                className="flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-700/30 transition-all cursor-pointer active:scale-95"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Modèle Excel (.xlsx)</span>
              </button>

              <button
                type="button"
                onClick={downloadCsvTemplate}
                className="flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-slate-400" />
                <span>Modèle CSV (.csv)</span>
              </button>

              <button
                type="button"
                onClick={loadMorvelloTemplate}
                className="flex items-center justify-center gap-1.5 px-3 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Exemple direct</span>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              1. Charger un fichier Excel (.xlsx, .xls) ou CSV (.csv, .txt) :
            </label>
            <input
              type="file"
              accept=".xlsx,.xls,.csv,.txt"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  handleFileUpload(file);
                }
              }}
              className="w-full text-xs text-slate-400 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-500 cursor-pointer bg-slate-950 p-2 rounded-xl border border-slate-800"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              2. Aperçu des données à importer (éditable ou coller directement) :
            </label>
            <textarea
              rows={6}
              value={importText}
              onChange={(e) => {
                setImportText(e.target.value);
                setImportError(null);
              }}
              placeholder="Marque;Modèle;Immatriculation;Carburant;Statut;Kilométrage;Tarif_Journalier;Année;Couleur;Responsable;..."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white font-mono text-xs focus:border-emerald-500 focus:outline-none placeholder-slate-600"
            />
          </div>

          {importError && (
            <div className="bg-rose-950/60 border border-rose-500/60 rounded-xl p-3 flex items-start gap-2.5 text-xs text-rose-200">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{importError}</span>
            </div>
          )}

          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 text-[11px] text-slate-400 space-y-1">
            <div className="font-semibold text-slate-300">Colonnes reconnues dans le fichier Excel :</div>
            <div>Marque • Modèle • Immatriculation • Carburant (Diesel/Essence/Hybride) • Statut • Kilométrage • Tarif Journalier (MAD) • Année • Couleur • Nom du Responsable • Compagnie Assurance • Expiration Assurance • Expiration Visite Technique • Vignette Fiscale</div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={() => {
              onClose();
              setImportError(null);
            }}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleProcessImportCSV}
            className="flex items-center gap-1.5 px-5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-blue-600/30 transition-all cursor-pointer active:scale-95"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Valider et importer dans le parc
          </button>
        </div>
      </div>
    </div>
  );
};
