import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { ContractPdfDocument } from './ContractPdfDocument';
import { DigitalSignatureModal } from './DigitalSignatureModal';
import { getContractTemplate } from '../data/contractTemplates';
import {
  downloadContractPdf,
  openContractPdfInNewTab,
} from '../utils/contractPdfGenerator';
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
  Loader2,
  CheckCircle,
  Edit3,
  PenTool,
  ShieldCheck,
  ExternalLink,
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
    updateContract,
  } = useApp();

  // Adaptive initial zoom for mobile and small screens
  const [zoom, setZoom] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      if (window.innerWidth < 640) return 45;
      if (window.innerWidth < 1024) return 65;
    }
    return 85;
  });
  const [viewLayout, setViewLayout] = useState<'stacked' | 'side-by-side'>('stacked');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);
  const [generationStep, setGenerationStep] = useState<string>('');
  const [generationPercent, setGenerationPercent] = useState<number>(0);
  const [downloadSuccess, setDownloadSuccess] = useState<boolean>(false);
  const [lastGeneratedBlobUrl, setLastGeneratedBlobUrl] = useState<string | null>(null);
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState<boolean>(false);

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
      setGenerationStep('Démarrage de la génération PDF A4...');
      setGenerationPercent(10);

      addAuditLog(
        'Téléchargement PDF',
        'contract',
        pdfModalContract.contractNumber,
        `Génération et téléchargement du fichier Contrat_${pdfModalContract.contractNumber}.pdf`
      );

      const result = await downloadContractPdf(pdfModalContract, {
        idPrefix: 'export',
        onProgress: (step, percent) => {
          setGenerationStep(step);
          if (percent !== undefined) setGenerationPercent(percent);
        },
      });

      setLastGeneratedBlobUrl(result.blobUrl);
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 6000);
    } catch (error) {
      console.error('Erreur de téléchargement PDF:', error);
      // Option de repli vers l'impression papier
      if (confirm('La génération directe du PDF a rencontré un obstacle dans votre navigateur. Souhaitez-vous lancer l\'impression A4 intégrée ?')) {
        window.print();
      }
    } finally {
      setIsGeneratingPdf(false);
      setGenerationStep('');
      setGenerationPercent(0);
    }
  };

  const handleOpenPdfInNewTab = async () => {
    if (!pdfModalContract || isGeneratingPdf) return;

    try {
      setIsGeneratingPdf(true);
      setGenerationStep('Génération de l\'aperçu PDF...');
      setGenerationPercent(15);

      const result = await openContractPdfInNewTab(pdfModalContract, {
        idPrefix: 'export',
        onProgress: (step, percent) => {
          setGenerationStep(step);
          if (percent !== undefined) setGenerationPercent(percent);
        },
      });

      setLastGeneratedBlobUrl(result.blobUrl);
    } catch (error) {
      console.error('Erreur ouverture PDF:', error);
      alert('Impossible d\'ouvrir le PDF. Veuillez autoriser les fenêtres pop-up pour cette application.');
    } finally {
      setIsGeneratingPdf(false);
      setGenerationStep('');
      setGenerationPercent(0);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/90 backdrop-blur-md overflow-hidden animate-in fade-in duration-200">
      {/* TOP TOOLBAR (NO-PRINT) */}
      <header className="no-print bg-slate-900 border-b border-slate-800 px-3 sm:px-6 py-2.5 sm:py-3 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xl flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <FileCheck className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <h2 className="text-xs sm:text-sm font-bold text-white tracking-wide">
                  Contrat N° {pdfModalContract.contractNumber}
                </h2>
                <span className={`text-[9px] sm:text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                  pdfModalContract.templateId === 'prestige'
                    ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                    : pdfModalContract.templateId === 'corporate'
                    ? 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                    : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                }`}>
                  {getContractTemplate(pdfModalContract.templateId || companySettings.defaultContractTemplate).name}
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-400 truncate max-w-[240px] sm:max-w-none">
                {pdfModalContract.clientSnapshot.lastName} {pdfModalContract.clientSnapshot.firstName} • {pdfModalContract.vehicleSnapshot.brand} {pdfModalContract.vehicleSnapshot.model}
              </p>
            </div>
          </div>

          {/* Close button visible on top row on mobile */}
          <button
            onClick={closePdfModal}
            className="md:hidden p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            title="Fermer la prévisualisation"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* CONTROLS */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 overflow-x-auto pb-1 md:pb-0 no-scrollbar">
          {/* Zoom Controls */}
          <div className="flex items-center bg-slate-800 border border-slate-700 rounded-lg p-1 text-slate-300 text-xs shrink-0">
            <button
              onClick={() => setZoom((prev) => Math.max(30, prev - 10))}
              className="p-1 hover:bg-slate-700 rounded transition-colors"
              title="Dézoomer"
            >
              <ZoomOut className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
            <span className="px-1.5 sm:px-2 font-mono text-slate-200 font-semibold text-[11px] sm:text-xs">{zoom}%</span>
            <button
              onClick={() => setZoom((prev) => Math.min(130, prev + 10))}
              className="p-1 hover:bg-slate-700 rounded transition-colors"
              title="Zoomer"
            >
              <ZoomIn className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
            <button
              onClick={() => {
                if (typeof window !== 'undefined' && window.innerWidth < 640) {
                  setZoom(45);
                } else {
                  setZoom(85);
                }
              }}
              className="p-1 hover:bg-slate-700 rounded transition-colors ml-0.5 sm:ml-1 border-l border-slate-700"
              title="Ajuster à l'écran"
            >
              <Maximize2 className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
            </button>
          </div>

          {/* Layout Toggle - Desktop only */}
          <div className="hidden lg:flex items-center bg-slate-800 border border-slate-700 rounded-lg p-1 text-slate-300 text-xs shrink-0">
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
              className="flex items-center gap-1 bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 hover:text-white border border-blue-500/40 font-medium text-xs px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg transition-colors cursor-pointer shrink-0"
              title="Modifier ce contrat"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Modifier</span>
            </button>
          )}

          {/* Action: Signature Numérique Interactive */}
          <button
            onClick={() => setIsSignatureModalOpen(true)}
            className={`flex items-center gap-1.5 font-bold text-xs px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg transition-all cursor-pointer shadow-md shrink-0 ${
              pdfModalContract.clientSignature
                ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/50 hover:bg-emerald-900/60'
                : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-amber-500/20 active:scale-95'
            }`}
            title="Recueillir la signature numérique sur écran tactile ou souris"
          >
            {pdfModalContract.clientSignature ? (
              <>
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Signé ✓</span>
              </>
            ) : (
              <>
                <PenTool className="w-4 h-4" />
                <span>Signer</span>
              </>
            )}
          </button>

          {/* Action: Ouvrir dans un nouvel onglet */}
          <button
            onClick={handleOpenPdfInNewTab}
            disabled={isGeneratingPdf}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 font-medium text-xs px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg transition-all active:scale-95 cursor-pointer disabled:opacity-50 shrink-0"
            title="Ouvrir le PDF compilé dans un lecteur natif"
          >
            <ExternalLink className="w-4 h-4 text-sky-400" />
            <span className="hidden sm:inline">Ouvrir PDF</span>
          </button>

          {/* Action: Print */}
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 sm:gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white font-semibold text-xs px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg transition-all active:scale-95 cursor-pointer shrink-0"
            title="Imprimer directement sur imprimante papier ou Enregistrer au format PDF"
          >
            <Printer className="w-4 h-4 text-amber-400" />
            <span className="hidden sm:inline">Imprimer (A4)</span>
          </button>

          {/* Action: Download PDF */}
          <button
            onClick={handleDownloadPdf}
            disabled={isGeneratingPdf}
            className={`flex items-center gap-1.5 sm:gap-2 font-bold text-xs px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg transition-all cursor-pointer shadow-md shrink-0 ${
              downloadSuccess
                ? 'bg-emerald-600 text-white border border-emerald-500 shadow-emerald-600/30'
                : isGeneratingPdf
                ? 'bg-slate-800 text-slate-400 border border-slate-700 cursor-not-allowed'
                : 'bg-amber-500 hover:bg-amber-400 text-slate-950 border border-amber-400 shadow-amber-500/20 active:scale-95'
            }`}
          >
            {isGeneratingPdf ? (
              <>
                <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
                <span className="hidden sm:inline">Compilation {generationPercent}%...</span>
              </>
            ) : downloadSuccess ? (
              <>
                <CheckCircle className="w-4 h-4 text-white" />
                <span>Téléchargé ✓</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4 text-slate-950" />
                <span className="hidden sm:inline">Télécharger PDF A4</span>
                <span className="sm:hidden">PDF</span>
              </>
            )}
          </button>

          {/* Close - Desktop */}
          <button
            onClick={closePdfModal}
            className="hidden md:block p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer ml-1"
            title="Fermer la prévisualisation"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* DOCUMENT PREVIEW CONTAINER */}
      <div className="flex-1 overflow-auto p-3 sm:p-8 bg-slate-950 flex justify-center items-start">
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

      {/* HIDDEN 1:1 EXPORT SOURCE FOR HIGH RESOLUTION CAPTURE */}
      <div
        id="export-pdf-source"
        className="fixed top-0 left-0 pointer-events-none opacity-0 z-[-50]"
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

      {/* MODAL DE SIGNATURE NUMÉRIQUE INTERACTIVE */}
      <DigitalSignatureModal
        contract={pdfModalContract}
        isOpen={isSignatureModalOpen}
        onClose={() => setIsSignatureModalOpen(false)}
        onSignatureSaved={(updated) => {
          addAuditLog(
            'Signature numérique contrat',
            'contract',
            updated.contractNumber,
            `Signature numérique apposée sur le contrat ${updated.contractNumber} (Certificat: ${updated.signatureCertId})`
          );
        }}
        updateContract={updateContract}
      />
    </div>
  );
};
