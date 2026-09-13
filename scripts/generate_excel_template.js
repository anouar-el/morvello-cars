import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

// Define the template data with clear, realistic examples for Morocco rental agency
const headers = [
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
  'Date_Fin_Assurance',
  'Date_Fin_Controle_Tech',
  'Vignette_Annee',
  'Prochaine_Vidange_KM',
  'Date_Achat',
  'Observations_Notes'
];

const data = [
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
    'Boîte automatique EDC, caméra de recul, CarPlay'
  ],
  [
    'RENAULT',
    'Clio 5 1.5 dCi Intens',
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
    'Très économique, révision 40k faite'
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
    'SUV familial tout confort'
  ],
  [
    'VOLKSWAGEN',
    'Golf 8 R-Line 2.0 TDI',
    '77219 | H | 6',
    'Diesel',
    'available',
    31200,
    550,
    2024,
    'Blanc Pur',
    'Abdelkader Ouahib',
    'RMA Watanya',
    '2027-01-10',
    '2026-08-28',
    2026,
    40000,
    '2024-03-20',
    'Cockpit digital, régulateur adaptatif'
  ],
  [
    'PEUGEOT',
    '208 Allure 1.2 PureTech',
    '44510 | B | 6',
    'Essence',
    'available',
    28900,
    320,
    2023,
    'Jaune Faro',
    'Abdelkader Ouahib',
    'AXA Assurance Maroc',
    '2026-12-05',
    '2026-10-25',
    2026,
    30000,
    '2023-08-14',
    'Citadine idéale trajets urbains'
  ],
  [
    'DACIA',
    'Duster Prestige 1.5 dCi',
    '63201 | J | 6',
    'Diesel',
    'available',
    64100,
    400,
    2023,
    'Orange Arizona',
    'Mohamed Ezzay',
    'Wafa Assurance',
    '2027-04-12',
    '2027-03-20',
    2026,
    75000,
    '2023-04-05',
    'Grand coffre, barres de toit'
  ],
  [
    'MERCEDES-BENZ',
    'Classe C 220d AMG Line',
    '99014 | A | 6',
    'Diesel',
    'available',
    48900,
    1100,
    2024,
    'Gris Sélénite',
    'Larbi Khomri',
    'AtlantaSanad',
    '2026-10-15',
    '2026-11-05',
    2026,
    50000,
    '2024-02-01',
    'Gamme Prestige VIP'
  ]
];

// Guide sheet instructions
const instructionsData = [
  ['GUIDE D’UTILISATION DU FICHIER MODÈLE D’IMPORTATION MORVELLO'],
  [''],
  ['Colonne', 'Description', 'Valeurs acceptées / Exemples', 'Obligatoire ?'],
  ['Marque', 'Marque du véhicule constructeur', 'RENAULT, PEUGEOT, HYUNDAI, DACIA, etc.', 'OUI'],
  ['Modèle', 'Modèle et finition', 'Kardian 1.0 TCe, Clio 5, Tucson, etc.', 'OUI'],
  ['Immatriculation', 'Plaque d’immatriculation marocaine', '54210 | A | 6 ou format standard', 'OUI (ou auto-généré)'],
  ['Carburant', 'Type d’énergie / motorisation', 'Diesel, Essence, Hybride, Électrique', 'OUI'],
  ['Statut', 'État initial du véhicule', 'available (disponible), rented (loué), maintenance (atelier)', 'Optionnel (défaut: available)'],
  ['Kilométrage', 'Kilométrage compteur actuel', 'Nombre entier (ex: 12500)', 'OUI'],
  ['Tarif_Journalier_MAD', 'Prix de location par jour en Dirhams', 'Nombre entier (ex: 450)', 'OUI'],
  ['Année', 'Année de mise en circulation', 'Ex: 2024, 2025', 'Optionnel'],
  ['Couleur', 'Couleur de la carrosserie', 'Blanc, Noir, Gris Titanium, Orange Énergie...', 'Optionnel'],
  ['Responsable', 'Manager attitré au véhicule', 'Anouar, Said Khomri, Abdelkader Ouahib, Mohamed Ezzay, Larbi Khomri', 'Optionnel'],
  ['Compagnie_Assurance', 'Assureur', 'Wafa Assurance, RMA, Sanlam, AXA, AtlantaSanad...', 'Optionnel'],
  ['Date_Fin_Assurance', 'Date d’échéance police d’assurance', 'Format YYYY-MM-DD (ex: 2027-06-30)', 'Optionnel'],
  ['Date_Fin_Controle_Tech', 'Date d’échéance de la visite technique', 'Format YYYY-MM-DD (ex: 2028-05-15)', 'Optionnel'],
  ['Vignette_Annee', 'Dernière année de vignette fiscale payée', 'Ex: 2026', 'Optionnel'],
  ['Prochaine_Vidange_KM', 'Kilométrage prévu pour la prochaine vidange', 'Ex: 20000', 'Optionnel'],
  ['Date_Achat', 'Date d’acquisition du véhicule', 'Format YYYY-MM-DD (ex: 2025-01-15)', 'Optionnel'],
  ['Observations_Notes', 'Remarques, équipements ou historique', 'Texte libre', 'Optionnel'],
  [''],
  ['NOTE IMPORTANTE', 'Vous pouvez remplir directement l’onglet « Véhicules » puis déposer ce fichier .xlsx ou .csv dans l’application pour intégrer tout votre parc en un clic.']
];

const wb = XLSX.utils.book_new();

// Sheet 1: Vehicles
const wsVehicles = XLSX.utils.aoa_to_sheet([headers, ...data]);

// Column widths for Vehicles
wsVehicles['!cols'] = [
  { wch: 16 }, // Marque
  { wch: 28 }, // Modèle
  { wch: 18 }, // Immatriculation
  { wch: 14 }, // Carburant
  { wch: 14 }, // Statut
  { wch: 14 }, // Kilométrage
  { wch: 22 }, // Tarif_Journalier_MAD
  { wch: 10 }, // Année
  { wch: 18 }, // Couleur
  { wch: 20 }, // Responsable
  { wch: 22 }, // Compagnie_Assurance
  { wch: 20 }, // Date_Fin_Assurance
  { wch: 22 }, // Date_Fin_Controle_Tech
  { wch: 16 }, // Vignette_Annee
  { wch: 22 }, // Prochaine_Vidange_KM
  { wch: 14 }, // Date_Achat
  { wch: 40 }  // Observations_Notes
];

XLSX.utils.book_append_sheet(wb, wsVehicles, 'Vehicules');

// Sheet 2: Instructions
const wsInstructions = XLSX.utils.aoa_to_sheet(instructionsData);
wsInstructions['!cols'] = [
  { wch: 26 },
  { wch: 42 },
  { wch: 50 },
  { wch: 24 }
];
XLSX.utils.book_append_sheet(wb, wsInstructions, 'Instructions');

// Ensure public dir exists
const publicDir = path.resolve('public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Write .xlsx file
const xlsxPath = path.join(publicDir, 'modele_import_vehicules_morvello.xlsx');
XLSX.writeFile(wb, xlsxPath);
console.log('Saved XLSX:', xlsxPath);

// Write .csv file (with UTF-8 BOM for immediate Excel compatibility)
const csvContent = '\uFEFF' + [headers.join(';'), ...data.map(row => row.map(v => typeof v === 'string' && (v.includes(';') || v.includes(',')) ? `"${v}"` : v).join(';'))].join('\n');
const csvPath = path.join(publicDir, 'modele_import_vehicules_morvello.csv');
fs.writeFileSync(csvPath, csvContent, 'utf-8');
console.log('Saved CSV:', csvPath);
