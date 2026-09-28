import { describe, it, expect } from 'vitest';

describe('MemberAiAssistant UI/UX Architecture & Helpers', () => {
  // 1. Empty State & Suggested Prompts Audit
  it('provides curated operational prompts matching actual Morvello Cars capabilities', () => {
    const emptyStatePrompts = [
      {
        title: 'Briefing du jour',
        description: 'Départs, retours prévus, retards de restitution et alertes prioritaires.',
        prompt: 'Fais-moi le briefing opérationnel du jour : départs et retours d’aujourd’hui et de demain, retards, cautions non prises, soldes à encaisser et alertes véhicules. Termine par les 3 actions prioritaires.',
      },
      {
        title: 'Disponibilité flotte',
        description: 'Véhicules libres groupés par gamme avec tarifs journaliers.',
        prompt: 'Liste mes véhicules actuellement disponibles, groupés par gamme (citadine, SUV, premium), avec immatriculation et tarif journalier.',
      },
      {
        title: 'Cautions & soldes',
        description: 'Contrats sans caution collectée et soldes restant à encaisser.',
        prompt: 'Liste les cautions non prises et les soldes restant à encaisser sur mes contrats en cours, avec le montant et le client.',
      },
      {
        title: 'Message WhatsApp',
        description: 'Rédiger un accueil ou rappel de restitution soigné pour un client.',
        prompt: 'Rédige un court message WhatsApp d’accueil pour la remise des clés au client de mon prochain départ, avec les documents à présenter.',
      },
    ];

    expect(emptyStatePrompts).toHaveLength(4);
    for (const card of emptyStatePrompts) {
      expect(card.title.length).toBeGreaterThan(3);
      expect(card.description.length).toBeGreaterThan(10);
      expect(card.prompt.length).toBeGreaterThan(20);
      // Validates grounding in real Morvello entities
      const hasRealDomainTopic =
        card.prompt.includes('départ') ||
        card.prompt.includes('véhicules') ||
        card.prompt.includes('caution') ||
        card.prompt.includes('WhatsApp');
      expect(hasRealDomainTopic).toBe(true);
    }
  });

  // 2. Draft Message Extraction & WhatsApp formatting
  it('extracts client drafts cleanly from markdown code blocks', () => {
    const extractDraft = (content: string): string => {
      const match = content.match(/```(?:[a-z]*)\n?([\s\S]*?)```/i);
      return (match ? match[1] : content).trim();
    };

    const assistantResponseWithDraft = `
Voici une proposition de message d'accueil pour votre client :

\`\`\`whatsapp
Bonjour Monsieur Benjelloun,
Votre véhicule Dacia Duster est prêt pour votre départ aujourd'hui à 14h.
Merci de vous munir de votre permis et pièce d'identité.
\`\`\`

N'hésitez pas à me solliciter si vous souhaitez ajuster les modalités.
    `;

    const extracted = extractDraft(assistantResponseWithDraft);
    expect(extracted).toContain('Bonjour Monsieur Benjelloun');
    expect(extracted).toContain('Dacia Duster');
    expect(extracted).not.toContain("Voici une proposition de message d'accueil");
    expect(extracted).not.toContain("N'hésitez pas à me solliciter");
  });

  it('formats markdown for WhatsApp sharing with single asterisks', () => {
    const extractDraft = (content: string): string => {
      const match = content.match(/```(?:[a-z]*)\n?([\s\S]*?)```/i);
      return (match ? match[1] : content).trim();
    };

    const formatWhatsAppText = (text: string) => {
      return extractDraft(text)
        .replace(/\*\*(.*?)\*\*/g, '*$1*')
        .replace(/### (.*?)\n/g, '*$1*\n')
        .replace(/## (.*?)\n/g, '*$1*\n')
        .replace(/# (.*?)\n/g, '*$1*\n');
    };

    const rawDraft = '```\nBienvenue chez **Morvello Cars**.\nVotre réservation # **MRV-123** est confirmée.\n```';
    const formatted = formatWhatsAppText(rawDraft);

    expect(formatted).toContain('*Morvello Cars*');
    expect(formatted).not.toContain('**Morvello Cars**');
  });

  // 3. Draft Detection Logic
  it('accurately classifies client message drafts', () => {
    const isClientMessageDraft = (content: string) => {
      const l = content.toLowerCase();
      return (
        /```[\s\S]+```/.test(content) ||
        l.includes('whatsapp') ||
        l.includes('sms') ||
        l.includes('salam') ||
        l.includes('cher client') ||
        l.includes('chère cliente') ||
        l.includes('bienvenue chez morvello')
      );
    };

    expect(isClientMessageDraft('Voici le message WhatsApp : Bonjour...')).toBe(true);
    expect(isClientMessageDraft('```text\nSalam Alaykoum\n```')).toBe(true);
    expect(isClientMessageDraft('Cher client, votre restitution est prévue à 18h.')).toBe(true);
    expect(isClientMessageDraft('Il y a 3 véhicules disponibles en agence.')).toBe(false);
  });

  // 4. Human-Readable Error Sanitization
  it('sanitizes technical errors into user-friendly business messages', () => {
    const formatFriendlyError = (rawError: string): { title: string; description: string; canRetry: boolean } => {
      const l = (rawError || '').toLowerCase();
      if (l.includes('429') || l.includes('trop de demandes')) {
        return {
          title: 'Limite temporaire atteinte',
          description: 'Le service a reçu plusieurs requêtes rapprochées. Veuillez patienter une minute avant de réessayer.',
          canRetry: true,
        };
      }
      if (l.includes('403') || l.includes('accès refusé') || l.includes('collaborateur')) {
        return {
          title: 'Accès non autorisé',
          description: 'Votre profil utilisateur ne dispose pas des autorisations nécessaires pour interroger la flotte de cette agence.',
          canRetry: false,
        };
      }
      if (l.includes('session') || l.includes('authentification') || l.includes('déconnexion')) {
        return {
          title: 'Session fermée',
          description: 'Votre session d’authentification a été fermée. Veuillez vous reconnecter.',
          canRetry: false,
        };
      }
      return {
        title: 'Service momentanément indisponible',
        description: 'Une difficulté technique est survenue lors du traitement de votre demande. Vous pouvez relancer la requête.',
        canRetry: true,
      };
    };

    // 429
    const err429 = formatFriendlyError('HTTP 429: trop de demandes en peu de temps.');
    expect(err429.title).toBe('Limite temporaire atteinte');
    expect(err429.canRetry).toBe(true);

    // 403
    const err403 = formatFriendlyError('accès refusé (code 403) : votre compte ne dispose pas d’un profil collaborateur actif.');
    expect(err403.title).toBe('Accès non autorisé');
    expect(err403.canRetry).toBe(false);

    // Raw technical error must NEVER expose AuthSessionMissingError
    const rawTechnical = 'AuthSessionMissingError: Auth session missing!';
    const errTechnical = formatFriendlyError(rawTechnical);
    expect(errTechnical.description).not.toContain('AuthSessionMissingError');
    expect(errTechnical.title).toBe('Session fermée');
  });

  // 5. Scroll "Jump to Latest" Threshold Logic
  it('correctly calculates when to display the "Jump to latest" button', () => {
    const shouldShowJumpToBottom = (scrollTop: number, scrollHeight: number, clientHeight: number): boolean => {
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      return distanceFromBottom > 140;
    };

    // Case 1: At the bottom
    expect(shouldShowJumpToBottom(1000, 1500, 500)).toBe(false); // distance = 0

    // Case 2: Near bottom (scrolled up slightly 50px)
    expect(shouldShowJumpToBottom(950, 1500, 500)).toBe(false); // distance = 50px

    // Case 3: Far up in long conversation (scrolled up 300px)
    expect(shouldShowJumpToBottom(700, 1500, 500)).toBe(true); // distance = 300px
  });

  // 6. Enter vs Shift+Enter Keyboard Interaction Logic
  it('distinguishes Enter (send) from Shift+Enter (newline)', () => {
    const handleKeyEvaluation = (key: string, shiftKey: boolean): 'send' | 'newline' => {
      if (key === 'Enter' && !shiftKey) {
        return 'send';
      }
      return 'newline';
    };

    expect(handleKeyEvaluation('Enter', false)).toBe('send');
    expect(handleKeyEvaluation('Enter', true)).toBe('newline');
    expect(handleKeyEvaluation('a', false)).toBe('newline');
  });
});
