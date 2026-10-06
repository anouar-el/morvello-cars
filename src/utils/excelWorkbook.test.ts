import { describe, expect, it } from 'vitest';
import { Workbook } from 'exceljs';
import { buildXlsxFile, readXlsxSheetAsCsv } from './excelWorkbook';

const isFleetSheet = (name: string) => name.toLowerCase().includes('vehicule');

describe('excelWorkbook', () => {
  it('round-trips an exported sheet into the semicolon format the import parser reads', async () => {
    const file = await buildXlsxFile([
      { name: 'Instructions', rows: [['Guide'], ['Colonne', 'Description']] },
      {
        name: 'Vehicules',
        rows: [
          ['Marque', 'Modèle', 'Immatriculation', 'Kilométrage', 'Notes'],
          ['RENAULT', 'Clio 5 1.5 dCi', '84920 | A | 6', 42350, 'Révision 40 000 km faite'],
          ['HYUNDAI', 'Tucson', '19384 | D | 6', 58400, ''],
        ],
        columnWidths: [16, 28, 18, 14, 40],
      },
    ]);

    const sheet = await readXlsxSheetAsCsv(file, isFleetSheet);

    expect(sheet?.sheetName).toBe('Vehicules');
    expect(sheet?.csv.split('\n')).toEqual([
      'Marque;Modèle;Immatriculation;Kilométrage;Notes',
      'RENAULT;Clio 5 1.5 dCi;84920 | A | 6;42350;Révision 40 000 km faite',
      // An empty cell keeps its column, as the parser reads fields by position
      'HYUNDAI;Tucson;19384 | D | 6;58400;',
    ]);
  });

  it('falls back to the first sheet when none matches', async () => {
    const file = await buildXlsxFile([{ name: 'Feuil1', rows: [['Marque', 'Modèle'], ['DACIA', 'Logan']] }]);

    const sheet = await readXlsxSheetAsCsv(file, isFleetSheet);

    expect(sheet).toEqual({ sheetName: 'Feuil1', csv: 'Marque;Modèle\nDACIA;Logan' });
  });

  it('normalises dates, formulas, blank rows and separator characters typed in Excel', async () => {
    const workbook = new Workbook();
    const worksheet = workbook.addWorksheet('Flotte');
    worksheet.addRow(['Marque', 'Expiration_Assurance', 'Tarif', 'Notes']);
    worksheet.addRow([]);
    worksheet.addRow([
      'DACIA',
      new Date(Date.UTC(2027, 5, 30)),
      { formula: '200+150', result: 350 },
      'Options: GPS; siège bébé\n2e ligne',
    ]);
    const file = (await workbook.xlsx.writeBuffer()) as ArrayBuffer;

    const sheet = await readXlsxSheetAsCsv(file, (name) => name.toLowerCase().includes('flotte'));

    expect(sheet?.csv.split('\n')).toEqual([
      'Marque;Expiration_Assurance;Tarif;Notes',
      'DACIA;2027-06-30;350;"Options: GPS; siège bébé 2e ligne"',
    ]);
  });
});
