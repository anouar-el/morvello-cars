import React, { useState, useEffect, useRef, useLayoutEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { AgentChatMessage } from '../types';
import { isAbortException } from '../initErrorHandling';
import { getScopedDataForUser } from '../utils/managerScopeUtils';
import { buildAssistantDigest } from '../lib/aiAssistantContext';
import { requestEntityFocus } from '../lib/entityFocus';
import { validateAction, PAYMENT_METHOD_LABELS, type AssistantAction } from '../lib/assistantActions';
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
  MessageSquare,
  Share2,
  AlertCircle,
  Info,
  Calendar,
  Car,
  FileText,
  User,
  ShieldCheck,
  Clock,
  ArrowDown,
  Bot,
  Zap,
} from 'lucide-react';

import { useI18n } from '../i18n/I18nContext';
interface MemberAiAssistantProps {
  isDrawer?: boolean;
  onClose?: () => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  /** Question à poser dès l'ouverture (ex. « Demander à l'assistant » depuis un contrat). */
  initialPrompt?: string | null;
  onInitialPromptHandled?: () => void;
}

const nowTime = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

/** Extraire le texte brut récursivement d'un nœud React pour la copie et le partage */
function nodeText(node: React.ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join('');
  if (React.isValidElement(node)) return nodeText((node.props as { children?: React.ReactNode }).children);
  return '';
}

/** Libellé calendaire élégant pour les séparateurs chronologiques */
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
  initialPrompt = null,
  onInitialPromptHandled,
}) => {
  const { t } = useI18n();
  const {
    currentUser,
    vehicles,
    contracts,
    clients,
    deposits,
    users,
    aiSettings,
    setActiveTab,
    addPaymentToContract,
    updateContractFinancials,
    hasPermission,
  } = useApp();

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [preferredLang, setPreferredLang] = useState<'fr' | 'ar'>('fr');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [lastFailedPrompt, setLastFailedPrompt] = useState<string | null>(null);

  const [messages, setMessages] = useState<AgentChatMessage[]>(() => {
    const saved = localStorage.getItem(`morvello_ai_chat_${currentUser.id}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      } catch {
        // fallback
      }
    }
    return [
      {
        id: 'welcome',
        role: 'model',
        content: t(
          "Bonjour **{name}**.\n\nJe suis votre assistant d'affaires exécutif Morvello Cars. Je peux vous accompagner sur le briefing opérationnel, la disponibilité de votre flotte, le suivi des cautions et la rédaction de communications clients.\n\nQue souhaitez-vous traiter aujourd'hui ?",
          { name: currentUser.name }
        ),
        timestamp: nowTime(),
        createdAt: new Date().toISOString(),
      },
    ];
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Quota quotidien de l'assistant (renvoyé par le serveur) : affiché près du champ de saisie.
  const [quota, setQuota] = useState<{ used: number; limit: number; remaining: number | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { token } = await getActiveAuthToken({ forceRefresh: false });
        if (!token) return;
        const res = await fetch('/api/assistant-usage', { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data?.quota) setQuota(data.quota);
      } catch {
        // le quota est un simple indicateur : on l'ignore s'il est indisponible
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentUser.id]);
  const isNearBottomRef = useRef(true);

  // Sauvegarde persistante de la conversation par collaborateur
  useEffect(() => {
    localStorage.setItem(`morvello_ai_chat_${currentUser.id}`, JSON.stringify(messages));
  }, [messages, currentUser.id]);

  // Défilement intelligent : ne force pas le retour en bas si l'utilisateur consulte l'historique
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (last?.role === 'user' || isNearBottomRef.current) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, loading]);

  // Ajustement automatique de la hauteur du champ de saisie
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [input]);

  // Interruption de toute requête en vol si le volet est fermé
  useEffect(() => () => abortControllerRef.current?.abort(), []);

  // Métriques cloisonnées à l'utilisateur
  const isAdmin = currentUser.role === 'admin';
  const { scopedVehicles: memberVehicles, scopedContracts: memberContracts } = getScopedDataForUser(
    currentUser,
    vehicles,
    contracts,
    deposits,
    clients,
    users
  );
  const availableCount = memberVehicles.filter((v) => v.status === 'available').length;
  const rentedCount = memberVehicles.filter((v) => v.status === 'rented').length;

  // Capacités réelles de Morvello Cars mappées pour l'onboarding et les actions rapides
  const capabilityCards = [
    {
      id: 'briefing',
      title: t('Briefing Opérationnel'),
      subtitle: t('Départs, retours et alertes du jour'),
      description: t('Départs et retours prévus, retards de restitution, soldes à encaisser et 3 priorités d’action.'),
      prompt:
        'Fais-moi le briefing opérationnel du jour : départs et retours d’aujourd’hui et de demain, retards de restitution, cautions non prises, soldes à encaisser et alertes véhicules. Termine par les 3 actions prioritaires.',
      icon: Calendar,
      tag: t('Opérations'),
    },
    {
      id: 'disponibilite',
      title: t('Disponibilité Flotte'),
      subtitle: t('Véhicules libres & tarifs journaliers'),
      description: t('Inventaire des véhicules disponibles groupés par gamme (citadine, SUV, prestige) avec immatriculation.'),
      prompt:
        'Liste mes véhicules actuellement disponibles, groupés par gamme (citadine, SUV, premium), avec immatriculation et tarif journalier.',
      icon: Car,
      tag: t('Flotte'),
    },
    {
      id: 'cautions',
      title: t('Cautions & Soldes'),
      subtitle: t('Régularisation financière'),
      description: t('Contrats actifs avec caution non encore retenue et soldes résiduels restant à encaisser.'),
      prompt:
        'Liste les cautions non prises et les soldes restant à encaisser sur mes contrats en cours, avec le montant et le client.',
      icon: ShieldCheck,
      tag: t('Finances'),
    },
    {
      id: 'alertes',
      title: t('Alertes Échéances'),
      subtitle: t('Conformité & entretien véhicule'),
      description: t('Assurances à renouveler, visites techniques imminentes, vidanges dépassées et vignettes annuelles.'),
      prompt:
        'Quelles sont les échéances à traiter sur ma flotte : assurances, visites techniques, vidanges et vignettes ?',
      icon: Clock,
      tag: t('Conformité'),
    },
    {
      id: 'accueil_whatsapp',
      title: t('Accueil Remise des Clés'),
      subtitle: t('Message WhatsApp de bienvenue'),
      description: t('Message WhatsApp courtois précisant l’heure de départ convenue et les pièces justificatives à fournir.'),
      prompt:
        'Rédige un court message WhatsApp d’accueil pour la remise des clés au client de mon prochain départ, avec les documents à présenter.',
      icon: MessageSquare,
      tag: t('Client'),
    },
    {
      id: 'rappel_restitution',
      title: t('Rappel Restitution'),
      subtitle: t('Restitution & niveau carburant'),
      description: t('Rappel cordial de l’heure de retour, du lieu convenu et de la remise du véhicule avec carburant identique.'),
      prompt:
        'Rédige un rappel WhatsApp courtois pour le client qui doit restituer son véhicule aujourd’hui (heure convenue, carburant à l’identique et restitution de caution).',
      icon: RotateCcw,
      tag: t('Client'),
    },
  ];

  // Puces contextuelles : le nombre d'éléments à traiter est calculé sur les données réelles de
  // l'utilisateur, et les sujets qui demandent une action passent en premier.
  const digest = buildAssistantDigest(new Date(), memberVehicles, memberContracts);
  const quickActionChips: { label: string; prompt: string; icon: typeof Calendar; count: number }[] = [
    {
      label: t('Briefing du jour'),
      prompt: capabilityCards[0].prompt,
      icon: Calendar,
      count: digest.departuresToday.length + digest.returnsToday.length,
    },
    {
      label: t('Retours & retards'),
      prompt:
        'Quels véhicules doivent revenir aujourd’hui et demain, et lesquels sont en retard ? Donne le client, le téléphone et l’heure prévue.',
      icon: Clock,
      count: digest.overdue.length,
    },
    {
      label: t('Cautions & soldes'),
      prompt: capabilityCards[2].prompt,
      icon: ShieldCheck,
      count: digest.depositsNotCollected.length + digest.unpaidBalances.length,
    },
    { label: t('Alertes flotte'), prompt: capabilityCards[3].prompt, icon: AlertCircle, count: digest.vehicleAlerts.length },
    { label: t('Véhicules dispo'), prompt: capabilityCards[1].prompt, icon: Car, count: 0 },
    { label: t('Accueil WhatsApp'), prompt: capabilityCards[4].prompt, icon: MessageSquare, count: 0 },
  ]
    .map((chip, order) => ({ chip, order }))
    .sort((a, b) => Number(b.chip.count > 0) - Number(a.chip.count > 0) || a.order - b.order)
    .map(({ chip }) => chip);

  /** Exécute une action proposée, après clic explicite. Revalide sur les données du moment ; le résultat est mémorisé. */
  const runAction = (messageId: string, action: AssistantAction) => {
    const setResult = (ok: boolean, text: string) =>
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId ? { ...m, actionResults: { ...(m.actionResults || {}), [action.id]: { ok, text } } } : m
        )
      );

    const contract = contracts.find((c) => c.id === action.contractId);
    const check = validateAction(action, contract);
    if (!check.ok) return setResult(false, check.error || 'Action impossible.');

    try {
      if (action.type === 'whatsapp') {
        window.open(`https://wa.me/${action.phone}?text=${encodeURIComponent(action.message || '')}`, '_blank', 'noopener');
        return setResult(true, t('WhatsApp ouvert : relisez puis envoyez.'));
      }
      if (action.type === 'deposit_collected') {
        if (!hasPermission('canCollectDeposit')) return setResult(false, t('Vous n’avez pas le droit d’enregistrer une caution.'));
        updateContractFinancials(
          action.contractId,
          { depositAmount: Number(contract?.depositAmount) || 0, depositCollected: true },
          currentUser.name
        );
        return setResult(true, t('Caution marquée comme prise.'));
      }
      if (action.type === 'payment') {
        const updated = addPaymentToContract(
          action.contractId,
          { amount: Number(action.amount), method: action.method!, notes: 'Enregistré depuis l’assistant IA' },
          currentUser.name
        );
        return updated
          ? setResult(true, t('Règlement de {amount} MAD enregistré.', { amount: action.amount ?? 0 }))
          : setResult(false, t('Le règlement n’a pas pu être enregistré.'));
      }
    } catch {
      setResult(false, t('L’action a échoué. Réessayez depuis le contrat.'));
    }
  };

  const openSource = (source: NonNullable<AgentChatMessage['sources']>[number]) => {
    requestEntityFocus(source.kind, source.search);
    setActiveTab(source.kind === 'contract' ? 'contracts' : source.kind === 'vehicle' ? 'vehicles' : 'clients');
    if (isDrawer) onClose?.();
  };

  const stopGenerating = () => {
    abortControllerRef.current?.abort();
  };

  const sendMessage = async (userPrompt: string) => {
    if (!userPrompt.trim() || loading) return;

    let finalPrompt = userPrompt.trim();
    if (preferredLang === 'ar' && !finalPrompt.toLowerCase().includes('arabe') && !finalPrompt.includes('العربية')) {
      finalPrompt = `${finalPrompt} (Rédige la réponse en langue arabe professionnelle et soignée / باللغة العربية الفصحى المهنية).`;
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
    setLoading(true);
    setLastFailedPrompt(null);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
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
        stream: true,
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
        new Error(t('Votre session a été fermée (déconnexion ou expiration). Veuillez vous reconnecter.'));

      let res = await postChat(false);
      if (res.status === 401) {
        const first = await readAuthError(res);
        if (first.code === SESSION_TERMINATED) {
          await endTerminatedSession();
          throw sessionClosedError();
        }
        res = await postChat(true);
      }
      if (res.status === 401) {
        const second = await readAuthError(res);
        if (second.code === SESSION_TERMINATED || !sentProvider) {
          await endTerminatedSession();
          throw sessionClosedError();
        }
        throw new Error(
          t('Connexion refusée par le serveur : {error}. Veuillez vous reconnecter.', {
            error: second.error || t('Jeton invalide'),
          })
        );
      }

      // Réponse en flux (NDJSON) : le texte s'affiche au fur et à mesure.
      if (res.ok && (res.headers.get('content-type') || '').includes('application/x-ndjson') && res.body) {
        const streamId = `model-${Date.now()}`;
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let text = '';
        let streamError: string | null = null;
        let finished = false;

        const handleLine = (line: string) => {
          if (!line.trim()) return;
          let evt: any;
          try {
            evt = JSON.parse(line);
          } catch {
            return;
          }
          if (evt.type === 'delta' && typeof evt.text === 'string') {
            text += evt.text;
            const snapshot = text;
            setStreamingId(streamId);
            setMessages((prev) =>
              prev.some((m) => m.id === streamId)
                ? prev.map((m) => (m.id === streamId ? { ...m, content: snapshot } : m))
                : [
                    ...prev,
                    {
                      id: streamId,
                      role: 'model',
                      content: snapshot,
                      timestamp: nowTime(),
                      createdAt: new Date().toISOString(),
                    },
                  ]
            );
          } else if (evt.type === 'sources' && Array.isArray(evt.items)) {
            const items = evt.items.filter(
              (s: any) => s && typeof s.id === 'string' && typeof s.label === 'string' && typeof s.search === 'string'
            );
            setMessages((prev) => prev.map((m) => (m.id === streamId ? { ...m, sources: items } : m)));
          } else if (evt.type === 'actions' && Array.isArray(evt.items)) {
            const items = evt.items.filter((a: any) => a && a.kind === 'action' && typeof a.id === 'string');
            setMessages((prev) => prev.map((m) => (m.id === streamId ? { ...m, actions: items } : m)));
          } else if (evt.type === 'error') {
            streamError = typeof evt.error === 'string' ? evt.error : t('Réponse indisponible.');
          } else if (evt.type === 'done') {
            finished = true;
            if (evt.quota) setQuota(evt.quota);
          }
        };

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            lines.forEach(handleLine);
          }
          buffer += decoder.decode();
          handleLine(buffer);
        } finally {
          setStreamingId(null);
        }

        if (streamError) throw new Error(streamError);
        if (!text && !finished) throw new Error(t('Réponse indisponible.'));
        return;
      }

      let data: any = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }
      if (res.status === 429 && data?.code === 'QUOTA_EXCEEDED') {
        if (data.quota) setQuota(data.quota);
        throw new Error(data.error || t('Quota quotidien de l’assistant atteint.'));
      }
      if (res.status === 429) {
        throw new Error(
          t('Trop de demandes simultanées. Veuillez patienter {seconds} secondes.', { seconds: data?.retryAfterSeconds || 60 })
        );
      }
      if (res.status === 403) {
        throw new Error(
          data?.error || t('Accès refusé : votre compte ne dispose pas d’un profil collaborateur actif dans cette agence.')
        );
      }
      if (!res.ok) {
        throw new Error(data?.error || t('Le service IA ne répond pas (code {status}).', { status: res.status }));
      }

      if (data?.quota) setQuota(data.quota);
      if (data?.success && data.reply) {
        const assistantMsg: AgentChatMessage = {
          id: `model-${Date.now()}`,
          role: 'model',
          content: data.reply,
          sources: Array.isArray(data.sources) ? data.sources : undefined,
          actions: Array.isArray(data.actions) && data.actions.length ? data.actions : undefined,
          timestamp: nowTime(),
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } else {
        throw new Error(data?.error || t('Réponse indisponible.'));
      }
    } catch (err: any) {
      if (isAbortException(err)) {
        setMessages((prev) => [
          ...prev,
          {
            id: `stopped-${Date.now()}`,
            role: 'model',
            content: t('Génération interrompue par l’utilisateur.'),
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
        content: t('Une difficulté est survenue : {message}.', {
          message: err.message || t('Service momentanément indisponible'),
        }),
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

  useEffect(() => {
    if (!initialPrompt || loading) return;
    onInitialPromptHandled?.();
    sendMessage(initialPrompt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPrompt]);

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
    const resetMsg: AgentChatMessage[] = [
      {
        id: 'welcome-reset',
        role: 'model',
        content: t('Historique réinitialisé. Comment puis-je vous accompagner, **{name}** ?', { name: currentUser.name }),
        timestamp: nowTime(),
        createdAt: new Date().toISOString(),
      },
    ];
    setMessages(resetMsg);
    localStorage.removeItem(`morvello_ai_chat_${currentUser.id}`);
    setShowClearConfirm(false);
    setLastFailedPrompt(null);
  };

  const filteredMessages = useMemo(() => {
    if (!searchQuery.trim()) return messages;
    const q = searchQuery.toLowerCase();
    return messages.filter((m) => m.content.toLowerCase().includes(q));
  }, [messages, searchQuery]);

  const onlyWelcome = messages.length <= 1;
  const showHero = onlyWelcome && !searchQuery.trim();
  const lastErrorId = [...messages].reverse().find((m) => m.id.startsWith('err-'))?.id;

  /**
   * Rendu Markdown haute fidélité adapté à la lecture soutenue de rapports d'affaires
   */
  const markdownComponents = (msgId: string) => ({
    p: ({ children }: { children?: React.ReactNode }) => (
      <p dir="auto" className="my-2 text-[13.5px] sm:text-[14px] text-slate-300 leading-relaxed font-normal">{children}</p>
    ),
    h1: ({ children }: { children?: React.ReactNode }) => (
      <h1 dir="auto" className="text-base sm:text-lg font-bold text-white tracking-tight mt-4 mb-2 pb-1.5 border-b border-slate-800">
        {children}
      </h1>
    ),
    h2: ({ children }: { children?: React.ReactNode }) => (
      <h2 dir="auto" className="text-sm sm:text-base font-semibold text-amber-400 mt-3.5 mb-1.5 flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
        <span>{children}</span>
      </h2>
    ),
    h3: ({ children }: { children?: React.ReactNode }) => (
      <h3 dir="auto" className="text-xs sm:text-sm font-semibold text-slate-200 mt-2.5 mb-1">{children}</h3>
    ),
    strong: ({ children }: { children?: React.ReactNode }) => (
      <strong className="font-semibold text-white">{children}</strong>
    ),
    em: ({ children }: { children?: React.ReactNode }) => (
      <em className="italic text-slate-300">{children}</em>
    ),
    ul: ({ children }: { children?: React.ReactNode }) => (
      <ul className="my-2.5 ps-5 space-y-1.5 list-disc marker:text-amber-500/80 text-[13.5px] sm:text-[14px] text-slate-300 leading-relaxed">
        {children}
      </ul>
    ),
    ol: ({ children }: { children?: React.ReactNode }) => (
      <ol className="my-2.5 ps-5 space-y-1.5 list-decimal marker:text-amber-400 font-medium text-[13.5px] sm:text-[14px] text-slate-300 leading-relaxed">
        {children}
      </ol>
    ),
    li: ({ children }: { children?: React.ReactNode }) => (
      <li dir="auto" className="leading-relaxed">{children}</li>
    ),
    a: ({ children, href }: { children?: React.ReactNode; href?: string }) => (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-amber-400 hover:text-amber-300 underline underline-offset-2 transition-colors cursor-pointer"
      >
        {children}
      </a>
    ),
    hr: () => <hr className="my-3.5 border-slate-800" />,
    blockquote: ({ children }: { children?: React.ReactNode }) => (
      <div className="not-prose my-3 flex gap-3 rounded-xl border border-amber-500/30 bg-amber-950/20 px-4 py-3 shadow-xs">
        <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <div className="text-[13px] text-slate-300 leading-relaxed [&>p]:my-0">{children}</div>
      </div>
    ),
    table: ({ children }: { children?: React.ReactNode }) => (
      <div className="not-prose my-3.5 overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/60 shadow-xs">
        <table className="w-full text-start text-xs border-collapse">{children}</table>
      </div>
    ),
    thead: ({ children }: { children?: React.ReactNode }) => (
      <thead className="bg-slate-900 text-slate-200 font-semibold border-b border-slate-800">
        {children}
      </thead>
    ),
    th: ({ children }: { children?: React.ReactNode }) => (
      <th className="px-3.5 py-2.5 text-xs font-semibold text-slate-300 whitespace-nowrap">{children}</th>
    ),
    td: ({ children }: { children?: React.ReactNode }) => (
      <td className="px-3.5 py-2 border-t border-slate-800/70 text-slate-300 whitespace-nowrap sm:whitespace-normal">
        {children}
      </td>
    ),
    pre: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
    code: ({ className, children }: { className?: string; children?: React.ReactNode }) => {
      const raw = nodeText(children).replace(/\n$/, '');
      const langMatch = /language-(\w+)/.exec(className || '');
      const isBlock = Boolean(langMatch) || raw.includes('\n');

      if (!isBlock) {
        return (
          <code className="px-1.5 py-0.5 rounded text-xs font-mono bg-slate-800 text-amber-300 border border-slate-750 font-medium">
            {children}
          </code>
        );
      }

      const blockId = `${msgId}-${raw.length}-${raw.slice(0, 16)}`;

      // Bloc sans langage spécifié : détecté comme message client WhatsApp / SMS
      if (!langMatch) {
        return (
          <div className="not-prose my-3 rounded-xl overflow-hidden border border-emerald-500/30 bg-emerald-950/20 shadow-xs">
            <div className="flex items-center justify-between px-3.5 py-2 bg-emerald-500/10 border-b border-emerald-500/20">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 uppercase tracking-wide">
                <MessageSquare className="w-3.5 h-3.5" />
                {t('Message Client Proposé')}
              </span>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => copyToClipboard(raw, blockId)}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-800 transition-colors cursor-pointer"
                  title={t('Copier le texte du message')}
                >
                  {copiedId === blockId ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-400 font-medium">{t('Copié')}</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>{t('Copier')}</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => shareViaWhatsApp(raw)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-500 text-slate-950 font-semibold text-xs hover:bg-emerald-400 transition-colors cursor-pointer shadow-xs"
                  title={t('Ouvrir dans WhatsApp')}
                >
                  <Share2 className="w-3 h-3" />
                  <span>{t('WhatsApp')}</span>
                </button>
              </div>
            </div>
            <div dir="auto" className="p-3.5 whitespace-pre-wrap text-[13px] leading-relaxed text-slate-200 select-text font-sans">
              {raw}
            </div>
          </div>
        );
      }

      // Bloc de code technique standard (JSON, SQL, CSV...)
      return (
        <div className="not-prose my-3 rounded-xl overflow-hidden border border-slate-800 bg-slate-950 shadow-xs">
          <div className="flex items-center justify-between px-3.5 py-1.5 bg-slate-900 border-b border-slate-800 text-[11px] font-mono text-slate-400">
            <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider">
              {langMatch[1]}
            </span>
            <button
              type="button"
              onClick={() => copyToClipboard(raw, blockId)}
              className="inline-flex items-center gap-1 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              {copiedId === blockId ? (
                <>
                  <Check className="w-3 h-3 text-emerald-400" />
                  <span className="text-emerald-400 font-medium">{t('Copié')}</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>{t('Copier')}</span>
                </>
              )}
            </button>
          </div>
          <pre className="p-3.5 overflow-x-auto text-xs font-mono text-slate-200 leading-relaxed">
            <code>{raw}</code>
          </pre>
        </div>
      );
    },
  });

  let previousDay: string | null = null;

  return (
    <div
      className={`flex flex-col bg-slate-950 text-slate-100 overflow-hidden select-text relative ${
        isDrawer
          ? 'h-full w-full'
          : 'h-[calc(100dvh-8.5rem)] min-h-[620px] max-w-5xl mx-auto rounded-2xl border border-slate-800 shadow-2xl'
      }`}
    >
      {/* 1. HEADER EXÉCUTIF COMPACT & PRESTIGE */}
      <header className="px-4 sm:px-6 py-3 border-b border-slate-800/90 bg-slate-900/90 backdrop-blur-md flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500/20 via-slate-900 to-amber-900/30 border border-amber-500/30 text-amber-400 shadow-xs shrink-0">
            <Bot className="w-5 h-5 text-amber-400" />
            <span className="absolute -bottom-0.5 -end-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-slate-950" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-bold text-white tracking-tight leading-tight truncate">
                {t('Morvello AI')}
              </h1>
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-amber-400/90 font-medium">
                {t("· Assistant d'Affaires")}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-normal truncate">
              {loading ? (
                <span className="text-amber-400 animate-pulse">{t('Réflexion et calcul en cours…')}</span>
              ) : (
                <>
                  <span className="text-emerald-400 font-medium">{t('● Prêt')}</span>
                  <span className="text-slate-600 mx-1.5">·</span>
                  <span>{t('{availableCount} véhicule(s) libre(s)', { availableCount })}</span>
                  <span className="text-slate-600 mx-1.5">·</span>
                  <span>{t('{rentedCount} en location', { rentedCount })}</span>
                </>
              )}
            </p>
          </div>
        </div>

        {/* Contrôles & Actions En-tête */}
        <div className="flex items-center gap-1 sm:gap-1.5">
          {/* Bascule Langue (FR / Arabe) */}
          <div className="flex items-center p-0.5 bg-slate-950/80 rounded-lg border border-slate-800">
            <button
              type="button"
              onClick={() => setPreferredLang('fr')}
              className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                preferredLang === 'fr'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
              title={t('Réponses en Français')}
            >
              {t('FR')}
            </button>
            <button
              type="button"
              onClick={() => setPreferredLang('ar')}
              className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                preferredLang === 'ar'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
              title={t('Réponses en langue arabe')}
            >
              {t('العربية (Arabe)')}
            </button>
          </div>

          {/* Recherche dans la discussion */}
          <button
            type="button"
            onClick={() => setShowSearch(!showSearch)}
            className={`p-2 rounded-lg transition-colors cursor-pointer border ${
              showSearch
                ? 'text-amber-400 bg-slate-800 border-amber-500/40'
                : 'text-slate-400 hover:text-white bg-slate-950/60 border-slate-800 hover:bg-slate-850'
            }`}
            title={t('Rechercher dans la conversation')}
            aria-label={t('Rechercher')}
          >
            <Search className="w-3.5 h-3.5" />
          </button>

          {/* Paramètres Charte IA pour Admin */}
          {isAdmin && (
            <button
              type="button"
              onClick={() => {
                if (onClose) onClose();
                setActiveTab('settings');
              }}
              className="p-2 text-slate-400 hover:text-white bg-slate-950/60 border border-slate-800 hover:bg-slate-850 rounded-lg transition-colors cursor-pointer"
              title={t('Personnaliser les directives et la charte IA')}
              aria-label={t('Paramètres IA')}
            >
              <Sliders className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Réinitialiser la discussion */}
          <button
            type="button"
            onClick={() => setShowClearConfirm(true)}
            className="p-2 text-slate-400 hover:text-rose-400 bg-slate-950/60 border border-slate-800 hover:bg-slate-850 rounded-lg transition-colors cursor-pointer"
            title={t('Effacer la conversation')}
            aria-label={t('Effacer la conversation')}
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* Bascule Largeur Volet (mode tiroir) */}
          {isDrawer && onToggleExpand && (
            <button
              type="button"
              onClick={onToggleExpand}
              className="hidden sm:inline-flex p-2 text-slate-400 hover:text-white bg-slate-950/60 border border-slate-800 hover:bg-slate-850 rounded-lg transition-colors cursor-pointer"
              title={isExpanded ? t('Réduire le volet') : t('Agrandir le volet')}
              aria-label={t('Basculer largeur')}
            >
              {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
          )}

          {/* Fermeture Volet (mode tiroir) */}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white bg-slate-950/60 border border-slate-800 hover:bg-slate-850 rounded-lg transition-colors cursor-pointer"
              title={t('Fermer le volet')}
              aria-label={t('Fermer')}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </header>

      {/* 2. BARRE DE RECHERCHE DÉPLIABLE */}
      {showSearch && (
        <div className="px-4 sm:px-6 py-2 border-b border-slate-800 bg-slate-900/90 backdrop-blur-xs flex items-center gap-2.5 transition-all">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('Filtrer les messages par mot-clé…')}
            className="w-full bg-transparent border-0 text-xs text-white placeholder-slate-500 focus:outline-none"
            autoFocus
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="text-slate-400 hover:text-white text-xs px-2 py-0.5 rounded cursor-pointer"
            >
              {t('Effacer')}
            </button>
          )}
        </div>
      )}

      {/* 3. ALERTE DE CONFIRMATION DE RÉINITIALISATION */}
      {showClearConfirm && (
        <div className="px-4 sm:px-6 py-3 bg-slate-900/95 border-b border-rose-500/30 text-xs flex items-center justify-between text-slate-200">
          <span className="font-medium">{t("Effacer l'historique complet de cette conversation ?")}</span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowClearConfirm(false)}
              className="px-2.5 py-1 text-slate-400 hover:text-white rounded-md transition-colors cursor-pointer"
            >
              {t('Annuler')}
            </button>
            <button
              type="button"
              onClick={handleClearHistory}
              className="px-3 py-1 bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 rounded-md font-semibold transition-colors cursor-pointer border border-rose-500/30"
            >
              {t('Confirmer')}
            </button>
          </div>
        </div>
      )}

      {/* 4. FLUX DE CONVERSATION & ZONE DE LECTURE OPTIMISÉE */}
      <div className="relative flex-1 min-h-0">
        <div
          ref={scrollRef}
          onScroll={(e) => {
            const el = e.currentTarget;
            const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
            isNearBottomRef.current = distance < 120;
            setShowScrollDown(distance > 180);
          }}
          className="absolute inset-0 overflow-y-auto px-4 sm:px-6 py-6"
        >
          <div className="max-w-3xl mx-auto w-full">
            {/* Mention de cloisonnement strict des données */}
            <div className="flex justify-center mb-6">
              <span className="text-[11px] text-slate-400 bg-slate-900/80 border border-slate-800 rounded-full px-3.5 py-1.5 text-center flex items-center gap-1.5 shadow-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400/80" />
                {t('Données strictement cloisonnées à')} {isAdmin ? t('votre agence') : t('votre flotte et vos contrats')}.
              </span>
            </div>

            {/* ONBOARDING ÉLÉGANT & SUGGESTIONS OPÉRATIONNELLES */}
            {showHero ? (
              <div className="flex flex-col items-center text-center px-2 py-4 sm:py-8 animate-fade-in">
                <div className="relative mb-4 flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500/20 via-slate-900 to-amber-950/40 border border-amber-500/30 text-amber-400 shadow-lg">
                  <Bot className="w-8 h-8 text-amber-400" />
                  <span className="absolute -bottom-1 -end-1 w-3.5 h-3.5 rounded-full bg-emerald-400 ring-2 ring-slate-950" />
                </div>
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white mb-2">
                  {t('Morvello AI')}
                </h2>
                <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto leading-relaxed mb-8">
                  {t("Votre conseiller d'affaires opérationnel : briefing matinal, suivi des retours, surveillance des cautions et rédaction de messages clients de prestige.")}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full text-start">
                  {capabilityCards.map((card) => {
                    const IconComponent = card.icon;
                    return (
                      <button
                        key={card.id}
                        type="button"
                        disabled={loading}
                        onClick={() => sendMessage(card.prompt)}
                        className="flex flex-col p-4 rounded-xl border border-slate-800/90 bg-slate-900/60 hover:bg-slate-850/80 hover:border-amber-500/40 transition-all group cursor-pointer disabled:opacity-50 text-start shadow-xs"
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 group-hover:scale-105 transition-transform">
                              <IconComponent className="w-4 h-4" />
                            </div>
                            <span className="text-xs font-semibold text-slate-200 group-hover:text-amber-400 transition-colors">
                              {card.title}
                            </span>
                          </div>
                          <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                            {card.tag}
                          </span>
                        </div>
                        <p className="text-[11.5px] text-slate-400 leading-relaxed mt-1 line-clamp-2">
                          {card.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : filteredMessages.length === 0 ? (
              <p className="text-center text-xs text-slate-500 py-12">
                {t('Aucun message ne correspond à votre recherche « {searchQuery} ».', { searchQuery })}
              </p>
            ) : (
              <div className="space-y-6">
                {filteredMessages.map((msg) => {
                  const isUser = msg.role === 'user';
                  const isError = msg.id.startsWith('err-');
                  const isStopped = msg.id.startsWith('stopped-');

                  const label = dayLabel(msg.createdAt);
                  const showDay = label !== null && label !== previousDay;
                  if (label) previousDay = label;

                  return (
                    <React.Fragment key={msg.id}>
                      {showDay && (
                        <div className="flex items-center my-6">
                          <div className="flex-1 h-px bg-slate-800/80" />
                          <span className="px-3 text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                            {label}
                          </span>
                          <div className="flex-1 h-px bg-slate-800/80" />
                        </div>
                      )}

                      {isStopped ? (
                        <div className="flex justify-center my-2">
                          <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 italic bg-slate-900/60 border border-slate-800 rounded-full px-3 py-1">
                            <Square className="w-3 h-3 text-slate-500" />
                            {msg.content}
                          </span>
                        </div>
                      ) : isUser ? (
                        <div className="flex flex-col items-end">
                          <div className="max-w-[85%] sm:max-w-[75%] bg-slate-800/95 text-slate-100 border border-slate-700/60 rounded-2xl rounded-tr-xs px-4 py-3 shadow-xs">
                            <p dir="auto" className="text-[13.5px] sm:text-[14px] leading-relaxed whitespace-pre-wrap select-text font-normal">
                              {msg.content}
                            </p>
                          </div>
                          <span className="text-[11px] text-slate-500 font-mono mt-1 me-1">
                            {msg.timestamp}
                          </span>
                        </div>
                      ) : (
                        <div className="group flex flex-col items-start w-full">
                          {/* En-tête du message Assistant */}
                          <div className="flex items-center gap-2 mb-1.5 px-0.5">
                            <div className="w-5 h-5 rounded-md bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                              <Bot className="w-3 h-3" />
                            </div>
                            <span className="text-xs font-semibold text-slate-300">
                              {isError ? t('Notification') : t('Morvello AI')}
                            </span>
                            <span className="text-[11px] text-slate-500 font-mono">
                              {msg.timestamp}
                            </span>
                            {!isError && (
                              <button
                                type="button"
                                onClick={() => copyToClipboard(msg.content, msg.id)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity ms-2 text-[11px] text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
                                title={t('Copier la réponse complète')}
                              >
                                {copiedId === msg.id ? (
                                  <>
                                    <Check className="w-3 h-3 text-emerald-400" />
                                    <span className="text-emerald-400">{t('Copié')}</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3 h-3" />
                                    <span>{t('Copier')}</span>
                                  </>
                                )}
                              </button>
                            )}
                          </div>

                          {/* Contenu du message */}
                          <div
                            className={`w-full text-slate-200 select-text ${
                              isError
                                ? 'p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-200 text-xs sm:text-[13px] leading-relaxed'
                                : 'text-[13.5px] sm:text-[14px] leading-relaxed ps-7'
                            }`}
                          >
                            {isError ? (
                              <div className="space-y-2">
                                <div className="flex items-center gap-2 font-semibold text-rose-300">
                                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                                  <span>{t('Difficulté de traitement')}</span>
                                </div>
                                <p className="leading-relaxed text-rose-200/90">{msg.content}</p>
                                {msg.id === lastErrorId && lastFailedPrompt && !loading && (
                                  <button
                                    type="button"
                                    onClick={() => sendMessage(lastFailedPrompt)}
                                    className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/40 text-xs font-medium transition-colors cursor-pointer"
                                  >
                                    <RotateCcw className="w-3 h-3" />
                                    <span>{t('Réessayer la requête')}</span>
                                  </button>
                                )}
                              </div>
                            ) : (
                              <>
                                <Markdown remarkPlugins={[remarkGfm]} components={markdownComponents(msg.id)}>
                                  {msg.content}
                                </Markdown>
                                {msg.actions && msg.actions.length > 0 && (
                                  <div className="mt-3 space-y-2">
                                    {msg.actions.map((a) => {
                                      const result = msg.actionResults?.[a.id];
                                      return (
                                        <div
                                          key={a.id}
                                          className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs"
                                        >
                                          <div className="font-semibold text-amber-300">{a.title}</div>
                                          <div className="mt-0.5 text-slate-400 font-mono">{t('Contrat {contractNumber}', { contractNumber: a.contractNumber })}</div>
                                          {a.type === 'whatsapp' && a.message && (
                                            <div className="mt-2 whitespace-pre-wrap rounded-lg bg-slate-950/70 border border-slate-800 p-2 text-slate-200">
                                              {a.message}
                                            </div>
                                          )}
                                          {a.type === 'payment' && a.method && (
                                            <div className="mt-1 text-slate-300">
                                              {t('{amount} MAD ·', { amount: a.amount })} {PAYMENT_METHOD_LABELS[a.method]}
                                            </div>
                                          )}
                                          {result ? (
                                            <div className={`mt-2 ${result.ok ? 'text-emerald-400' : 'text-rose-400'}`}>
                                              {result.ok ? '✓ ' : '✕ '}
                                              {result.text}
                                            </div>
                                          ) : (
                                            <button
                                              type="button"
                                              onClick={() => runAction(msg.id, a)}
                                              className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs cursor-pointer"
                                            >
                                              {a.type === 'whatsapp' ? t('Ouvrir WhatsApp') : t('Confirmer')}
                                            </button>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                                {msg.sources && msg.sources.length > 0 && (
                                  <div className="mt-3 pt-2.5 border-t border-slate-800/80">
                                    <div className="text-[10.5px] uppercase tracking-wide text-slate-500 mb-1.5">
                                      {t('Sources consultées')}
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                      {msg.sources.map((s) => (
                                        <button
                                          key={`${s.kind}:${s.id}`}
                                          type="button"
                                          onClick={() => openSource(s)}
                                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/40 transition-colors cursor-pointer max-w-full"
                                          title={t('Ouvrir dans l’application')}
                                        >
                                          {s.kind === 'contract' ? (
                                            <FileText className="w-3 h-3 text-amber-400 shrink-0" />
                                          ) : s.kind === 'vehicle' ? (
                                            <Car className="w-3 h-3 text-amber-400 shrink-0" />
                                          ) : (
                                            <User className="w-3 h-3 text-amber-400 shrink-0" />
                                          )}
                                          <span className="truncate">{s.label}</span>
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}

                {/* État de réflexion & chargement sophistiqué */}
                {loading && !streamingId && (
                  <div className="flex flex-col items-start w-full animate-fade-in ps-7">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-5 h-5 rounded-md bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                        <Sparkles className="w-3 h-3 animate-spin [animation-duration:3s]" />
                      </div>
                      <span className="text-xs font-semibold text-slate-300">{t('Morvello AI')}</span>
                      <span className="text-[11px] text-amber-400/90 font-normal">{t('Analyse en cours…')}</span>
                    </div>
                    <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/60 max-w-md w-full space-y-2">
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span>{t('Traitement des données de flotte et rédaction')}</span>
                        <button
                          type="button"
                          onClick={stopGenerating}
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-400 hover:text-rose-300 transition-colors cursor-pointer"
                        >
                          <Square className="w-3 h-3" />
                          <span>{t('Arrêter')}</span>
                        </button>
                      </div>
                      <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-amber-500 to-amber-300 rounded-full animate-pulse w-3/4" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div ref={chatEndRef} />
          </div>
        </div>

        {/* Bouton flottant pour sauter aux derniers messages */}
        {showScrollDown && (
          <button
            type="button"
            onClick={() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })}
            className="absolute bottom-4 end-6 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-700 text-slate-200 text-xs font-medium shadow-xl hover:bg-slate-800 transition-all cursor-pointer animate-fade-in"
          >
            <span>{t('Derniers messages')}</span>
            <ArrowDown className="w-3.5 h-3.5 text-amber-400" />
          </button>
        )}
      </div>

      {/* 5. BANDE D'ACTIONS RAPIDES HORIZONTALE */}
      <div className="px-4 sm:px-6 py-2 overflow-x-auto flex items-center gap-1.5 border-t border-slate-900 bg-slate-950/80 shrink-0 scrollbar-none">
        {quickActionChips.map((chip, idx) => {
          const IconComp = chip.icon;
          return (
            <button
              key={idx}
              type="button"
              disabled={loading}
              onClick={() => sendMessage(chip.prompt)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-40"
            >
              <IconComp className="w-3 h-3 text-amber-400 shrink-0" />
              <span>{chip.label}</span>
              {chip.count > 0 && (
                <span className="ms-0.5 min-w-[18px] px-1 rounded-full bg-amber-500/20 text-amber-300 text-[11px] font-semibold text-center">
                  {chip.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 6. COMPOSITEUR DE COMMANDE EXÉCUTIF */}
      <div className="px-3 sm:px-6 pb-3 pt-1 border-t border-slate-800/80 bg-slate-950 shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage(input);
          }}
          className="border border-slate-800 bg-slate-900/90 focus-within:border-amber-500/50 focus-within:ring-2 focus-within:ring-amber-500/10 rounded-2xl p-2.5 transition-all shadow-lg"
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
            placeholder={
              preferredLang === 'ar'
                ? t('اكتب سؤالك هنا باللغة العربية… (Posez votre question en langue arabe)')
                : t('Posez une question sur votre flotte, un contrat, un client ou demandez une rédaction…')
            }
            disabled={loading}
            className="w-full bg-transparent border-0 text-xs sm:text-[13.5px] text-white placeholder-slate-500 resize-none outline-none no-focus-ring leading-relaxed max-h-[140px] px-1.5 py-1 disabled:opacity-50"
          />

          <div className="flex items-center justify-between pt-1 border-t border-slate-800/60 mt-1">
            <span className="hidden sm:inline text-[10.5px] text-slate-400 font-mono">
              {quota && quota.limit > 0
                ? t('{remaining} demande(s) restante(s) aujourd’hui', { remaining: quota.remaining ?? 0 })
                : t('Entrée pour envoyer · Maj + Entrée pour nouvelle ligne')}
            </span>
            <span className="sm:hidden text-[11px] text-slate-400 font-mono">
              {quota && quota.limit > 0
                ? t('{remaining} restante(s)', { remaining: quota.remaining ?? 0 })
                : preferredLang === 'ar'
                ? t('العربية')
                : t('Français')}
            </span>

            <div className="flex items-center gap-2 ms-auto">
              {loading ? (
                <button
                  type="button"
                  onClick={stopGenerating}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-semibold transition-colors cursor-pointer"
                  title={t('Interrompre la génération')}
                >
                  <Square className="w-3.5 h-3.5" />
                  <span>{t('Arrêter')}</span>
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!input.trim()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-xs transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                  title={t('Envoyer la requête')}
                >
                  <span>{t('Envoyer')}</span>
                  <Send className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
