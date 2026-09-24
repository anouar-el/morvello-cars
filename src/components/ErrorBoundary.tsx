import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw, Copy, Check, ChevronDown, ChevronUp, ShieldAlert, Home } from 'lucide-react';
import { isAbortException } from '../initErrorHandling';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
  isolateView?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  copied: boolean;
  showDetails: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    copied: false,
    showDetails: false,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    // Only genuine abort controller errors can be bypassed
    if (error?.name === 'AbortError' || (error as any)?.code === 'cancelled') {
      return { hasError: false };
    }
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (isAbortException(error)) {
      return;
    }
    console.error('[ErrorBoundary caught an error]:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      copied: false,
      showDetails: false,
    });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  private handleReload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  private handleCopyError = () => {
    const { error, errorInfo } = this.state;
    const report = [
      `Morvello Cars Error Report - ${new Date().toISOString()}`,
      `Error: ${error?.name}: ${error?.message}`,
      `Stack: ${error?.stack || 'N/A'}`,
      `Component Stack: ${errorInfo?.componentStack || 'N/A'}`,
      `User Agent: ${typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A'}`,
    ].join('\n\n');

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(report).then(() => {
        this.setState({ copied: true });
        setTimeout(() => this.setState({ copied: false }), 2500);
      });
    }
  };

  public render() {
    if (this.state.hasError) {
      const isIsolated = this.props.isolateView;
      const isDynamicImportError =
        this.state.error?.message?.includes('Failed to fetch dynamically imported module') ||
        this.state.error?.message?.includes('dynamically imported module') ||
        this.state.error?.name === 'ChunkLoadError';

      return (
        <div
          id="error-boundary-container"
          className={`flex flex-col items-center justify-center p-6 ${
            isIsolated
              ? 'min-h-[420px] w-full bg-slate-900/50 rounded-2xl border border-red-500/20 my-4'
              : 'min-h-screen w-full bg-slate-950 text-slate-100'
          }`}
        >
          <div className="max-w-xl w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="flex items-start gap-4">
              <div
                className={`w-12 h-12 rounded-xl border flex items-center justify-center shrink-0 ${
                  isDynamicImportError
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                    : 'bg-red-500/10 border-red-500/30 text-red-400'
                }`}
              >
                {isDynamicImportError ? <RotateCcw className="w-6 h-6" /> : <ShieldAlert className="w-6 h-6" />}
              </div>
              <div className="space-y-1 flex-1">
                <div
                  className={`inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-[11px] font-mono uppercase tracking-wider ${
                    isDynamicImportError
                      ? 'bg-amber-950/60 border border-amber-800/40 text-amber-400'
                      : 'bg-red-950/60 border border-red-800/40 text-red-400'
                  }`}
                >
                  <AlertTriangle className="w-3 h-3" />
                  {isDynamicImportError ? 'Mise à jour détectée' : 'Interruption inattendue'}
                </div>
                <h2 className="text-xl font-bold text-white tracking-tight">
                  {isDynamicImportError
                    ? 'Nouvelle version de l’application disponible'
                    : this.props.fallbackTitle || 'Une erreur est survenue dans l\'application'}
                </h2>
                <p className="text-sm text-slate-400 leading-relaxed">
                  {isDynamicImportError
                    ? 'Une mise à jour récente a été déployée sur le serveur. Vos fichiers locaux en cache doivent être synchronisés pour charger ce module.'
                    : 'L\'application Morvello Cars a rencontré un problème imprévu. Vos données locales et sauvegardes restent protégées.'}
                </p>
              </div>
            </div>

            {/* Error Message summary */}
            {this.state.error?.message && (
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-red-300 break-words">
                <span className="text-slate-500 select-none">Détail : </span>
                {this.state.error.message}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                id="error-boundary-reload-btn"
                onClick={this.handleReload}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm transition-all shadow-lg shadow-amber-500/20 active:scale-95"
              >
                <RotateCcw className="w-4 h-4" />
                {isDynamicImportError ? 'Mettre à jour et recharger' : 'Rafraîchir la page'}
              </button>

              {!isDynamicImportError && (
                <button
                  type="button"
                  id="error-boundary-reset-btn"
                  onClick={this.handleReset}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-sm transition-colors active:scale-95 border border-slate-700"
                >
                  <Home className="w-4 h-4" />
                  Réessayer la vue
                </button>
              )}

              <button
                type="button"
                id="error-boundary-copy-btn"
                onClick={this.handleCopyError}
                className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-xs font-mono transition-colors border border-slate-700/60 ml-auto"
                title="Copier le rapport technique d'erreur"
              >
                {this.state.copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Rapport copié</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copier rapport</span>
                  </>
                )}
              </button>
            </div>

            {/* Collapsible Technical Stack */}
            <div className="border-t border-slate-800/80 pt-4">
              <button
                type="button"
                onClick={() => this.setState((prev) => ({ showDetails: !prev.showDetails }))}
                className="inline-flex items-center gap-2 text-xs font-mono text-slate-500 hover:text-slate-300 transition-colors"
              >
                {this.state.showDetails ? (
                  <>
                    <ChevronUp className="w-3.5 h-3.5" />
                    Masquer la trace technique
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3.5 h-3.5" />
                    Afficher la trace technique (support)
                  </>
                )}
              </button>

              {this.state.showDetails && (
                <div className="mt-3 p-4 rounded-xl bg-black/60 border border-slate-800 text-[11px] font-mono text-slate-400 max-h-56 overflow-auto space-y-2 select-text">
                  <div className="text-red-400 font-semibold">{this.state.error?.stack}</div>
                  {this.state.errorInfo?.componentStack && (
                    <div className="text-slate-500 border-t border-slate-900 pt-2 whitespace-pre-wrap">
                      {this.state.errorInfo.componentStack}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
