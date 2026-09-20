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
  AlertCircle,
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

  const [zoom, setZoom] = useState<number>(85);
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
                2 Pages A4 Calibrées
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
              Client : {pdfModalContract.clientSnapshot.lastName} {pdfModalContract.clientSnapshot.firstName} • {pdfModalContract.vehicleSnapshot.brand} {pdfModalContract.vehicleSnapshot.model} • Caution : {(pdfModalContract.depositAmount ?? 5000).toLocaleString('fr-FR')} MAD
            </p>
          </div>
        </div>

        {/* CONTROLS */}
        <div className="flex items-center gap-2.5">
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

          {/* Action: Signature Numérique Interactive */}
          <button
            onClick={() => setIsSignatureModalOpen(true)}
            className={`flex items-center gap-1.5 font-bold text-xs px-3 py-2 rounded-lg transition-all cursor-pointer shadow-md ${
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
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 font-medium text-xs px-3 py-2 rounded-lg transition-all active:scale-95 cursor-pointer disabled:opacity-50"
            title="Ouvrir le PDF compilé dans un lecteur natif"
          >
            <ExternalLink className="w-4 h-4 text-sky-400" />
            <span>Ouvrir PDF</span>
          </button>

          {/* Action: Print */}
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white font-semibold text-xs px-3 py-2 rounded-lg transition-all active:scale-95 cursor-pointer"
            title="Imprimer directement sur imprimante papier ou Enregistrer au format PDF"
          >
            <Printer className="w-4 h-4 text-amber-400" />
            Imprimer (A4)
          </button>

          {/* Action: Download PDF */}
          <button
            onClick={handleDownloadPdf}
            disabled={isGeneratingPdf}
            className={`flex items-center gap-2 font-bold text-xs px-4 py-2 rounded-lg transition-all cursor-pointer shadow-md ${
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
                <span>Compilation {generationPercent}%...</span>
              </>
            ) : downloadSuccess ? (
              <>
                <CheckCircle className="w-4 h-4 text-white" />
                <span>Téléchargé ✓</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4 text-slate-950" />
                <span>Télécharger PDF A4</span>
              </>
            )}
          </button>

          {/* Close */}
          <button
            onClick={closePdfModal}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer ml-1"
            title="Fermer la prévisualisation"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* NOTICE & PROGRESS BANNER */}
      <div className="no-print bg-slate-900/90 border-b border-slate-800/80 px-6 py-2 flex items-center justify-between text-xs text-slate-300">
        <div className="flex items-center gap-2 flex-1 mr-4">
          {isGeneratingPdf ? (
            <div className="flex items-center gap-3 w-full max-w-xl">
              <Loader2 className="w-4 h-4 text-amber-400 animate-spin shrink-0" />
              <div className="flex-1">
                <div className="flex justify-between items-center text-[11px] mb-1">
                  <strong className="text-amber-400 font-medium">{generationStep}</strong>
                  <span className="font-mono text-amber-300">{generationPercent}%</span>
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-amber-300 transition-all duration-300 rounded-full"
                    style={{ width: `${generationPercent}%` }}
                  />
                </div>
              </div>
            </div>
          ) : downloadSuccess ? (
            <div className="flex items-center gap-2 text-emerald-400">
              <CheckCircle className="w-4 h-4 shrink-0" />
              <span>
                <strong>Document PDF A4 généré avec succès !</strong> Le téléchargement a démarré automatiquement.
                {lastGeneratedBlobUrl && (
                  <button
                    onClick={() => window.open(lastGeneratedBlobUrl, '_blank')}
                    className="ml-2 underline hover:text-emerald-200 text-xs font-semibold cursor-pointer"
                  >
                    Ouvrir le fichier généré ↗
                  </button>
                )}
              </span>
            </div>
          ) : pdfModalContract.clientSignature ? (
            <>
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="text-emerald-300 font-medium">
                <strong>Signature électronique certifiée présente :</strong> Paraphe et signature client validés le {new Date(pdfModalContract.clientSignedAt || '').toLocaleDateString('fr-FR')} (Réf. intégrité : <span className="font-mono text-emerald-200">{pdfModalContract.signatureCertId}</span>).
              </span>
            </>
          ) : (
            <>
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                <strong>Signature en attente :</strong> Cliquez sur <span className="text-amber-300 font-bold">« Signer »</span> pour faire signer le locataire sur écran, ou imprimez le document pour signature papier.
              </span>
            </>
          )}
        </div>
        <div className="text-[11px] text-slate-400 flex items-center gap-2 shrink-0">
          <span>Format : <strong>210 × 297 mm (A4 Recto-Verso)</strong></span>
          <span>•</span>
          <span>Tarif / j : <strong>{pdfModalContract.pricePerDay || 0} MAD</strong></span>
          <span>•</span>
          <span>Caution : <strong>{pdfModalContract.depositAmount || 5000} MAD</strong></span>
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
