import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { AgentChatMessage } from '../types';
import Markdown from 'react-markdown';
import {
  Send,
  Copy,
  Check,
  Share2,
  Trash2,
  X,
  Maximize2,
  Minimize2,
  Search,
  Sparkles,
  RotateCcw,
  Sliders,
} from 'lucide-react';

interface MemberAiAssistantProps {
  isDrawer?: boolean;
  onClose?: () => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

export const MemberAiAssistant: React.FC<MemberAiAssistantProps> = ({
  isDrawer = false,
  onClose,
  isExpanded = false,
  onToggleExpand,
}) => {
  const { currentUser, vehicles, contracts, clients, deposits, aiSettings, setActiveTab } = useApp();

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [preferredLang, setPreferredLang] = useState<'fr' | 'darija'>('fr');
  const [showClearConfirm, setShowClearConfirm] = useState(false);

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
        content: `Bonjour **${currentUser.name}**.\n\nJe suis à votre disposition pour la gestion de votre flotte, vos contrats, vos calculs de prolongation et la rédaction de messages clients.\n\nQue souhaitez-vous traiter ?`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ];
  });

  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    localStorage.setItem(`morvello_ai_chat_${currentUser.id}`, JSON.stringify(messages));
  }, [messages, currentUser.id]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Scoped metrics
  const isAdmin = currentUser.role === 'admin';
  const memberVehicles = isAdmin
    ? vehicles
    : vehicles.filter(
        (v) =>
          v.assignedManagerId === currentUser.id ||
          (v.assignedManagerName && v.assignedManagerName.toLowerCase().includes(currentUser.name.toLowerCase()))
      );
  const availableCount = memberVehicles.filter((v) => v.status === 'available').length;
  const rentedCount = memberVehicles.filter((v) => v.status === 'rented').length;

  // Minimalist quick prompts (single sleek horizontal list)
  const quickChips = [
    {
      label: 'Briefing flotte',
      prompt: 'Fais-moi un point rapide et synthétique sur l’état de ma flotte aujourd’hui : véhicules disponibles, loués et alertes urgentes.',
    },
    {
      label: 'Véhicules dispo',
      prompt: 'Liste-moi mes véhicules actuellement disponibles avec immatriculation et tarif journalier standard.',
    },
    {
      label: 'Accueil WhatsApp',
      prompt: 'Rédige un court message d’accueil WhatsApp élégant et chaleureux pour la remise des clés au client.',
    },
    {
      label: 'Rappel restitution',
      prompt: 'Rédige un rappel SMS courtois au client avec consignes pour l’heure de restitution et le plein de carburant.',
    },
    {
      label: 'Prolongation 3j',
      prompt: 'Calcule le montant exact d’une prolongation de 3 jours (tarif 300 MAD/j) et prépare le message pour le client.',
    },
    {
      label: 'Échéances Sanlam',
      prompt: 'Vérifie les échéances d’assurance et de contrôle technique pour ma flotte.',
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
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const historyPayload = messages.slice(-6).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch('/api/agent-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId: currentUser.id,
          memberName: currentUser.name,
          memberRole: currentUser.role,
          memberAgency: currentUser.agency || currentUser.assignedFleetName,
          message: finalPrompt,
          history: historyPayload,
          memberData: {
            vehicles,
            contracts,
            clients,
            deposits,
          },
          aiSettings,
        }),
      });

      const data = await res.json();

      if (data.success && data.reply) {
        const assistantMsg: AgentChatMessage = {
          id: `model-${Date.now()}`,
          role: 'model',
          content: data.reply,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } else {
        throw new Error(data.error || 'Réponse indisponible');
      }
    } catch (err: any) {
      const errorMsg: AgentChatMessage = {
        id: `err-${Date.now()}`,
        role: 'model',
        content: `Désolé, une erreur est survenue : ${err.message || 'Service indisponible'}.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const shareViaWhatsApp = (text: string) => {
    const cleanText = text
      .replace(/\*\*(.*?)\*\*/g, '*$1*')
      .replace(/### (.*?)\n/g, '*$1*\n')
      .replace(/## (.*?)\n/g, '*$1*\n')
      .replace(/# (.*?)\n/g, '*$1*\n');

    const encoded = encodeURIComponent(cleanText);
    window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
  };

  const handleClearHistory = () => {
    const resetMsg: AgentChatMessage[] = [
      {
        id: 'welcome-reset',
        role: 'model',
        content: `Historique effacé. Comment puis-je vous aider, **${currentUser.name}** ?`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ];
    setMessages(resetMsg);
    localStorage.removeItem(`morvello_ai_chat_${currentUser.id}`);
    setShowClearConfirm(false);
  };

  const filteredMessages = searchQuery.trim()
    ? messages.filter((m) => m.content.toLowerCase().includes(searchQuery.toLowerCase()))
    : messages;

  const isClientMessageDraft = (content: string) => {
    const l = content.toLowerCase();
    return (
      l.includes('whatsapp') ||
      l.includes('sms') ||
      l.includes('salam') ||
      l.includes('cher client') ||
      l.includes('chère cliente') ||
      l.includes('bienvenue chez morvello')
    );
  };

  return (
    <div
      className={`flex flex-col bg-slate-950 text-slate-100 overflow-hidden select-text ${
        isDrawer ? 'h-full w-full' : 'min-h-[640px] max-w-4xl mx-auto rounded-2xl border border-slate-800 shadow-2xl'
      }`}
    >
      {/* 1. MINIMALIST TOP BAR */}
      <header className="px-5 py-3.5 border-b border-slate-850/80 bg-slate-950/80 backdrop-blur-sm flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          <div className="flex items-baseline gap-2">
            <h1 className="text-xs font-semibold text-white tracking-wide uppercase">Morvello AI</h1>
            <span className="text-[11px] text-slate-400 font-normal">
              {availableCount} dispo · {rentedCount} loués
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* Language Toggle */}
          <button
            type="button"
            onClick={() => setPreferredLang(preferredLang === 'fr' ? 'darija' : 'fr')}
            className="px-2 py-1 rounded-md text-[10px] font-medium text-slate-400 hover:text-white hover:bg-slate-900 transition-colors cursor-pointer"
            title="Basculer la langue par défaut"
          >
            {preferredLang === 'fr' ? 'FR' : 'Darija'}
          </button>

          {/* Search Toggle */}
          <button
            type="button"
            onClick={() => setShowSearch(!showSearch)}
            className={`p-1.5 rounded-md transition-colors cursor-pointer ${
              showSearch ? 'text-amber-400 bg-slate-900' : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
            title="Rechercher"
          >
            <Search className="w-3.5 h-3.5" />
          </button>

          {/* Settings link for Admin */}
          {isAdmin && (
            <button
              type="button"
              onClick={() => {
                if (onClose) onClose();
                setActiveTab('settings');
              }}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-900 rounded-md transition-colors cursor-pointer"
              title="Personnaliser la charte et la vision"
            >
              <Sliders className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Clear history */}
          <button
            type="button"
            onClick={() => setShowClearConfirm(true)}
            className="p-1.5 text-slate-400 hover:text-slate-300 hover:bg-slate-900 rounded-md transition-colors cursor-pointer"
            title="Réinitialiser"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* Expand Toggle */}
          {isDrawer && onToggleExpand && (
            <button
              type="button"
              onClick={onToggleExpand}
              className="hidden sm:inline-flex p-1.5 text-slate-400 hover:text-white hover:bg-slate-900 rounded-md transition-colors cursor-pointer"
              title={isExpanded ? 'Réduire' : 'Agrandir'}
            >
              {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
          )}

          {/* Close */}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-900 rounded-md transition-colors cursor-pointer"
              title="Fermer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </header>

      {/* 2. SEARCH BAR (COLLAPSIBLE) */}
      {showSearch && (
        <div className="px-5 py-2 border-b border-slate-900 bg-slate-950 flex items-center gap-2">
          <Search className="w-3.5 h-3.5 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher dans la conversation..."
            className="w-full bg-transparent border-0 text-xs text-white placeholder-slate-500 focus:outline-none"
            autoFocus
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="text-slate-500 hover:text-white text-xs cursor-pointer"
            >
              Effacer
            </button>
          )}
        </div>
      )}

      {/* 3. CONFIRM CLEAR ALERT */}
      {showClearConfirm && (
        <div className="px-5 py-2.5 bg-slate-900 border-b border-slate-800 text-xs flex items-center justify-between text-slate-300">
          <span>Effacer l'historique de conversation ?</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleClearHistory}
              className="text-rose-400 hover:text-rose-300 font-medium cursor-pointer"
            >
              Confirmer
            </button>
            <span className="text-slate-600">·</span>
            <button
              type="button"
              onClick={() => setShowClearConfirm(false)}
              className="text-slate-400 hover:text-white cursor-pointer"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* 4. CHAT STREAM (CLEAN & SPACIOUS) */}
      <div className="flex-1 p-5 sm:p-6 overflow-y-auto space-y-6">
        {filteredMessages.map((msg) => {
          const isUser = msg.role === 'user';
          const isDraft = !isUser && isClientMessageDraft(msg.content);

          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
            >
              {/* Bubble */}
              <div
                className={`max-w-[88%] sm:max-w-[82%] text-xs sm:text-[13px] leading-relaxed transition-all ${
                  isUser
                    ? 'bg-slate-850 text-slate-100 rounded-2xl rounded-tr-sm px-4 py-2.5 shadow-sm border border-slate-750'
                    : 'text-slate-200'
                }`}
              >
                <div className="markdown-body prose prose-invert max-w-none text-xs sm:text-[13px] leading-relaxed">
                  <Markdown>{msg.content}</Markdown>
                </div>

                {/* Minimal draft actions */}
                {isDraft && (
                  <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center gap-3 text-[11px]">
                    <button
                      type="button"
                      onClick={() => shareViaWhatsApp(msg.content)}
                      className="inline-flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 font-medium transition-colors cursor-pointer"
                    >
                      <Share2 className="w-3 h-3" />
                      <span>WhatsApp</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => copyToClipboard(msg.content, msg.id)}
                      className="inline-flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors cursor-pointer"
                    >
                      {copiedId === msg.id ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span className="text-emerald-400 font-medium">Copié</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copier</span>
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* Timestamp & standard copy for assistant */}
                {!isUser && !isDraft && (
                  <div className="mt-2 flex items-center gap-3 text-[10px] text-slate-500">
                    <span>{msg.timestamp}</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(msg.content, msg.id)}
                      className="hover:text-slate-300 transition-colors cursor-pointer"
                    >
                      {copiedId === msg.id ? 'Copié' : 'Copier'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Loading Indicator */}
        {loading && (
          <div className="flex items-center gap-2 text-xs text-slate-500 py-2">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce [animation-delay:-0.3s]" />
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce [animation-delay:-0.15s]" />
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce" />
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* 5. MINIMAL QUICK ACTION CHIPS */}
      <div className="px-5 py-2 overflow-x-auto flex items-center gap-1.5 scrollbar-none border-t border-slate-900/60">
        {quickChips.map((chip, idx) => (
          <button
            key={idx}
            type="button"
            disabled={loading}
            onClick={() => sendMessage(chip.prompt)}
            className="px-2.5 py-1 rounded-full text-[11px] text-slate-400 hover:text-white bg-slate-900/80 hover:bg-slate-850 border border-slate-800/80 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-40"
          >
            {chip.label}
          </button>
        ))}
      </div>

      {/* 6. MINIMALIST FLOATING INPUT */}
      <div className="p-4 sm:p-5 pt-2">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage(input);
          }}
          className="relative flex items-center bg-slate-900/90 border border-slate-800/90 focus-within:border-slate-700 focus-within:ring-1 focus-within:ring-slate-700 rounded-2xl transition-all"
        >
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
            placeholder="Écrivez un message..."
            disabled={loading}
            className="flex-1 bg-transparent border-0 text-slate-100 text-xs sm:text-sm placeholder-slate-500 resize-none outline-none py-3 px-4 max-h-28"
          />

          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="p-2 mr-2 rounded-xl text-slate-400 hover:text-amber-400 disabled:opacity-20 disabled:hover:text-slate-400 transition-colors cursor-pointer"
            title="Envoyer"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
