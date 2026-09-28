import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { useApp } from '../context/AppContext';
import { AgentChatMessage } from '../types';
import { isAbortException } from '../initErrorHandling';
import { getScopedDataForUser } from '../utils/managerScopeUtils';
import { getActiveAuthToken, endTerminatedSession, SESSION_TERMINATED } from '../lib/authToken';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Send,
  Square,
  Copy,
  Check,
  X,
  Maximize2,
  Minimize2,
  Search,
  Sparkles,
  RotateCcw,
  Sliders,
  ChevronDown,
  MessageCircle,
  Zap,
  AlertTriangle,
  Info,
} from 'lucide-react';

interface MemberAiAssistantProps {
  isDrawer?: boolean;
  onClose?: () => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

const nowTime = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

/** Plain text of rendered markdown children (used to copy a code/draft block). */
function nodeText(node: React.ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join('');
  if (React.isValidElement(node)) return nodeText((node.props as { children?: React.ReactNode }).children);
  return '';
}

function dayLabel(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Aujourd'hui";
  if (d.toDateString() === yesterday.toDateString()) return 'Hier';
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

export const MemberAiAssistant: React.FC<MemberAiAssistantProps> = ({
  isDrawer = false,
  onClose,
  isExpanded = false,
  onToggleExpand,
}) => {
  const { currentUser, vehicles, contracts, clients, deposits, users, aiSettings, setActiveTab } = useApp();

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [preferredLang, setPreferredLang] = useState<'fr' | 'darija'>('fr');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [lastFailedPrompt, setLastFailedPrompt] = useState<string | null>(null);

  const [messages, setMessages] = useState<AgentChatMessage[]>(() => {
    const saved = localStorage.getItem(`morvello_ai_chat_${currentUser.id}`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // fallback
      }
    }
    return [
      {
        id: 'welcome',
        role: 'model',
        content: `Bonjour **${currentUser.name}** 👋`,
        timestamp: nowTime(),
        createdAt: new Date().toISOString(),
      },
    ];
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  // Whether the user is scrolled near the bottom of the thread — new replies auto-scroll
  // only in that case, so reading old messages is never interrupted by a forced jump.
  const isNearBottomRef = useRef(true);

  useEffect(() => {
    localStorage.setItem(`morvello_ai_chat_${currentUser.id}`, JSON.stringify(messages));
  }, [messages, currentUser.id]);

  useEffect(() => {
    const last = messages[messages.length - 1];
    if (last?.role === 'user' || isNearBottomRef.current) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, loading]);

  // Auto-grow the input like a messaging app (up to ~6 lines)
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [input]);

  // Abort any in-flight request if the panel unmounts mid-generation
  useEffect(() => () => abortControllerRef.current?.abort(), []);

  // Scoped metrics (same scope as the data sent to the assistant)
  const isAdmin = currentUser.role === 'admin';
  const { scopedVehicles: memberVehicles } = getScopedDataForUser(currentUser, vehicles, contracts, deposits, clients, users);
  const availableCount = memberVehicles.filter((v) => v.status === 'available').length;
  const rentedCount = memberVehicles.filter((v) => v.status === 'rented').length;

  // Quick prompts, answered from the server-computed dashboard (dates, alerts, deposits)
  const quickChips = [
    {
      label: 'Briefing du jour',
      icon: '📋',
      prompt: 'Fais-moi le briefing du jour : départs et retours d’aujourd’hui et de demain, retards, cautions non prises, soldes à encaisser et alertes véhicules. Termine par les 3 actions prioritaires.',
    },
    {
      label: 'Retours & retards',
      icon: '🔁',
      prompt: 'Quels véhicules doivent revenir aujourd’hui et demain, et lesquels sont en retard ? Donne le client, le téléphone et l’heure prévue.',
    },
    {
      label: 'Cautions & soldes',
      icon: '💰',
      prompt: 'Liste les cautions non prises et les soldes restant à encaisser sur mes contrats en cours, avec le montant et le client.',
    },
    {
      label: 'Alertes flotte',
      icon: '⚠️',
      prompt: 'Quelles sont les échéances à traiter sur ma flotte : assurances, visites techniques, vidanges et vignettes ?',
    },
    {
      label: 'Véhicules dispo',
      icon: '🚗',
      prompt: 'Liste mes véhicules disponibles, groupés par gamme (citadine, SUV, premium), avec immatriculation et tarif journalier.',
    },
    {
      label: 'Accueil client',
      icon: '👋',
      prompt: 'Rédige un court message WhatsApp d’accueil pour la remise des clés au client de mon prochain départ, avec les documents à présenter.',
    },
  ];

  const stopGenerating = () => {
    abortControllerRef.current?.abort();
  };

  const sendMessage = async (userPrompt: string) => {
    if (!userPrompt.trim() || loading) return;

    let finalPrompt = userPrompt.trim();
    if (preferredLang === 'darija' && !finalPrompt.toLowerCase().includes('darija')) {
      finalPrompt = `${finalPrompt} (Rédige en Darija marocaine soignée).`;
    }

    const userMsg: AgentChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: userPrompt.trim(),
      timestamp: nowTime(),
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setShowQuickReplies(false);
    setLoading(true);
    setLastFailedPrompt(null);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      // Welcome / error / stopped bubbles are UI only: never send them back as if the model had
      // written them (a question left unanswered by a failure or a stop is dropped too, so a
      // retry is not seen twice).
      const historyPayload = messages
        .filter(
          (m, i) =>
            !m.id.startsWith('err-') &&
            !m.id.startsWith('stopped-') &&
            !m.id.startsWith('welcome') &&
            !(
              m.role === 'user' &&
              (messages[i + 1]?.id.startsWith('err-') || messages[i + 1]?.id.startsWith('stopped-'))
            )
        )
        .slice(-8)
        .map((m) => ({
          role: m.role,
          content: m.content,
        }));

      // Cloisonnement strict des données transmises à l'IA selon le rôle
      const { scopedVehicles, scopedContracts, scopedDeposits } = getScopedDataForUser(
        currentUser,
        vehicles,
        contracts,
        deposits,
        clients,
        users
      );

      const body = JSON.stringify({
        memberId: currentUser.id,
        memberName: currentUser.name,
        memberAgency: currentUser.agency || currentUser.assignedFleetName,
        message: finalPrompt,
        history: historyPayload,
        memberData: {
          vehicles: scopedVehicles,
          contracts: scopedContracts,
          deposits: scopedDeposits,
        },
        aiSettings,
      });

      let sentProvider: string | null = null;
      const postChat = async (forceRefresh: boolean) => {
        const { token, provider } = await getActiveAuthToken({ forceRefresh });
        sentProvider = token ? provider : null;
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        return fetch('/api/agent-chat', { method: 'POST', headers, body, signal: controller.signal });
      };

      const readAuthError = async (r: Response): Promise<{ error?: string; code?: string }> => {
        try {
          return (await r.clone().json()) || {};
        } catch {
          return {};
        }
      };
      const sessionClosedError = () =>
        new Error('votre session a été fermée (déconnexion, expiration ou révocation). Veuillez vous reconnecter');

      let res = await postChat(false);
      if (res.status === 401) {
        const first = await readAuthError(res);
        // The session behind the token no longer exists: retrying cannot help, end it on this device
        if (first.code === SESSION_TERMINATED) {
          await endTerminatedSession();
          throw sessionClosedError();
        }
        // Otherwise (e.g. expired access token): refresh once and retry
        res = await postChat(true);
      }
      if (res.status === 401) {
        const second = await readAuthError(res);
        if (second.code === SESSION_TERMINATED || !sentProvider) {
          await endTerminatedSession();
          throw sessionClosedError();
        }
        throw new Error(
          `connexion refusée par le serveur (jeton ${sentProvider}) : ${second.error || 'jeton invalide'}. Veuillez vous reconnecter`
        );
      }

      let data: any = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }
      if (res.status === 429) {
        throw new Error(`trop de demandes en peu de temps. Réessayez dans ${data?.retryAfterSeconds || 60} secondes`);
      }
      if (res.status === 403) {
        throw new Error(
          data?.error ||
            'accès refusé (code 403) : votre compte ne dispose pas d’un profil collaborateur actif dans l’agence.'
        );
      }
      if (!res.ok) {
        throw new Error(data?.error || `le service IA ne répond pas (code ${res.status})`);
      }

      if (data?.success && data.reply) {
        const assistantMsg: AgentChatMessage = {
          id: `model-${Date.now()}`,
          role: 'model',
          content: data.reply,
          timestamp: nowTime(),
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } else {
        throw new Error(data?.error || 'Réponse indisponible');
      }
    } catch (err: any) {
      if (isAbortException(err)) {
        setMessages((prev) => [
          ...prev,
          {
            id: `stopped-${Date.now()}`,
            role: 'model',
            content: 'Génération interrompue.',
            timestamp: nowTime(),
            createdAt: new Date().toISOString(),
          },
        ]);
        return;
      }
      setLastFailedPrompt(userPrompt.trim());
      const errorMsg: AgentChatMessage = {
        id: `err-${Date.now()}`,
        role: 'model',
        content: `Désolé, une erreur est survenue : ${err.message || 'Service indisponible'}.`,
        timestamp: nowTime(),
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
      inputRef.current?.focus();
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const shareViaWhatsApp = (text: string) => {
    const cleanText = text
      .trim()
      .replace(/\*\*(.*?)\*\*/g, '*$1*')
      .replace(/### (.*?)\n/g, '*$1*\n')
      .replace(/## (.*?)\n/g, '*$1*\n')
      .replace(/# (.*?)\n/g, '*$1*\n');
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(cleanText)}`, '_blank');
  };

  const handleClearHistory = () => {
    abortControllerRef.current?.abort();
    setMessages([
      {
        id: 'welcome-reset',
        role: 'model',
        content: `Bonjour **${currentUser.name}** 👋`,
        timestamp: nowTime(),
        createdAt: new Date().toISOString(),
      },
    ]);
    localStorage.removeItem(`morvello_ai_chat_${currentUser.id}`);
    setShowClearConfirm(false);
    setLastFailedPrompt(null);
  };

  const filteredMessages = searchQuery.trim()
    ? messages.filter((m) => m.content.toLowerCase().includes(searchQuery.toLowerCase()))
    : messages;

  const onlyWelcome = messages.length <= 1;
  const showHero = onlyWelcome && !searchQuery.trim();
  const lastErrorId = [...messages].reverse().find((m) => m.id.startsWith('err-'))?.id;

  // Markdown rendering tuned for readable, structured AI answers: headings, lists, tables,
  // info callouts (blockquotes), inline code and fenced code blocks with a Copy action.
  // An unlabelled fenced block (no ```lang) is treated as a drafted client message, per the
  // server's own instruction to the model to fence message drafts that way.
  const markdownComponents = (msgId: string) => ({
    p: ({ children }: { children?: React.ReactNode }) => (
      <p className="my-2 first:mt-0 last:mb-0 text-[13.5px] text-slate-300 leading-relaxed">{children}</p>
    ),
    h1: ({ children }: { children?: React.ReactNode }) => (
      <h1 className="text-[15.5px] font-bold text-white mt-3 mb-1.5 first:mt-0">{children}</h1>
    ),
    h2: ({ children }: { children?: React.ReactNode }) => (
      <h2 className="text-[14.5px] font-bold text-white mt-3 mb-1.5 first:mt-0">{children}</h2>
    ),
    h3: ({ children }: { children?: React.ReactNode }) => (
      <h3 className="text-[13.5px] font-semibold text-slate-200 mt-2.5 mb-1 first:mt-0">{children}</h3>
    ),
    strong: ({ children }: { children?: React.ReactNode }) => (
      <strong className="font-semibold text-white">{children}</strong>
    ),
    ul: ({ children }: { children?: React.ReactNode }) => (
      <ul className="my-2 pl-5 space-y-1 list-disc marker:text-slate-600">{children}</ul>
    ),
    ol: ({ children }: { children?: React.ReactNode }) => (
      <ol className="my-2 pl-5 space-y-1 list-decimal marker:text-slate-600">{children}</ol>
    ),
    li: ({ children }: { children?: React.ReactNode }) => (
      <li className="text-[13.5px] text-slate-300 leading-relaxed">{children}</li>
    ),
    a: ({ children, href }: { children?: React.ReactNode; href?: string }) => (
      <a href={href} target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:text-sky-300 underline underline-offset-2">
        {children}
      </a>
    ),
    hr: () => <hr className="my-3 border-slate-800" />,
    blockquote: ({ children }: { children?: React.ReactNode }) => (
      <div className="not-prose my-2.5 flex gap-2.5 rounded-xl border border-amber-500/25 bg-amber-950/60 px-3.5 py-2.5">
        <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <div className="text-[13px] text-slate-300 leading-relaxed [&>p]:my-0">{children}</div>
      </div>
    ),
    table: ({ children }: { children?: React.ReactNode }) => (
      <div className="not-prose my-2.5 overflow-x-auto rounded-lg border border-slate-800">
        <table className="w-full text-[12.5px] border-collapse">{children}</table>
      </div>
    ),
    thead: ({ children }: { children?: React.ReactNode }) => <thead className="bg-slate-800/60">{children}</thead>,
    th: ({ children }: { children?: React.ReactNode }) => (
      <th className="text-left font-semibold text-slate-300 px-3 py-1.5 border-b border-slate-800">{children}</th>
    ),
    td: ({ children }: { children?: React.ReactNode }) => (
      <td className="px-3 py-1.5 border-b border-slate-800/60 text-slate-300">{children}</td>
    ),
    // `pre` is a transparent passthrough: the `code` renderer below owns all block/inline styling,
    // which avoids react-markdown's ambiguity between inline and fenced code at the `pre` level.
    pre: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
    code: ({ className, children }: { className?: string; children?: React.ReactNode }) => {
      const raw = nodeText(children).replace(/\n$/, '');
      const langMatch = /language-(\w+)/.exec(className || '');
      const isBlock = Boolean(langMatch) || raw.includes('\n');

      if (!isBlock) {
        return <code className="px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 text-[12.5px] font-mono">{children}</code>;
      }

      const blockId = `${msgId}-${raw.length}-${raw.slice(0, 16)}`;

      if (!langMatch) {
        // Unlabelled fenced block: a drafted client message (WhatsApp / SMS)
        return (
          <div className="not-prose my-2.5 rounded-xl overflow-hidden border border-emerald-500/25 bg-emerald-950/60">
            <div className="flex items-center justify-between px-3 py-1.5 bg-emerald-500/10 border-b border-emerald-500/20">
              <span className="flex items-center gap-1.5 text-[10.5px] font-semibold text-emerald-400 uppercase tracking-wide">
                <MessageCircle className="w-3 h-3" />
                Message client
              </span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => copyToClipboard(raw, blockId)}
                  className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-100 transition-colors cursor-pointer"
                >
                  {copiedId === blockId ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  {copiedId === blockId ? 'Copié' : 'Copier'}
                </button>
                <button
                  type="button"
                  onClick={() => shareViaWhatsApp(raw)}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer"
                >
                  <Send className="w-3 h-3" />
                  WhatsApp
                </button>
              </div>
            </div>
            <div className="px-3.5 py-3 whitespace-pre-wrap text-[13px] leading-relaxed text-slate-200">{raw}</div>
          </div>
        );
      }

      return (
        <div className="not-prose my-2.5 rounded-xl overflow-hidden border border-slate-800 bg-slate-950">
          <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900 border-b border-slate-800">
            <span className="text-[10.5px] font-mono text-slate-500 uppercase tracking-wide">{langMatch[1]}</span>
            <button
              type="button"
              onClick={() => copyToClipboard(raw, blockId)}
              className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-100 transition-colors cursor-pointer"
            >
              {copiedId === blockId ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              {copiedId === blockId ? 'Copié' : 'Copier'}
            </button>
          </div>
          <pre className="px-3.5 py-3 overflow-x-auto">
            <code className="text-[12.5px] font-mono text-slate-200 leading-relaxed">{raw}</code>
          </pre>
        </div>
      );
    },
  });

  let previousDay: string | null = null;

  return (
    <div
      className={`flex flex-col bg-slate-950 text-slate-100 overflow-hidden select-text ${
        isDrawer ? 'h-full w-full' : 'h-[calc(100vh-11rem)] min-h-[560px] max-w-4xl mx-auto rounded-2xl border border-slate-800 shadow-2xl'
      }`}
    >
      {/* HEADER */}
      <header className="bg-slate-900/95 backdrop-blur-sm px-3 sm:px-4 py-2.5 flex items-center justify-between shrink-0 border-b border-slate-800 z-10">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative shrink-0">
            <div className="w-9 h-9 rounded-xl bg-amber-600 flex items-center justify-center shadow">
              <Sparkles className="w-4.5 h-4.5 text-slate-950" />
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-slate-900" />
          </div>
          <div className="min-w-0">
            <h1 className="text-[14.5px] font-semibold text-white leading-tight truncate">Morvello AI</h1>
            <p className={`text-[11.5px] leading-tight truncate ${loading ? 'text-amber-400' : 'text-slate-500'}`}>
              {loading ? 'Réflexion en cours…' : `en ligne · ${availableCount} dispo · ${rentedCount} loués`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => setPreferredLang(preferredLang === 'fr' ? 'darija' : 'fr')}
            className="px-2 py-1 rounded-lg text-[11px] font-semibold border border-slate-800 text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors cursor-pointer"
            title="Langue des réponses"
          >
            {preferredLang === 'fr' ? 'FR' : 'Darija'}
          </button>
          <button
            type="button"
            onClick={() => setShowSearch(!showSearch)}
            className={`p-2 rounded-lg transition-colors cursor-pointer ${
              showSearch ? 'text-amber-400 bg-slate-800' : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
            }`}
            title="Rechercher"
          >
            <Search className="w-[17px] h-[17px]" />
          </button>
          {isAdmin && (
            <button
              type="button"
              onClick={() => {
                if (onClose) onClose();
                setActiveTab('settings');
              }}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors cursor-pointer"
              title="Personnaliser la charte de l'assistant"
            >
              <Sliders className="w-[17px] h-[17px]" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowClearConfirm(true)}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors cursor-pointer"
            title="Effacer la conversation"
          >
            <RotateCcw className="w-[17px] h-[17px]" />
          </button>
          {isDrawer && onToggleExpand && (
            <button
              type="button"
              onClick={onToggleExpand}
              className="hidden sm:inline-flex p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors cursor-pointer"
              title={isExpanded ? 'Réduire' : 'Agrandir'}
            >
              {isExpanded ? <Minimize2 className="w-[17px] h-[17px]" /> : <Maximize2 className="w-[17px] h-[17px]" />}
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors cursor-pointer"
              title="Fermer"
            >
              <X className="w-[17px] h-[17px]" />
            </button>
          )}
        </div>
      </header>

      {/* SEARCH */}
      {showSearch && (
        <div className="bg-slate-900 px-3 pb-2.5 shrink-0 border-b border-slate-800">
          <div className="bg-slate-950 border border-slate-800 rounded-lg flex items-center gap-2 px-3 py-1.5">
            <Search className="w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher dans la conversation…"
              className="w-full bg-transparent border-0 text-[13px] text-slate-100 placeholder-slate-500 focus:outline-none"
              autoFocus
            />
            {searchQuery && (
              <button type="button" onClick={() => setSearchQuery('')} className="text-slate-500 hover:text-slate-100 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* CONFIRM CLEAR */}
      {showClearConfirm && (
        <div className="px-4 py-2.5 bg-slate-900 border-b border-slate-800 text-[13px] flex items-center justify-between shrink-0">
          <span className="text-slate-300">Effacer toute la conversation ?</span>
          <div className="flex items-center gap-4 font-semibold">
            <button type="button" onClick={() => setShowClearConfirm(false)} className="text-slate-500 hover:text-slate-100 cursor-pointer">
              Annuler
            </button>
            <button type="button" onClick={handleClearHistory} className="text-rose-400 hover:text-rose-300 cursor-pointer">
              Effacer
            </button>
          </div>
        </div>
      )}

      {/* CONVERSATION */}
      <div className="relative flex-1 min-h-0">
        <div
          ref={scrollRef}
          onScroll={(e) => {
            const el = e.currentTarget;
            const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
            isNearBottomRef.current = distance < 120;
            setShowScrollDown(distance > 200);
          }}
          className="absolute inset-0 overflow-y-auto px-4 sm:px-6 py-5"
        >
          <div className="max-w-3xl mx-auto w-full">
            <div className="flex justify-center mb-5">
              <span className="flex items-center gap-1.5 text-[11px] text-amber-300 bg-amber-950/60 border border-amber-500/20 rounded-full px-3 py-1.5 text-center">
                🔒 Vos données restent cloisonnées : l'assistant ne voit que{' '}
                {isAdmin ? 'les données de votre agence' : 'votre flotte et vos contrats'}.
              </span>
            </div>

            {showHero ? (
              <div className="flex flex-col items-center text-center px-2 py-6 sm:py-10">
                <div className="w-14 h-14 rounded-2xl bg-amber-600 flex items-center justify-center shadow-lg mb-4">
                  <Sparkles className="w-7 h-7 text-slate-950" />
                </div>
                <h2 className="text-lg font-bold text-white mb-1.5">Bonjour {currentUser.name.split(' ')[0]} 👋</h2>
                <p className="text-[13px] text-slate-400 leading-relaxed max-w-sm mb-6">
                  Votre assistant Morvello pour le briefing du jour, le suivi des retours et des cautions, les calculs de
                  prolongation et la rédaction de messages clients.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full max-w-xl text-left">
                  {quickChips.map((chip) => (
                    <button
                      key={chip.label}
                      type="button"
                      onClick={() => sendMessage(chip.prompt)}
                      className="p-3 rounded-xl border border-slate-800 bg-slate-900 hover:border-amber-500/40 hover:bg-slate-800/60 transition-colors cursor-pointer"
                    >
                      <span className="text-[13px] font-semibold text-slate-100 flex items-center gap-1.5">
                        <span>{chip.icon}</span>
                        {chip.label}
                      </span>
                      <span className="block text-[11.5px] text-slate-500 mt-0.5 line-clamp-2">{chip.prompt}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : filteredMessages.length === 0 ? (
              <p className="text-center text-[13px] text-slate-500 py-6">Aucun message ne correspond à « {searchQuery} ».</p>
            ) : (
              <div className="space-y-5">
                {filteredMessages.map((msg, idx) => {
                  const isUser = msg.role === 'user';
                  const isError = msg.id.startsWith('err-');
                  const isStopped = msg.id.startsWith('stopped-');

                  const label = dayLabel(msg.createdAt);
                  const showDay = label !== null && label !== previousDay;
                  if (label) previousDay = label;

                  return (
                    <React.Fragment key={msg.id}>
                      {showDay && (
                        <div className="flex justify-center py-1">
                          <span className="text-[11px] font-medium text-slate-500 bg-slate-900 border border-slate-800 rounded-full px-3 py-1 capitalize">
                            {label}
                          </span>
                        </div>
                      )}

                      {isStopped ? (
                        <div className="flex justify-center">
                          <span className="flex items-center gap-1.5 text-[11.5px] text-slate-500 italic">
                            <Square className="w-3 h-3" />
                            {msg.content}
                          </span>
                        </div>
                      ) : isUser ? (
                        <div className="flex justify-end">
                          <div className="max-w-[82%] sm:max-w-[70%] bg-amber-600 text-slate-950 rounded-2xl rounded-br-md px-4 py-2.5 shadow-sm">
                            <p className="text-[14px] leading-relaxed whitespace-pre-wrap break-words font-medium">{msg.content}</p>
                            <div className="text-[10px] text-slate-950/60 text-right mt-1">{msg.timestamp}</div>
                          </div>
                        </div>
                      ) : (
                        <div className="group flex gap-3 items-start">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm mt-0.5 ${
                              isError ? 'bg-rose-500/15 border border-rose-500/30' : 'bg-amber-600'
                            }`}
                          >
                            {isError ? (
                              <AlertTriangle className="w-4 h-4 text-rose-400" />
                            ) : (
                              <Sparkles className="w-4 h-4 text-slate-950" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-2 mb-1">
                              <span className={`text-[12.5px] font-semibold ${isError ? 'text-rose-400' : 'text-slate-200'}`}>
                                {isError ? 'Erreur' : 'Morvello AI'}
                              </span>
                              <span className="text-[10.5px] text-slate-500">{msg.timestamp}</span>
                            </div>
                            <div
                              className={`rounded-2xl rounded-tl-md px-4 py-3.5 shadow-sm ${
                                isError ? 'bg-rose-950/60 border border-rose-500/25' : 'bg-slate-900 border border-slate-800'
                              }`}
                            >
                              {isError ? (
                                <p className="text-[13px] text-rose-200 leading-relaxed">{msg.content}</p>
                              ) : (
                                <Markdown remarkPlugins={[remarkGfm]} components={markdownComponents(msg.id)}>
                                  {msg.content}
                                </Markdown>
                              )}
                              {isError && msg.id === lastErrorId && lastFailedPrompt && !loading && (
                                <button
                                  type="button"
                                  onClick={() => sendMessage(lastFailedPrompt)}
                                  className="mt-2.5 inline-flex items-center gap-1.5 text-[12px] font-semibold text-amber-400 hover:text-amber-300 transition-colors cursor-pointer"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                  Réessayer
                                </button>
                              )}
                            </div>
                            {!isError && (
                              <button
                                type="button"
                                onClick={() => copyToClipboard(msg.content, msg.id)}
                                className="mt-1 opacity-70 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 text-[10.5px] text-slate-500 hover:text-slate-200 transition-opacity cursor-pointer"
                              >
                                {copiedId === msg.id ? 'Copié' : 'Copier la réponse'}
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}

                {/* Thinking indicator */}
                {loading && (
                  <div className="flex gap-3 items-start">
                    <div className="w-8 h-8 rounded-full bg-amber-600 flex items-center justify-center shrink-0 shadow-sm">
                      <Sparkles className="w-4 h-4 text-slate-950" />
                    </div>
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl rounded-tl-md px-4 py-3 shadow-sm flex items-center gap-2.5">
                      <span className="text-[12.5px] text-slate-400">Réflexion en cours</span>
                      <span className="flex gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce [animation-delay:-0.3s]" />
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce [animation-delay:-0.15s]" />
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce" />
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div ref={chatEndRef} />
          </div>
        </div>

        {/* Jump to latest */}
        {showScrollDown && (
          <button
            type="button"
            onClick={() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })}
            className="absolute bottom-3 right-4 w-10 h-10 rounded-full bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-100 shadow-lg flex items-center justify-center cursor-pointer transition-colors"
            title="Aller au dernier message"
          >
            <ChevronDown className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* QUICK REPLIES TRAY */}
      {showQuickReplies && !onlyWelcome && (
        <div className="bg-slate-900 border-t border-slate-800 px-3 pt-2.5 flex gap-2 overflow-x-auto scrollbar-none shrink-0">
          {quickChips.map((chip) => (
            <button
              key={chip.label}
              type="button"
              disabled={loading}
              onClick={() => sendMessage(chip.prompt)}
              className="text-[12.5px] text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-full px-3 py-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer disabled:opacity-40"
            >
              {chip.icon} {chip.label}
            </button>
          ))}
        </div>
      )}

      {/* COMPOSER */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendMessage(input);
        }}
        className="bg-slate-900 border-t border-slate-800 px-2 sm:px-3 py-2.5 flex items-end gap-2 shrink-0"
      >
        <button
          type="button"
          onClick={() => setShowQuickReplies(!showQuickReplies)}
          disabled={onlyWelcome}
          className={`p-2.5 rounded-full transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-default ${
            showQuickReplies ? 'text-amber-400 bg-slate-800' : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
          }`}
          title="Réponses rapides"
        >
          <Zap className="w-5 h-5" />
        </button>

        <div className="flex-1 bg-slate-950 border border-slate-800 focus-within:border-amber-500/60 rounded-3xl px-4 py-2.5 flex items-center transition-colors">
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage(input);
              }
            }}
            placeholder={preferredLang === 'darija' ? 'Kteb message… (réponse en Darija)' : 'Écrivez un message'}
            disabled={loading}
            className="w-full bg-transparent border-0 text-[14.5px] text-slate-100 placeholder-slate-500 resize-none outline-none leading-5 max-h-[140px] disabled:opacity-60"
          />
        </div>

        <button
          type="button"
          onClick={() => (loading ? stopGenerating() : sendMessage(input))}
          disabled={!loading && !input.trim()}
          className={`w-11 h-11 shrink-0 rounded-full flex items-center justify-center shadow transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-default ${
            loading ? 'bg-rose-500 hover:bg-rose-600 text-white' : 'bg-amber-600 hover:bg-amber-700 text-slate-950'
          }`}
          title={loading ? 'Arrêter la génération' : 'Envoyer'}
        >
          {loading ? <Square className="w-4 h-4 fill-current" /> : <Send className="w-5 h-5 translate-x-[1px]" />}
        </button>
      </form>
    </div>
  );
};
