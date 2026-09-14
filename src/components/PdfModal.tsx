import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { ContractPdfDocument } from './ContractPdfDocument';
import { getContractTemplate } from '../data/contractTemplates';
import {
  Printer,
  Download,
  X,
  FileCheck,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Columns,
  Square,
  AlertCircle,
  Loader2,
  CheckCircle,
  Edit3,
} from 'lucide-react';

export const PdfModal: React.FC = () => {
  const {
    isPdfModalOpen,
    pdfModalContract,
    closePdfModal,
    companySettings,
    termsVersion,
    addAuditLog,
    startEditingContract,
  } = useApp();

  const [zoom, setZoom] = useState<number>(85);
  const [viewLayout, setViewLayout] = useState<'stacked' | 'side-by-side'>('stacked');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);
  const [generationStep, setGenerationStep] = useState<string>('');
  const [downloadSuccess, setDownloadSuccess] = useState<boolean>(false);

  if (!isPdfModalOpen || !pdfModalContract) {
    return null;
  }

  const handlePrint = () => {
    addAuditLog(
      'Impression contrat papier',
      'contract',
      pdfModalContract.contractNumber,
      `Lancement de l'impression 2 pages A4 pour le contrat ${pdfModalContract.contractNumber}`
    );
    window.print();
  };

  const handleDownloadPdf = async () => {
    if (!pdfModalContract || isGeneratingPdf) return;

    try {
      setIsGeneratingPdf(true);
      setGenerationStep('Initialisation du document A4...');

      addAuditLog(
        'Téléchargement PDF',
        'contract',
        pdfModalContract.contractNumber,
        `Génération et téléchargement du fichier ${pdfModalContract.contractNumber}.pdf`
      );

      // Brief pause to ensure DOM paint
      await new Promise((r) => setTimeout(r, 150));

      const page1Element =
        document.getElementById('export-contract-pdf-page-1') ||
        document.getElementById('preview-contract-pdf-page-1');
      const page2Element =
        document.getElementById('export-contract-pdf-page-2') ||
        document.getElementById('preview-contract-pdf-page-2');

      if (!page1Element || !page2Element) {
        throw new Error('Les pages du document sont introuvables.');
      }

      setGenerationStep('Chargement du moteur PDF haute précision...');
      const [{ default: jsPDF }, { toJpeg }] = await Promise.all([
        import('jspdf'),
        import('html-to-image'),
      ]);

      setGenerationStep('Capture haute résolution Page 1 (Recto)...');
      const img1 = await toJpeg(page1Element, {
        quality: 0.95,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        cacheBust: true,
      });

      setGenerationStep('Capture haute résolution Page 2 (Verso)...');
      const img2 = await toJpeg(page2Element, {
        quality: 0.95,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        cacheBust: true,
      });

      setGenerationStep('Création du fichier PDF...');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true,
      });

      // Add Page 1
      pdf.addImage(img1, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');

      // Add Page 2
      pdf.addPage('a4', 'portrait');
      pdf.addImage(img2, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');

      setGenerationStep('Téléchargement...');
      const cleanFilename = `Contrat_${pdfModalContract.contractNumber.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
      pdf.save(cleanFilename);

      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 3500);
    } catch (error) {
      console.error('Erreur de téléchargement PDF:', error);
      // Fallback to browser print dialog
      window.print();
    } finally {
      setIsGeneratingPdf(false);
      setGenerationStep('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/90 backdrop-blur-md overflow-hidden animate-in fade-in duration-200">
      {/* TOP TOOLBAR (NO-PRINT) */}
      <header className="no-print bg-slate-900 border-b border-slate-800 px-6 py-3 flex items-center justify-between shadow-xl flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <FileCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white tracking-wide">
                Générateur de Contrat A4 — {pdfModalContract.contractNumber}
              </h2>
              <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                2 Pages A4 Exactes
              </span>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                pdfModalContract.templateId === 'prestige'
                  ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                  : pdfModalContract.templateId === 'corporate'
                  ? 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                  : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
              }`}>
                Modèle : {getContractTemplate(pdfModalContract.templateId || companySettings.defaultContractTemplate).name}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Client : {pdfModalContract.clientSnapshot.lastName} {pdfModalContract.clientSnapshot.firstName} • {pdfModalContract.vehicleSnapshot.brand} {pdfModalContract.vehicleSnapshot.model}
            </p>
          </div>
        </div>

        {/* CONTROLS */}
        <div className="flex items-center gap-3">
          {/* Zoom Controls */}
          <div className="flex items-center bg-slate-800 border border-slate-700 rounded-lg p-1 text-slate-300 text-xs">
            <button
              onClick={() => setZoom((prev) => Math.max(50, prev - 10))}
              className="p-1.5 hover:bg-slate-700 rounded transition-colors"
              title="Dézoomer"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="px-2 font-mono text-slate-200 font-semibold">{zoom}%</span>
            <button
              onClick={() => setZoom((prev) => Math.min(130, prev + 10))}
              className="p-1.5 hover:bg-slate-700 rounded transition-colors"
              title="Zoomer"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={() => setZoom(85)}
              className="p-1.5 hover:bg-slate-700 rounded transition-colors ml-1 border-l border-slate-700"
              title="Ajuster à l'écran"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Layout Toggle */}
          <div className="flex items-center bg-slate-800 border border-slate-700 rounded-lg p-1 text-slate-300 text-xs">
            <button
              onClick={() => setViewLayout('stacked')}
              className={`px-2.5 py-1 rounded flex items-center gap-1.5 transition-colors ${
                viewLayout === 'stacked'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'hover:bg-slate-700'
              }`}
            >
              <Square className="w-3.5 h-3.5" />
              Vertical
            </button>
            <button
              onClick={() => setViewLayout('side-by-side')}
              className={`px-2.5 py-1 rounded flex items-center gap-1.5 transition-colors ${
                viewLayout === 'side-by-side'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'hover:bg-slate-700'
              }`}
            >
              <Columns className="w-3.5 h-3.5" />
              Côte à côte
            </button>
          </div>

          {/* Action: Modifier */}
          {(pdfModalContract.status === 'active' || pdfModalContract.status === 'draft') && (
            <button
              onClick={() => {
                closePdfModal();
                startEditingContract(pdfModalContract);
              }}
              className="flex items-center gap-1.5 bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 hover:text-white border border-blue-500/40 font-medium text-xs px-3 py-2 rounded-lg transition-colors cursor-pointer"
              title="Modifier ce contrat"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Modifier</span>
            </button>
          )}

          {/* Action: Print */}
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs px-4 py-2 rounded-lg shadow-lg shadow-amber-500/20 transition-all active:scale-95 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            Imprimer Contrat (A4)
          </button>

          {/* Action: Download PDF */}
          <button
            onClick={handleDownloadPdf}
            disabled={isGeneratingPdf}
            className={`flex items-center gap-2 font-medium text-xs px-3.5 py-2 rounded-lg transition-all cursor-pointer ${
              downloadSuccess
                ? 'bg-emerald-600 text-white border border-emerald-500'
                : isGeneratingPdf
                ? 'bg-slate-800 text-slate-400 border border-slate-700 cursor-not-allowed'
                : 'bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white'
            }`}
          >
            {isGeneratingPdf ? (
              <>
                <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
                <span>Génération PDF...</span>
              </>
            ) : downloadSuccess ? (
              <>
                <CheckCircle className="w-4 h-4 text-emerald-300" />
                <span>PDF Téléchargé !</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4 text-amber-400" />
                <span>Télécharger PDF</span>
              </>
            )}
          </button>

          {/* Close */}
          <button
            onClick={closePdfModal}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            title="Fermer la prévisualisation"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* NOTICE BANNER */}
      <div className="no-print bg-slate-900/90 border-b border-slate-800/80 px-6 py-2 flex items-center justify-between text-xs text-slate-300">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-400" />
          <span>
            {isGeneratingPdf ? (
              <strong className="text-amber-400">{generationStep}</strong>
            ) : (
              <span>
                <strong>Règle contractuelle Morvello Cars :</strong> Le document imprimé doit être signé manuellement sur papier par le locataire et l'agent.
              </span>
            )}
          </span>
        </div>
        <div className="text-[11px] text-slate-400">
          Format d'exportation : <strong>210 × 297 mm (A4 Portrait)</strong> • Conditions v{termsVersion.version}
        </div>
      </div>

      {/* DOCUMENT PREVIEW CONTAINER */}
      <div className="flex-1 overflow-auto p-8 bg-slate-950 flex justify-center items-start">
        <div
          style={{
            transform: `scale(${zoom / 100})`,
            transformOrigin: 'top center',
            transition: 'transform 0.15s ease-out',
          }}
        >
          <ContractPdfDocument
            contract={pdfModalContract}
            companySettings={companySettings}
            termsVersion={termsVersion}
            layout={viewLayout}
            idPrefix="preview"
          />
        </div>
      </div>

      {/* HIDDEN 1:1 EXPORT SOURCE FOR CRISP RENDERING */}
      <div
        id="export-pdf-source"
        className="fixed top-0 left-[-9999px] pointer-events-none opacity-100 z-[-100]"
        style={{ width: '210mm' }}
      >
        <ContractPdfDocument
          contract={pdfModalContract}
          companySettings={companySettings}
          termsVersion={termsVersion}
          layout="stacked"
          idPrefix="export"
          showPageIndicator={true}
        />
      </div>

      {/* PRINT CONTAINER (ALWAYS IN DOM FOR WINDOW.PRINT) */}
      <div id="printable-contract-container" className="hidden print:block">
        <ContractPdfDocument
          contract={pdfModalContract}
          companySettings={companySettings}
          termsVersion={termsVersion}
          showPageIndicator={true}
          idPrefix="print"
        />
      </div>
    </div>
  );
};
