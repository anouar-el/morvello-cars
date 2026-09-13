import React, { useRef, useState } from 'react';
import {
  Upload,
  FileText,
  Image as ImageIcon,
  Eye,
  Trash2,
  FileCheck,
  X,
  CreditCard,
  FileBadge,
  Sparkles,
} from 'lucide-react';

export interface DocumentFile {
  dataUrl?: string;
  name?: string;
  fileType?: string;
}

interface ClientDocumentUploadProps {
  cinRecto?: DocumentFile;
  cinVerso?: DocumentFile;
  licenseRecto?: DocumentFile;
  licenseVerso?: DocumentFile;
  onChange: (data: {
    cinDocUrl?: string;
    cinDocName?: string;
    cinDocVersoUrl?: string;
    cinDocVersoName?: string;
    licenseDocUrl?: string;
    licenseDocName?: string;
    licenseDocVersoUrl?: string;
    licenseDocVersoName?: string;
  }) => void;
  compact?: boolean;
}

export const ClientDocumentUpload: React.FC<ClientDocumentUploadProps> = ({
  cinRecto,
  cinVerso,
  licenseRecto,
  licenseVerso,
  onChange,
  compact = false,
}) => {
  const [previewDoc, setPreviewDoc] = useState<{ title: string; dataUrl: string } | null>(null);

  // File input refs
  const cinRectoRef = useRef<HTMLInputElement>(null);
  const cinVersoRef = useRef<HTMLInputElement>(null);
  const licenseRectoRef = useRef<HTMLInputElement>(null);
  const licenseVersoRef = useRef<HTMLInputElement>(null);

  // Drag states
  const [dragActive, setDragActive] = useState<string | null>(null);

  const handleFileProcess = (file: File, field: 'cinRecto' | 'cinVerso' | 'licenseRecto' | 'licenseVerso') => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const fileName = file.name;

      if (field === 'cinRecto') {
        onChange({
          cinDocUrl: dataUrl,
          cinDocName: fileName,
          cinDocVersoUrl: cinVerso?.dataUrl,
          cinDocVersoName: cinVerso?.name,
          licenseDocUrl: licenseRecto?.dataUrl,
          licenseDocName: licenseRecto?.name,
          licenseDocVersoUrl: licenseVerso?.dataUrl,
          licenseDocVersoName: licenseVerso?.name,
        });
      } else if (field === 'cinVerso') {
        onChange({
          cinDocUrl: cinRecto?.dataUrl,
          cinDocName: cinRecto?.name,
          cinDocVersoUrl: dataUrl,
          cinDocVersoName: fileName,
          licenseDocUrl: licenseRecto?.dataUrl,
          licenseDocName: licenseRecto?.name,
          licenseDocVersoUrl: licenseVerso?.dataUrl,
          licenseDocVersoName: licenseVerso?.name,
        });
      } else if (field === 'licenseRecto') {
        onChange({
          cinDocUrl: cinRecto?.dataUrl,
          cinDocName: cinRecto?.name,
          cinDocVersoUrl: cinVerso?.dataUrl,
          cinDocVersoName: cinVerso?.name,
          licenseDocUrl: dataUrl,
          licenseDocName: fileName,
          licenseDocVersoUrl: licenseVerso?.dataUrl,
          licenseDocVersoName: licenseVerso?.name,
        });
      } else if (field === 'licenseVerso') {
        onChange({
          cinDocUrl: cinRecto?.dataUrl,
          cinDocName: cinRecto?.name,
          cinDocVersoUrl: cinVerso?.dataUrl,
          cinDocVersoName: cinVerso?.name,
          licenseDocUrl: licenseRecto?.dataUrl,
          licenseDocName: licenseRecto?.name,
          licenseDocVersoUrl: dataUrl,
          licenseDocVersoName: fileName,
        });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemove = (field: 'cinRecto' | 'cinVerso' | 'licenseRecto' | 'licenseVerso') => {
    if (field === 'cinRecto') {
      onChange({
        cinDocUrl: '',
        cinDocName: '',
        cinDocVersoUrl: cinVerso?.dataUrl,
        cinDocVersoName: cinVerso?.name,
        licenseDocUrl: licenseRecto?.dataUrl,
        licenseDocName: licenseRecto?.name,
        licenseDocVersoUrl: licenseVerso?.dataUrl,
        licenseDocVersoName: licenseVerso?.name,
      });
    } else if (field === 'cinVerso') {
      onChange({
        cinDocUrl: cinRecto?.dataUrl,
        cinDocName: cinRecto?.name,
        cinDocVersoUrl: '',
        cinDocVersoName: '',
        licenseDocUrl: licenseRecto?.dataUrl,
        licenseDocName: licenseRecto?.name,
        licenseDocVersoUrl: licenseVerso?.dataUrl,
        licenseDocVersoName: licenseVerso?.name,
      });
    } else if (field === 'licenseRecto') {
      onChange({
        cinDocUrl: cinRecto?.dataUrl,
        cinDocName: cinRecto?.name,
        cinDocVersoUrl: cinVerso?.dataUrl,
        cinDocVersoName: cinVerso?.name,
        licenseDocUrl: '',
        licenseDocName: '',
        licenseDocVersoUrl: licenseVerso?.dataUrl,
        licenseDocVersoName: licenseVerso?.name,
      });
    } else if (field === 'licenseVerso') {
      onChange({
        cinDocUrl: cinRecto?.dataUrl,
        cinDocName: cinRecto?.name,
        cinDocVersoUrl: cinVerso?.dataUrl,
        cinDocVersoName: cinVerso?.name,
        licenseDocUrl: licenseRecto?.dataUrl,
        licenseDocName: licenseRecto?.name,
        licenseDocVersoUrl: '',
        licenseDocVersoName: '',
      });
    }
  };

  // Generate specimen svg
  const handleSampleSpecimen = (type: 'cin' | 'license') => {
    if (type === 'cin') {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="320" viewBox="0 0 500 320">
        <rect width="500" height="320" rx="14" fill="#0f172a" stroke="#3b82f6" stroke-width="3"/>
        <rect x="15" y="15" width="470" height="50" rx="8" fill="#1e3a8a"/>
        <text x="250" y="45" font-family="sans-serif" font-size="16" font-weight="bold" fill="#ffffff" text-anchor="middle">ROYAUME DU MAROC • CARTE NATIONALE D'IDENTITÉ</text>
        <rect x="35" y="85" width="100" height="130" rx="8" fill="#334155" stroke="#64748b"/>
        <circle cx="85" cy="130" r="30" fill="#94a3b8"/>
        <path d="M45,200 Q85,160 125,200 Z" fill="#94a3b8"/>
        <text x="160" y="110" font-family="sans-serif" font-size="14" font-weight="bold" fill="#f8fafc">NOM : ALAMI</text>
        <text x="160" y="135" font-family="sans-serif" font-size="14" font-weight="bold" fill="#f8fafc">PRÉNOM : MEHDI</text>
        <text x="160" y="160" font-family="sans-serif" font-size="12" fill="#94a3b8">NÉ LE : 01/01/1990 À CASABLANCA</text>
        <text x="160" y="185" font-family="sans-serif" font-size="12" fill="#94a3b8">VALABLE JUSQU'AU : 12/08/2032</text>
        <rect x="35" y="240" width="430" height="60" rx="6" fill="#1e293b"/>
        <text x="50" y="275" font-family="monospace" font-size="18" font-weight="bold" fill="#38bdf8">CIN N° : BJ981240</text>
      </svg>`;
      const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
      onChange({
        cinDocUrl: dataUrl,
        cinDocName: 'CIN_Specimen_Maroc.svg',
        cinDocVersoUrl: cinVerso?.dataUrl,
        cinDocVersoName: cinVerso?.name,
        licenseDocUrl: licenseRecto?.dataUrl,
        licenseDocName: licenseRecto?.name,
        licenseDocVersoUrl: licenseVerso?.dataUrl,
        licenseDocVersoName: licenseVerso?.name,
      });
    } else {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="320" viewBox="0 0 500 320">
        <rect width="500" height="320" rx="14" fill="#0f172a" stroke="#f59e0b" stroke-width="3"/>
        <rect x="15" y="15" width="470" height="50" rx="8" fill="#78350f"/>
        <text x="250" y="45" font-family="sans-serif" font-size="16" font-weight="bold" fill="#ffffff" text-anchor="middle">ROYAUME DU MAROC • PERMIS DE CONDUIRE</text>
        <rect x="35" y="85" width="100" height="130" rx="8" fill="#334155" stroke="#64748b"/>
        <circle cx="85" cy="130" r="30" fill="#fbbf24"/>
        <path d="M45,200 Q85,160 125,200 Z" fill="#fbbf24"/>
        <text x="160" y="110" font-family="sans-serif" font-size="14" font-weight="bold" fill="#f8fafc">TITULAIRE : ALAMI MEHDI</text>
        <text x="160" y="135" font-family="sans-serif" font-size="13" font-weight="bold" fill="#38bdf8">CATÉGORIES : B (Véhicules légers)</text>
        <text x="160" y="160" font-family="sans-serif" font-size="12" fill="#94a3b8">DÉLIVRÉ LE : 14/05/2014</text>
        <text x="160" y="185" font-family="sans-serif" font-size="12" fill="#94a3b8">PRÉFECTURE : CASABLANCA-ANFA</text>
        <rect x="35" y="240" width="430" height="60" rx="6" fill="#1e293b"/>
        <text x="50" y="275" font-family="monospace" font-size="18" font-weight="bold" fill="#f59e0b">PERMIS N° : B-492019/14</text>
      </svg>`;
      const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
      onChange({
        cinDocUrl: cinRecto?.dataUrl,
        cinDocName: cinRecto?.name,
        cinDocVersoUrl: cinVerso?.dataUrl,
        cinDocVersoName: cinVerso?.name,
        licenseDocUrl: dataUrl,
        licenseDocName: 'Permis_Specimen_Maroc.svg',
        licenseDocVersoUrl: licenseVerso?.dataUrl,
        licenseDocVersoName: licenseVerso?.name,
      });
    }
  };

  const renderUploadBox = (
    label: string,
    field: 'cinRecto' | 'cinVerso' | 'licenseRecto' | 'licenseVerso',
    doc?: DocumentFile,
    fileRef?: React.RefObject<HTMLInputElement | null>
  ) => {
    const isOver = dragActive === field;
    const hasDoc = !!doc?.dataUrl;
    const isPdf = doc?.name?.toLowerCase().endsWith('.pdf') || doc?.dataUrl?.startsWith('data:application/pdf');

    return (
      <div
        className={`relative border rounded-xl p-3 transition-all ${
          isOver
            ? 'border-amber-400 bg-amber-500/10'
            : hasDoc
            ? 'border-emerald-500/40 bg-emerald-950/15'
            : 'border-slate-800 bg-slate-950/50 hover:border-slate-700'
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(field);
        }}
        onDragLeave={() => setDragActive(null)}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(null);
          const file = e.dataTransfer.files?.[0];
          if (file) handleFileProcess(file, field);
        }}
      >
        <input
          ref={fileRef as React.RefObject<HTMLInputElement>}
          type="file"
          accept="image/*,.pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFileProcess(file, field);
          }}
        />

        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
            {label}
            {hasDoc && <span className="text-[10px] text-emerald-400 font-bold">✓ Attaché</span>}
          </span>

          {hasDoc && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPreviewDoc({ title: label, dataUrl: doc.dataUrl! })}
                className="p-1 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded transition-colors"
                title="Aperçu du document"
              >
                <Eye className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleRemove(field)}
                className="p-1 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition-colors"
                title="Supprimer ce document"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {hasDoc ? (
          <div
            onClick={() => setPreviewDoc({ title: label, dataUrl: doc.dataUrl! })}
            className="flex items-center gap-3 p-2 bg-slate-900/80 border border-slate-800 rounded-lg cursor-pointer hover:border-slate-700 transition-colors"
          >
            {isPdf ? (
              <div className="w-10 h-10 rounded bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                <FileText className="w-5 h-5" />
              </div>
            ) : (
              <div className="w-10 h-10 rounded bg-slate-950 border border-slate-700 overflow-hidden shrink-0 flex items-center justify-center">
                <img
                  src={doc.dataUrl}
                  alt={label}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-mono text-slate-200 truncate font-semibold">
                {doc.name || 'Document numérisé'}
              </p>
              <p className="text-[10px] text-emerald-400 mt-0.5 flex items-center gap-1">
                <FileCheck className="w-3 h-3" />
                {isPdf ? 'Document PDF' : 'Image numérisée'} • Enregistré
              </p>
            </div>
          </div>
        ) : (
          <div
            onClick={() => fileRef?.current?.click()}
            className="border-2 border-dashed border-slate-800 hover:border-slate-700 rounded-lg p-3 text-center cursor-pointer transition-colors group"
          >
            <Upload className="w-5 h-5 text-slate-500 group-hover:text-amber-400 mx-auto mb-1 transition-colors" />
            <p className="text-xs text-slate-400 group-hover:text-slate-200 font-medium">
              Glisser ou <span className="text-amber-400 underline decoration-amber-400/50">parcourir</span>
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">JPG, PNG ou PDF (Optionnel)</p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-4">
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Numérisation des Documents Client (Facultatif)
            </h3>
            <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full border border-slate-700">
              Non obligatoire
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Téléversez les photos ou scans du permis de conduire et de la pièce d'identité (CIN ou Passeport).
          </p>
        </div>

        {/* Specimen helper for instant testing without files */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleSampleSpecimen('cin')}
            className="px-2.5 py-1 bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/30 text-blue-300 rounded-lg text-[10px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
            title="Générer un spécimen CIN de test"
          >
            <Sparkles className="w-3 h-3 text-blue-400" />
            Spécimen CIN
          </button>
          <button
            type="button"
            onClick={() => handleSampleSpecimen('license')}
            className="px-2.5 py-1 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 rounded-lg text-[10px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
            title="Générer un spécimen Permis de test"
          >
            <Sparkles className="w-3 h-3 text-amber-400" />
            Spécimen Permis
          </button>
        </div>
      </div>

      {/* TWO SECTIONS: PERMIS & CIN / PASSEPORT */}
      <div className={`grid grid-cols-1 ${compact ? 'gap-3' : 'md:grid-cols-2 gap-4'}`}>
        {/* 1. PERMIS DE CONDUIRE */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3.5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileBadge className="w-4 h-4 text-amber-400" />
              <h4 className="text-xs font-bold text-white">Permis de Conduire</h4>
            </div>
            <span className="text-[10px] text-slate-500">Recto & Verso acceptés</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {renderUploadBox('Permis (Recto)', 'licenseRecto', licenseRecto, licenseRectoRef)}
            {renderUploadBox('Permis (Verso)', 'licenseVerso', licenseVerso, licenseVersoRef)}
          </div>
        </div>

        {/* 2. CIN / PASSEPORT */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3.5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-blue-400" />
              <h4 className="text-xs font-bold text-white">C.I.N / Passeport</h4>
            </div>
            <span className="text-[10px] text-slate-500">Recto & Verso acceptés</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {renderUploadBox('Pièce (Recto / Page)', 'cinRecto', cinRecto, cinRectoRef)}
            {renderUploadBox('Pièce (Verso)', 'cinVerso', cinVerso, cinVersoRef)}
          </div>
        </div>
      </div>

      {/* LIGHTBOX / ZOOM MODAL */}
      {previewDoc && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">{previewDoc.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewDoc(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="max-h-[70vh] overflow-auto flex items-center justify-center bg-slate-950 rounded-xl p-2 border border-slate-800">
              {previewDoc.dataUrl.startsWith('data:application/pdf') ? (
                <iframe
                  src={previewDoc.dataUrl}
                  title="PDF Preview"
                  className="w-full h-[500px] rounded"
                />
              ) : (
                <img
                  src={previewDoc.dataUrl}
                  alt={previewDoc.title}
                  className="max-w-full max-h-[60vh] object-contain rounded-lg shadow-lg"
                  referrerPolicy="no-referrer"
                />
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <a
                href={previewDoc.dataUrl}
                download="document_client"
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition-colors"
              >
                Télécharger le document
              </a>
              <button
                type="button"
                onClick={() => setPreviewDoc(null)}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-xl transition-colors"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
