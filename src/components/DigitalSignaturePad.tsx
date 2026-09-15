import React, { useRef, useState, useEffect, useCallback } from 'react';
import { RotateCcw, Trash2, Check, PenTool, ShieldCheck, Sparkles } from 'lucide-react';

interface Point {
  x: number;
  y: number;
}

interface Stroke {
  points: Point[];
  color: string;
  width: number;
}

interface DigitalSignaturePadProps {
  onSave?: (dataUrl: string) => void;
  onClear?: () => void;
  initialDataUrl?: string;
  signerName?: string;
  signerRole?: string;
  contractNumber?: string;
  className?: string;
  readOnly?: boolean;
}

export const DigitalSignaturePad: React.FC<DigitalSignaturePadProps> = ({
  onSave,
  onClear,
  initialDataUrl,
  signerName = 'Locataire Principal',
  signerRole = 'Conducteur certifié',
  contractNumber,
  className = '',
  readOnly = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<Point[]>([]);
  const [inkColor, setInkColor] = useState<string>('#0f2b5c'); // Bleu marine officiel prestige
  const [strokeWidth, setStrokeWidth] = useState<number>(2.5);
  const [hasSignature, setHasSignature] = useState<boolean>(!!initialDataUrl);
  const [isSaved, setIsSaved] = useState<boolean>(false);

  // Redraw all strokes on canvas
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw baseline guideline
    const dpr = window.devicePixelRatio || 1;
    const height = canvas.height / dpr;
    const width = canvas.width / dpr;

    ctx.save();
    ctx.scale(dpr, dpr);

    // Guide line
    ctx.beginPath();
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.moveTo(30, height - 38);
    ctx.lineTo(width - 30, height - 38);
    ctx.stroke();
    ctx.setLineDash([]);

    // Subtitle indicator on guide line
    ctx.font = '10px Inter, system-ui, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'right';
    ctx.fillText('X — Signer sur la ligne', width - 35, height - 44);

    // Draw all completed strokes with quadratic curve smoothing
    const allStrokes = [...strokes];
    if (currentStroke.length > 0) {
      allStrokes.push({ points: currentStroke, color: inkColor, width: strokeWidth });
    }

    allStrokes.forEach((stroke) => {
      if (stroke.points.length === 0) return;

      ctx.beginPath();
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (stroke.points.length === 1) {
        ctx.arc(stroke.points[0].x, stroke.points[0].y, stroke.width / 2, 0, Math.PI * 2);
        ctx.fillStyle = stroke.color;
        ctx.fill();
        return;
      }

      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);

      for (let i = 1; i < stroke.points.length - 1; i++) {
        const xc = (stroke.points[i].x + stroke.points[i + 1].x) / 2;
        const yc = (stroke.points[i].y + stroke.points[i + 1].y) / 2;
        ctx.quadraticCurveTo(stroke.points[i].x, stroke.points[i].y, xc, yc);
      }

      const lastPoint = stroke.points[stroke.points.length - 1];
      const prevPoint = stroke.points[stroke.points.length - 2];
      ctx.quadraticCurveTo(prevPoint.x, prevPoint.y, lastPoint.x, lastPoint.y);
      ctx.stroke();
    });

    ctx.restore();
  }, [strokes, currentStroke, inkColor, strokeWidth]);

  // Adjust canvas size for high-DPI displays
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const resize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const width = rect.width;
      const height = 180; // Standard comfortable signature height

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      redraw();
    };

    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [redraw]);

  // Redraw when strokes change
  useEffect(() => {
    redraw();
  }, [strokes, currentStroke, redraw]);

  const getCanvasCoordinates = (e: React.PointerEvent<HTMLCanvasElement>): Point | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (readOnly) return;
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    const pt = getCanvasCoordinates(e);
    if (!pt) return;

    setIsDrawing(true);
    setCurrentStroke([pt]);
    setHasSignature(true);
    setIsSaved(false);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing || readOnly) return;
    e.preventDefault();

    const pt = getCanvasCoordinates(e);
    if (!pt) return;

    setCurrentStroke((prev) => [...prev, pt]);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing || readOnly) return;
    e.preventDefault();
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // Ignored
    }

    setIsDrawing(false);
    if (currentStroke.length > 0) {
      const newStroke: Stroke = {
        points: currentStroke,
        color: inkColor,
        width: strokeWidth,
      };
      setStrokes((prev) => [...prev, newStroke]);
      setCurrentStroke([]);
    }
  };

  // Undo last stroke
  const handleUndo = () => {
    if (readOnly || strokes.length === 0) return;
    setStrokes((prev) => {
      const next = prev.slice(0, prev.length - 1);
      if (next.length === 0) {
        setHasSignature(false);
      }
      return next;
    });
    setIsSaved(false);
  };

  // Clear signature
  const handleClear = () => {
    if (readOnly) return;
    setStrokes([]);
    setCurrentStroke([]);
    setHasSignature(false);
    setIsSaved(false);
    if (onClear) onClear();
  };

  // Export high resolution transparent PNG
  const exportSignatureDataUrl = (): string | null => {
    const canvas = canvasRef.current;
    if (!canvas || (!hasSignature && strokes.length === 0)) return null;

    // Create export canvas to extract pure signature with transparent background
    const exportCanvas = document.createElement('canvas');
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;

    exportCanvas.width = width * 2; // Extra sharp 2x export
    exportCanvas.height = height * 2;
    const ctx = exportCanvas.getContext('2d');
    if (!ctx) return null;

    ctx.scale(2, 2);

    strokes.forEach((stroke) => {
      if (stroke.points.length === 0) return;

      ctx.beginPath();
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (stroke.points.length === 1) {
        ctx.arc(stroke.points[0].x, stroke.points[0].y, stroke.width / 2, 0, Math.PI * 2);
        ctx.fillStyle = stroke.color;
        ctx.fill();
        return;
      }

      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);

      for (let i = 1; i < stroke.points.length - 1; i++) {
        const xc = (stroke.points[i].x + stroke.points[i + 1].x) / 2;
        const yc = (stroke.points[i].y + stroke.points[i + 1].y) / 2;
        ctx.quadraticCurveTo(stroke.points[i].x, stroke.points[i].y, xc, yc);
      }

      const lastPoint = stroke.points[stroke.points.length - 1];
      const prevPoint = stroke.points[stroke.points.length - 2];
      ctx.quadraticCurveTo(prevPoint.x, prevPoint.y, lastPoint.x, lastPoint.y);
      ctx.stroke();
    });

    return exportCanvas.toDataURL('image/png');
  };

  const handleSave = () => {
    const dataUrl = exportSignatureDataUrl();
    if (dataUrl && onSave) {
      onSave(dataUrl);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    }
  };

  return (
    <div className={`flex flex-col bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl select-none ${className}`}>
      {/* Header with signer info & controls */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <PenTool className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-bold text-white tracking-wide">{signerName}</h4>
              <span className="text-[10px] bg-slate-800 text-amber-300 px-2 py-0.5 rounded-full border border-slate-700">
                {signerRole}
              </span>
            </div>
            {contractNumber && (
              <p className="text-[10px] text-slate-400">
                Contrat N° <span className="font-mono text-slate-300 font-semibold">{contractNumber}</span>
              </p>
            )}
          </div>
        </div>

        {/* Ink & Style options */}
        {!readOnly && (
          <div className="flex items-center gap-2">
            {/* Color buttons */}
            <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 gap-1">
              <button
                type="button"
                onClick={() => setInkColor('#0f2b5c')}
                className={`w-4.5 h-4.5 rounded-full transition-transform ${
                  inkColor === '#0f2b5c' ? 'ring-2 ring-amber-400 scale-110' : 'opacity-70 hover:opacity-100'
                }`}
                style={{ backgroundColor: '#0f2b5c' }}
                title="Encre Bleu Marine Officiel"
              />
              <button
                type="button"
                onClick={() => setInkColor('#111827')}
                className={`w-4.5 h-4.5 rounded-full transition-transform ${
                  inkColor === '#111827' ? 'ring-2 ring-amber-400 scale-110' : 'opacity-70 hover:opacity-100'
                }`}
                style={{ backgroundColor: '#111827' }}
                title="Encre Noire"
              />
            </div>

            {/* Stroke Width */}
            <div className="flex items-center bg-slate-950 px-2 py-1 rounded-lg border border-slate-800 text-[11px] text-slate-300 gap-1.5 font-mono">
              <button
                type="button"
                onClick={() => setStrokeWidth(2)}
                className={`px-1 rounded ${strokeWidth === 2 ? 'text-amber-400 font-bold' : 'hover:text-white'}`}
                title="Trait fin"
              >
                Fin
              </button>
              <span className="text-slate-600">|</span>
              <button
                type="button"
                onClick={() => setStrokeWidth(3)}
                className={`px-1 rounded ${strokeWidth === 3 ? 'text-amber-400 font-bold' : 'hover:text-white'}`}
                title="Trait standard"
              >
                Moyen
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Interactive Signature Canvas Box */}
      <div
        ref={containerRef}
        className="relative bg-white rounded-xl border-2 border-slate-300 overflow-hidden shadow-inner cursor-crosshair touch-none"
        style={{ touchAction: 'none' }}
      >
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="w-full block"
        />

        {/* Watermark certificate */}
        <div className="absolute top-2.5 right-3 pointer-events-none flex items-center gap-1 text-[9px] text-slate-400/80 font-mono select-none">
          <ShieldCheck className="w-3 h-3 text-emerald-600/70" />
          <span>Certification Morvello e-Sign</span>
        </div>

        {/* Empty state hint */}
        {!hasSignature && strokes.length === 0 && !isDrawing && (
          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center text-slate-400 select-none">
            <PenTool className="w-6 h-6 text-slate-300 mb-1 animate-bounce" />
            <span className="text-xs font-medium text-slate-500">
              Signez ici avec le doigt, stylet ou souris
            </span>
            <span className="text-[10px] text-slate-400 font-arabic mt-0.5">
              وقع هنا بواسطة الإصبع أو القلم
            </span>
          </div>
        )}
      </div>

      {/* Legal Acknowledgment Notice */}
      <div className="mt-2.5 px-3 py-2 bg-slate-950/60 rounded-xl border border-slate-800/80 text-[10.5px] text-slate-300 flex items-start gap-2">
        <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
        <div className="leading-snug">
          <span className="font-semibold text-slate-200">Mention légale obligatoire : </span>
          « Lu et approuvé, bon pour accord des conditions générales et particulières de location. »
          <span className="text-[9.5px] text-slate-400 block font-arabic mt-0.5">
            قرئ وصودق عليه، موافقة تامة على شروط وأحكام عقد الكراء
          </span>
        </div>
      </div>

      {/* Bottom Action Buttons */}
      {!readOnly && (
        <div className="mt-3 flex items-center justify-between gap-2 pt-2 border-t border-slate-800">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleClear}
              disabled={!hasSignature && strokes.length === 0}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-red-400 px-3 py-1.5 rounded-lg border border-slate-800 hover:border-red-500/30 transition-colors disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Effacer</span>
            </button>
            <button
              type="button"
              onClick={handleUndo}
              disabled={strokes.length === 0}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 px-3 py-1.5 rounded-lg border border-slate-800 hover:border-slate-700 transition-colors disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Annuler trait</span>
            </button>
          </div>

          {onSave && (
            <button
              type="button"
              onClick={handleSave}
              disabled={!hasSignature && strokes.length === 0}
              className={`flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-xl transition-all cursor-pointer shadow-md ${
                isSaved
                  ? 'bg-emerald-600 text-white'
                  : hasSignature || strokes.length > 0
                  ? 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-amber-500/20 active:scale-95'
                  : 'bg-slate-800 text-slate-500 border border-slate-700 pointer-events-none'
              }`}
            >
              {isSaved ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Signature Enregistrée !</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Valider la Signature</span>
                </>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
