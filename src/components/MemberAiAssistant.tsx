import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { useApp } from '../context/AppContext';
import { AgentChatMessage } from '../types';
import { isAbortException } from '../initErrorHandling';
import { getScopedDataForUser } from '../utils/managerScopeUtils';
import { getActiveAuthToken, endTerminatedSession, SESSION_TERMINATED } from '../lib/authToken';
import Markdown from 'react-markdown';
import {
  Send,
  Copy,
  Check,
  CheckCheck,
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
} from 'lucide-react';

interface MemberAiAssistantProps {
  isDrawer?: boolean;
  onClose?: () => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

// WhatsApp-style dark palette (solid colours: they are not affected by the app's light-theme overrides)
const WA = {
  bg: 'bg-[#0b141a]',
  bar: 'bg-[#202c33]',
  field: 'bg-[#2a3942]',
  incoming: 'bg-[#202c33]',
  outgoing: 'bg-[#005c4b]',
  accent: 'bg-[#00a884]',
  muted: 'text-[#8696a0]',
};

// Subtle doodle wallpaper, inlined so the page needs no extra asset
const WALLPAPER =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80' viewBox='0 0 80 80'%3E%3Cg fill='none' stroke='%23ffffff' stroke-opacity='0.035' stroke-width='1.2'%3E%3Ccircle cx='14' cy='14' r='5'/%3E%3Cpath d='M50 10h14v9H50zM8 52l8-8 8 8-8 8zM52 50c4-6 12-6 16 0M30 30h6v6h-6zM64 68l4 4M26 70c3 0 3-4 6-4s3 4 6 4'/%3E%3C/g%3E%3C/svg%3E\")";

const nowTime = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

/** Plain text of rendered markdown children (used to copy a drafted message block). */
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
        content: `Bonjour **${currentUser.name}** 👋\n\nJe suis votre assistant Morvello. Je peux vous faire le briefing du jour, suivre vos retours et vos cautions, calculer une prolongation ou rédiger un message pour un client.\n\nQue souhaitez-vous traiter ?`,
        timestamp: nowTime(),
        createdAt: new Date().toISOString(),
      },
    ];
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    localStorage.setItem(`morvello_ai_chat_${currentUser.id}`, JSON.stringify(messages));
  }, [messages, currentUser.id]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Auto-grow the input like a messaging app (up to ~6 lines)
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [input]);

  // Scoped metrics (same scope as the data sent to the assistant)
  const isAdmin = currentUser.role === 'admin';
  const { scopedVehicles: memberVehicles } = getScopedDataForUser(currentUser, vehicles, contracts, deposits, clients, users);
  const availableCount = memberVehicles.filter((v) => v.status === 'available').length;
  const rentedCount = memberVehicles.filter((v) => v.status === 'rented').length;

  const [lastFailedPrompt, setLastFailedPrompt] = useState<string | null>(null);

  // Quick prompts, answered from the server-computed dashboard (dates, alerts, deposits)
  const quickChips = [
    {
      label: '📋 Briefing du jour',
      prompt: 'Fais-moi le briefing du jour : départs et retours d’aujourd’hui et de demain, retards, cautions non prises, soldes à encaisser et alertes véhicules. Termine par les 3 actions prioritaires.',
    },
    {
      label: '🔁 Retours & retards',
      prompt: 'Quels véhicules doivent revenir aujourd’hui et demain, et lesquels sont en retard ? Donne le client, le téléphone et l’heure prévue.',
    },
    {
      label: '💰 Cautions & soldes',
      prompt: 'Liste les cautions non prises et les soldes restant à encaisser sur mes contrats en cours, avec le montant et le client.',
    },
    {
      label: '⚠️ Alertes flotte',
      prompt: 'Quelles sont les échéances à traiter sur ma flotte : assurances, visites techniques, vidanges et vignettes ?',
    },
    {
      label: '🚗 Véhicules dispo',
      prompt: 'Liste mes véhicules disponibles, groupés par gamme (citadine, SUV, premium), avec immatriculation et tarif journalier.',
    },
    {
      label: '👋 Accueil client',
      prompt: 'Rédige un court message WhatsApp d’accueil pour la remise des clés au client de mon prochain départ, avec les documents à présenter.',
    },
    {
      label: '⏰ Rappel restitution',
      prompt: 'Rédige un rappel WhatsApp courtois pour le client qui doit restituer son véhicule aujourd’hui (heure, carburant à l’identique).',
    },
  ];

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

    try {
      // Welcome and error bubbles are UI only: never send them back as if the model had written them
      // (a question that failed is dropped too, so a retry is not seen twice)
      const historyPayload = messages
        .filter(
          (m, i) =>
            !m.id.startsWith('err-') &&
            !m.id.startsWith('welcome') &&
            !(m.role === 'user' && messages[i + 1]?.id.startsWith('err-'))
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
        return fetch('/api/agent-chat', { method: 'POST', headers, body });
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
    setMessages([
      {
        id: 'welcome-reset',
        role: 'model',
        content: `Historique effacé. Comment puis-je vous aider, **${currentUser.name}** ?`,
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

  // Drafted client messages (``` blocks) become a WhatsApp-style card with their own actions
  const markdownComponents = (msgId: string) => ({
    pre: ({ children }: { children?: React.ReactNode }) => {
      const text = nodeText(children).trim();
      const blockId = `${msgId}-${text.length}-${text.slice(0, 12)}`;
      return (
        <div className="not-prose my-2 rounded-lg overflow-hidden border border-white/10 bg-[#111b21]">
          <div className="flex items-center justify-between px-3 py-1.5 bg-black/20 text-[10.5px] text-[#8696a0]">
            <span className="flex items-center gap-1.5 font-medium">
              <MessageCircle className="w-3 h-3 text-[#00a884]" />
              Message client
            </span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => copyToClipboard(text, blockId)}
                className="inline-flex items-center gap-1 hover:text-white transition-colors cursor-pointer"
              >
                {copiedId === blockId ? <Check className="w-3 h-3 text-[#00a884]" /> : <Copy className="w-3 h-3" />}
                {copiedId === blockId ? 'Copié' : 'Copier'}
              </button>
              <button
                type="button"
                onClick={() => shareViaWhatsApp(text)}
                className="inline-flex items-center gap-1 text-[#00a884] hover:text-[#25d366] font-semibold transition-colors cursor-pointer"
              >
                <Send className="w-3 h-3" />
                WhatsApp
              </button>
            </div>
          </div>
          <div className="px-3 py-2.5 whitespace-pre-wrap text-[13px] leading-relaxed text-[#e9edef] font-sans">{text}</div>
        </div>
      );
    },
  });

  let previousDay: string | null = null;

  return (
    <div
      className={`flex flex-col ${WA.bg} text-[#e9edef] overflow-hidden select-text ${
        isDrawer ? 'h-full w-full' : 'h-[calc(100vh-11rem)] min-h-[560px] max-w-4xl mx-auto rounded-2xl border border-black/40 shadow-2xl'
      }`}
    >
      {/* HEADER — like a WhatsApp conversation header */}
      <header className={`${WA.bar} px-3 sm:px-4 py-2.5 flex items-center justify-between shrink-0 shadow-sm z-10`}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative shrink-0">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow">
              <Sparkles className="w-5 h-5 text-[#111b21]" />
            </div>
            <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-[#25d366] border-2 border-[#202c33]" />
          </div>
          <div className="min-w-0">
            <h1 className="text-[15px] font-semibold text-[#e9edef] leading-tight truncate">Morvello AI</h1>
            <p className={`text-[12px] leading-tight truncate ${loading ? 'text-[#00a884]' : WA.muted}`}>
              {loading ? 'écrit…' : `en ligne · ${availableCount} dispo · ${rentedCount} loués`}
            </p>
          </div>
        </div>

        <div className={`flex items-center gap-0.5 ${WA.muted}`}>
          <button
            type="button"
            onClick={() => setPreferredLang(preferredLang === 'fr' ? 'darija' : 'fr')}
            className="px-2 py-1 rounded-full text-[11px] font-semibold border border-white/10 hover:bg-white/5 hover:text-white transition-colors cursor-pointer"
            title="Langue des réponses"
          >
            {preferredLang === 'fr' ? 'FR' : 'Darija'}
          </button>
          <button
            type="button"
            onClick={() => setShowSearch(!showSearch)}
            className={`p-2 rounded-full transition-colors cursor-pointer ${showSearch ? 'text-white bg-white/10' : 'hover:bg-white/5 hover:text-white'}`}
            title="Rechercher"
          >
            <Search className="w-[18px] h-[18px]" />
          </button>
          {isAdmin && (
            <button
              type="button"
              onClick={() => {
                if (onClose) onClose();
                setActiveTab('settings');
              }}
              className="p-2 rounded-full hover:bg-white/5 hover:text-white transition-colors cursor-pointer"
              title="Personnaliser la charte de l'assistant"
            >
              <Sliders className="w-[18px] h-[18px]" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowClearConfirm(true)}
            className="p-2 rounded-full hover:bg-white/5 hover:text-white transition-colors cursor-pointer"
            title="Effacer la conversation"
          >
            <RotateCcw className="w-[18px] h-[18px]" />
          </button>
          {isDrawer && onToggleExpand && (
            <button
              type="button"
              onClick={onToggleExpand}
              className="hidden sm:inline-flex p-2 rounded-full hover:bg-white/5 hover:text-white transition-colors cursor-pointer"
              title={isExpanded ? 'Réduire' : 'Agrandir'}
            >
              {isExpanded ? <Minimize2 className="w-[18px] h-[18px]" /> : <Maximize2 className="w-[18px] h-[18px]" />}
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full hover:bg-white/5 hover:text-white transition-colors cursor-pointer"
              title="Fermer"
            >
              <X className="w-[18px] h-[18px]" />
            </button>
          )}
        </div>
      </header>

      {/* SEARCH */}
      {showSearch && (
        <div className={`${WA.bar} px-3 pb-2.5 shrink-0`}>
          <div className={`${WA.field} rounded-lg flex items-center gap-2 px-3 py-1.5`}>
            <Search className={`w-4 h-4 ${WA.muted}`} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher dans la conversation…"
              className="w-full bg-transparent border-0 text-[13px] text-[#e9edef] placeholder-[#8696a0] focus:outline-none"
              autoFocus
            />
            {searchQuery && (
              <button type="button" onClick={() => setSearchQuery('')} className={`${WA.muted} hover:text-white cursor-pointer`}>
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* CONFIRM CLEAR */}
      {showClearConfirm && (
        <div className="px-4 py-2.5 bg-[#182229] border-b border-black/30 text-[13px] flex items-center justify-between shrink-0">
          <span>Effacer toute la conversation ?</span>
          <div className="flex items-center gap-4 font-semibold">
            <button type="button" onClick={() => setShowClearConfirm(false)} className="text-[#8696a0] hover:text-white cursor-pointer">
              Annuler
            </button>
            <button type="button" onClick={handleClearHistory} className="text-[#f15c6d] hover:text-[#ff7b8a] cursor-pointer">
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
            setShowScrollDown(el.scrollHeight - el.scrollTop - el.clientHeight > 200);
          }}
          className="absolute inset-0 overflow-y-auto px-3 sm:px-[6%] py-3 space-y-1"
          style={{ backgroundImage: WALLPAPER }}
        >
          <div className="flex justify-center my-2">
            <span className="text-[11.5px] text-[#ffd279] bg-[#182229] rounded-lg px-3 py-1.5 text-center max-w-md shadow-sm">
              🔒 Vos données restent cloisonnées : l'assistant ne voit que {isAdmin ? 'les données de votre agence' : 'votre flotte et vos contrats'}.
            </span>
          </div>

          {filteredMessages.length === 0 && (
            <p className={`text-center text-[13px] ${WA.muted} py-6`}>Aucun message ne correspond à « {searchQuery} ».</p>
          )}

          {filteredMessages.map((msg, idx) => {
            const isUser = msg.role === 'user';
            const isError = msg.id.startsWith('err-');
            const prev = filteredMessages[idx - 1];
            const isFirstOfGroup = !prev || prev.role !== msg.role;
            const answered = isUser && filteredMessages.slice(idx + 1).some((m) => m.role === 'model' && !m.id.startsWith('err-'));

            const label = dayLabel(msg.createdAt);
            const showDay = label !== null && label !== previousDay;
            if (label) previousDay = label;

            return (
              <React.Fragment key={msg.id}>
                {showDay && (
                  <div className="flex justify-center py-2">
                    <span className={`text-[11.5px] ${WA.muted} bg-[#182229] rounded-lg px-3 py-1 shadow-sm capitalize`}>{label}</span>
                  </div>
                )}

                <div className={`group flex ${isUser ? 'justify-end' : 'justify-start'} ${isFirstOfGroup ? 'pt-2' : ''}`}>
                  <div
                    className={`relative max-w-[88%] sm:max-w-[75%] rounded-lg px-2.5 pt-1.5 pb-1 shadow-sm ${
                      isUser ? `${WA.outgoing} ${isFirstOfGroup ? 'rounded-tr-none' : ''}` : `${isError ? 'bg-[#3b1f24]' : WA.incoming} ${isFirstOfGroup ? 'rounded-tl-none' : ''}`
                    }`}
                  >
                    {/* Bubble tail on the first message of a group */}
                    {isFirstOfGroup && (
                      <svg
                        viewBox="0 0 8 13"
                        className={`absolute top-0 w-2 h-3 ${isUser ? '-right-2 text-[#005c4b]' : `-left-2 -scale-x-100 ${isError ? 'text-[#3b1f24]' : 'text-[#202c33]'}`}`}
                        aria-hidden="true"
                      >
                        <path fill="currentColor" d="M0 0h8L1.5 11.5C1 12.3 0 12 0 11V0z" />
                      </svg>
                    )}

                    <div className="markdown-body max-w-none text-[13.5px] leading-[1.45] text-[#e9edef] break-words [&_p]:my-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-1 [&_li]:my-0.5 [&_li]:marker:text-[#8696a0] [&_strong]:text-white [&_strong]:font-semibold [&_h1]:text-[15px] [&_h2]:text-[14.5px] [&_h3]:text-[14px] [&_h1]:font-bold [&_h2]:font-bold [&_h3]:font-semibold [&_h1]:my-1.5 [&_h2]:my-1.5 [&_h3]:my-1.5 [&_a]:text-[#53bdeb] [&_a]:underline [&_:not(pre)>code]:bg-black/30 [&_:not(pre)>code]:px-1 [&_:not(pre)>code]:rounded [&_table]:my-1 [&_table]:text-[12.5px] [&_th]:text-left [&_th]:pr-3 [&_td]:pr-3 [&_hr]:border-white/10 [&_hr]:my-2">
                      <Markdown components={markdownComponents(msg.id)}>{msg.content}</Markdown>
                    </div>

                    {/* Meta line: time + ticks, like WhatsApp */}
                    <div className="flex items-center justify-end gap-1.5 -mt-0.5 select-none">
                      {!isUser && !isError && (
                        <button
                          type="button"
                          onClick={() => copyToClipboard(msg.content, msg.id)}
                          className={`opacity-0 group-hover:opacity-100 focus:opacity-100 text-[10.5px] ${WA.muted} hover:text-white transition-opacity cursor-pointer mr-auto`}
                        >
                          {copiedId === msg.id ? 'Copié' : 'Copier'}
                        </button>
                      )}
                      <span className="text-[10.5px] text-[#ffffff99]">{msg.timestamp}</span>
                      {isUser &&
                        (answered ? (
                          <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb]" />
                        ) : loading && idx === filteredMessages.length - 1 ? (
                          <Check className="w-3.5 h-3.5 text-[#ffffff99]" />
                        ) : (
                          <CheckCheck className="w-3.5 h-3.5 text-[#ffffff99]" />
                        ))}
                    </div>
                  </div>
                </div>
              </React.Fragment>
            );
          })}

          {/* Retry after a failed request */}
          {lastFailedPrompt && !loading && (
            <div className="flex justify-start pt-1">
              <button
                type="button"
                onClick={() => sendMessage(lastFailedPrompt)}
                className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#00a884] bg-[#202c33] hover:bg-[#2a3942] rounded-full px-3 py-1.5 shadow-sm cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Réessayer
              </button>
            </div>
          )}

          {/* Typing indicator */}
          {loading && (
            <div className="flex justify-start pt-2">
              <div className={`${WA.incoming} rounded-lg rounded-tl-none px-4 py-3 shadow-sm flex items-center gap-1`}>
                <span className="w-2 h-2 rounded-full bg-[#8696a0] animate-bounce [animation-delay:-0.3s]" />
                <span className="w-2 h-2 rounded-full bg-[#8696a0] animate-bounce [animation-delay:-0.15s]" />
                <span className="w-2 h-2 rounded-full bg-[#8696a0] animate-bounce" />
              </div>
            </div>
          )}

          {/* Suggestions shown as tappable bubbles on a fresh conversation */}
          {onlyWelcome && !loading && (
            <div className="flex flex-wrap gap-2 pt-3 pl-1">
              {quickChips.map((chip) => (
                <button
                  key={chip.label}
                  type="button"
                  onClick={() => sendMessage(chip.prompt)}
                  className="text-[12.5px] text-[#e9edef] bg-[#202c33] hover:bg-[#2a3942] border border-white/5 rounded-full px-3 py-1.5 shadow-sm transition-colors cursor-pointer"
                >
                  {chip.label}
                </button>
              ))}
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Jump to latest */}
        {showScrollDown && (
          <button
            type="button"
            onClick={() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })}
            className="absolute bottom-3 right-4 w-10 h-10 rounded-full bg-[#202c33] text-[#8696a0] hover:text-white shadow-lg flex items-center justify-center cursor-pointer"
            title="Aller au dernier message"
          >
            <ChevronDown className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* QUICK REPLIES TRAY */}
      {showQuickReplies && !onlyWelcome && (
        <div className={`${WA.bar} px-3 pt-2.5 flex gap-2 overflow-x-auto scrollbar-none shrink-0`}>
          {quickChips.map((chip) => (
            <button
              key={chip.label}
              type="button"
              disabled={loading}
              onClick={() => sendMessage(chip.prompt)}
              className="text-[12.5px] text-[#e9edef] bg-[#2a3942] hover:bg-[#33444f] rounded-full px-3 py-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer disabled:opacity-40"
            >
              {chip.label}
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
        className={`${WA.bar} px-2 sm:px-3 py-2.5 flex items-end gap-2 shrink-0`}
      >
        <button
          type="button"
          onClick={() => setShowQuickReplies(!showQuickReplies)}
          disabled={onlyWelcome}
          className={`p-2.5 rounded-full transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-default ${
            showQuickReplies ? 'text-[#00a884] bg-white/5' : `${WA.muted} hover:text-white`
          }`}
          title="Réponses rapides"
        >
          <Zap className="w-5 h-5" />
        </button>

        <div className={`flex-1 ${WA.field} rounded-3xl px-4 py-2.5 flex items-center`}>
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
            className="w-full bg-transparent border-0 text-[14.5px] text-[#e9edef] placeholder-[#8696a0] resize-none outline-none leading-5 max-h-[140px] disabled:opacity-60"
          />
        </div>

        <button
          type="submit"
          disabled={!input.trim() || loading}
          className={`w-11 h-11 shrink-0 rounded-full ${WA.accent} hover:bg-[#06cf9c] text-[#111b21] flex items-center justify-center shadow transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-default`}
          title="Envoyer"
        >
          <Send className="w-5 h-5 translate-x-[1px]" />
        </button>
      </form>
    </div>
  );
};
