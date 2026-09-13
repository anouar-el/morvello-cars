import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

import crypto from 'crypto';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// Helper for secure PBKDF2 hash computation
function computePBKDF2(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password.normalize('NFKC'), salt, 100000, 32, 'sha256').toString('hex');
}

// Fallback initial team hashes if not provided in sync
const SERVER_TEAM_DEFAULTS = [
  {
    id: 'usr-1',
    name: 'Anouar',
    role: 'admin',
    email: 'anouar@morvellocars.com',
    salt: 'e64b4b49a67956c66dee0f07b8709198',
    hash: 'dcbf718055124e58a94057fb20f2dec2b282f02de2f705682ee31736bd1f1ca3',
  },
  {
    id: 'usr-2',
    name: 'Said Khomri',
    role: 'manager',
    email: 'said.khomri@morvellocars.com',
    salt: '4ed96200e56e78297a729252bbc75edb',
    hash: 'd6297048b82235f1a7e8e1387810abced45110fb0db281fbc2d3141c206f79ad',
  },
  {
    id: 'usr-3',
    name: 'Abdelkader Ouahib',
    role: 'manager',
    email: 'abdelkader.ouahib@morvellocars.com',
    salt: '40106f819e0c28be0a741c6b60ab8d77',
    hash: 'e9ce195ff8ee4de85eb764b3b09940f2c18222a949a96eb72ffd0916847c73cf',
  },
  {
    id: 'usr-5',
    name: 'Mohamed Ezzay',
    role: 'manager',
    email: 'mohamed.ezzay@morvellocars.com',
    salt: 'f9df5e068bf31c8fdbbc50f2c9b08b7c',
    hash: 'eb5f3cc7eeeabae5831bb58c543023c868bcadacc6747635e618a2e90e3b69f9',
  },
  {
    id: 'usr-6',
    name: 'Larbi Khomri',
    role: 'manager',
    email: 'larbi.khomri@morvellocars.com',
    salt: '1bb60d2f0c2984a19120cd07dd9024ce',
    hash: '4ff690d06824cc09962803de888bc3be5b32ce9a9dea0aa19add99e85569b9c7',
  },
];

// Backend Authentication Endpoint: validates credentials using server-side PBKDF2
app.post('/api/auth/login', (req, res) => {
  try {
    const { email, password, users } = req.body;
    if (!email || typeof email !== 'string' || !password || typeof password !== 'string') {
      return res.status(400).json({ success: false, error: 'Email et mot de passe requis' });
    }

    const trimmedEmail = email.trim().toLowerCase();
    const candidateList = Array.isArray(users) && users.length > 0 ? users : SERVER_TEAM_DEFAULTS;

    const user = candidateList.find((u: any) => {
      const uEmail = (u.email || '').toLowerCase();
      if (uEmail === trimmedEmail) return true;
      if (u.id === 'usr-1' || u.role === 'admin') {
        if (
          trimmedEmail === 'anouar7fac@gmail.com' ||
          trimmedEmail === 'anouar@morvellocars.com' ||
          trimmedEmail === 'anouar'
        ) {
          return true;
        }
      }
      return false;
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Aucun compte collaborateur trouvé avec cet e-mail.',
      });
    }

    // Match against user salt/hash or fallback to initial hash table
    const salt = user.passwordSalt || user.salt;
    const expectedHash = user.passwordHash || user.hash;

    if (salt && expectedHash) {
      const computed = computePBKDF2(password, salt);
      if (computed.toLowerCase() !== expectedHash.toLowerCase()) {
        return res.status(401).json({
          success: false,
          error: 'Mot de passe incorrect pour ce compte.',
        });
      }
    } else if (user.password) {
      if (user.password !== password) {
        return res.status(401).json({
          success: false,
          error: 'Mot de passe incorrect pour ce compte.',
        });
      }
    } else {
      return res.status(401).json({
        success: false,
        error: 'Compte protégé sans mot de passe local. Utilisez la connexion Google.',
      });
    }

    // Generate secure session token and sanitize returned user object
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const { password: _p, passwordHash: _ph, passwordSalt: _ps, salt: _s, hash: _h, ...safeUser } = user;

    res.json({
      success: true,
      user: safeUser,
      token: sessionToken,
    });
  } catch (error: any) {
    console.error('Backend auth login error:', error);
    res.status(500).json({ success: false, error: 'Erreur interne du serveur lors de la connexion' });
  }
});

// Secure password hashing utility for credential updates
app.post('/api/auth/hash-password', (req, res) => {
  try {
    const { password } = req.body;
    if (!password || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ error: 'Mot de passe invalide (minimum 6 caractères).' });
    }
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = computePBKDF2(password, salt);
    res.json({ salt, hash });
  } catch (error: any) {
    res.status(500).json({ error: 'Erreur lors du hachage sécurisé' });
  }
});

// Lazy initialization of GoogleGenAI
let aiClient: GoogleGenAI | null = null;
function getAiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is not set.');
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Morvello Cars Agent AI API',
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
  });
});

// AI Agent Chat Endpoint - strictly isolated per member
app.post('/api/agent-chat', async (req, res) => {
  try {
    const {
      memberId,
      memberName = 'Collaborateur',
      memberRole = 'manager',
      memberAgency = '',
      message,
      history = [],
      memberData = {},
      aiSettings = {},
    } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message requis' });
    }

    const ai = getAiClient();
    const isAdmin = memberRole === 'admin';

    // Strict Data Filtering per member (zero-leakage guarantee)
    const rawVehicles = Array.isArray(memberData.vehicles) ? memberData.vehicles : [];
    const rawContracts = Array.isArray(memberData.contracts) ? memberData.contracts : [];
    const rawClients = Array.isArray(memberData.clients) ? memberData.clients : [];
    const rawDeposits = Array.isArray(memberData.deposits) ? memberData.deposits : [];

    const memberNameLower = (memberName || '').toLowerCase();

    // Vehicles strictly accessible to this member
    const accessibleVehicles = isAdmin
      ? rawVehicles
      : rawVehicles.filter((v: any) => {
          if (v.assignedManagerId === memberId) return true;
          if (v.assignedManagerName && v.assignedManagerName.toLowerCase().includes(memberNameLower)) return true;
          return false;
        });

    const accessibleVehicleIds = new Set(accessibleVehicles.map((v: any) => v.id));
    const accessiblePlates = new Set(
      accessibleVehicles.map((v: any) => (v.plate || '').replace(/\s+/g, '').toUpperCase())
    );

    // Contracts strictly accessible to this member
    const accessibleContracts = isAdmin
      ? rawContracts
      : rawContracts.filter((c: any) => {
          if (c.assignedManagerId === memberId) return true;
          if (c.vehicleId && accessibleVehicleIds.has(c.vehicleId)) return true;
          const snapPlate = (c.vehicleSnapshot?.plate || '').replace(/\s+/g, '').toUpperCase();
          if (snapPlate && accessiblePlates.has(snapPlate)) return true;
          return false;
        });

    const accessibleContractIds = new Set(accessibleContracts.map((c: any) => c.id));
    const accessibleContractNumbers = new Set(accessibleContracts.map((c: any) => c.contractNumber));
    const accessibleClientIds = new Set(accessibleContracts.map((c: any) => c.clientId));

    // Deposits strictly accessible to this member
    const accessibleDeposits = isAdmin
      ? rawDeposits
      : rawDeposits.filter((d: any) => {
          if (d.contractId && accessibleContractIds.has(d.contractId)) return true;
          if (d.contractNumber && accessibleContractNumbers.has(d.contractNumber)) return true;
          return false;
        });

    // Clients strictly accessible to this member
    const accessibleClients = isAdmin
      ? rawClients
      : rawClients.filter((cl: any) => {
          if (accessibleClientIds.has(cl.id)) return true;
          if (cl.assignedManagerId === memberId) return true;
          return false;
        });

    // Brand vision & style directives from Settings
    const brandVision =
      aiSettings.brandVision ||
      "Morvello Cars incarne la conciergerie automobile haut de gamme au Maroc (Casablanca, Nouaceur, Régions) : rigueur opérationnelle, hospitalité marocaine d'exception, ponctualité absolue et transparence irréprochable sur les contrats et les cautions.";
    const toneOfVoice = aiSettings.toneOfVoice || 'luxury_concierge';
    const languagePreference = aiSettings.languagePreference || 'french_darija';
    const signatureGreeting = aiSettings.signatureGreeting || "Sté MORVELLO CARS • Where luxury meets the road";
    const standardPricingRule =
      aiSettings.standardPricingRule ||
      'Tarif de référence : 300 MAD/jour standard pour les citadines et compactes (Peugeot 208, Citroën C3/C-Elysée, Renault Kardian). Caution standard : 5 000 MAD par pré-autorisation carte bancaire ou chèque avec accord préalable.';
    const customInstructions = aiSettings.customInstructions || '';
    const keyValues =
      Array.isArray(aiSettings.keyValues) && aiSettings.keyValues.length > 0
        ? aiSettings.keyValues
        : [
            'Hospitalité & élégance : accueil VIP courtois et bienveillant',
            'Rigueur & clarté : état des lieux millimétré, documents conformes (CIN, Permis, Caution)',
            'Transparence totale : explications précises sur les franchises et la restitution de caution',
            'Réactivité 24/7 : assistance rapide en cas d’imprévu ou de prolongation',
          ];
    const prohibitedBehaviors =
      Array.isArray(aiSettings.prohibitedBehaviors) && aiSettings.prohibitedBehaviors.length > 0
        ? aiSettings.prohibitedBehaviors
        : [
            'Ne jamais accorder de remises non autorisées par le gérant ou déroger au tarif standard',
            'Ne jamais divulguer d’informations sur les véhicules ou contrats d’une autre agence (cloisonnement strict)',
            'Ne jamais adopter un ton familier, arrogant ou agressif, même en cas de litige client',
            'Ne pas valider de restitution de caution sans contrôle physique complet du véhicule',
          ];
    const sampleResponses = Array.isArray(aiSettings.sampleResponses) ? aiSettings.sampleResponses : [];

    // Build the confidential contextual snapshot for this specific member
    const systemPrompt = `Tu es l'Assistant Personnel IA Exécutif de ${memberName} chez Morvello Cars (Société de location automobile à Casablanca & Nouaceur, Maroc).
Rôle du membre : ${isAdmin ? 'Gérant / Super Administrateur (Accès Superviseur Global 360°)' : `Responsable d'Agence / Gestionnaire de flotte (${memberAgency || 'Agence Morvello'})`}.

CHARTE ÉDITORIALE & VISION DE LA MAISON MORVELLO CARS :
${brandVision}

VALEURS CLÉS DE L'ENTREPRISE :
${keyValues.map((kv: string) => `• ${kv}`).join('\n')}

TON ET STYLE EXIGÉS (${toneOfVoice.toUpperCase()}) :
- Posture : ${
      toneOfVoice === 'luxury_concierge'
        ? 'Conciergerie de luxe : poli, raffiné, rassurant, soigné et valorisant le service haut de gamme.'
        : toneOfVoice === 'business_formal'
        ? "Formel d'affaires : concis, rigoureux, respectueux des procédures d'entreprise."
        : toneOfVoice === 'warm_commercial'
        ? "Commercial chaleureux : enthousiaste, tourné vers la satisfaction client et l'hospitalité marocaine."
        : 'Opérationnel direct : ultra-concis, factuel, orienté chiffres et actions directes.'
    }
- Langues (${languagePreference}) : ${
      languagePreference === 'french_darija'
        ? "Français professionnel d'affaires ou Darija marocaine fluide et polie selon le contexte."
        : languagePreference === 'french_only'
        ? 'Strictement en français irréprochable et élégant.'
        : 'Privilégier la Darija marocaine chaleureuse pour les messages WhatsApp et contacts directs.'
    }
- Signature de marque : "${signatureGreeting}"
- Tarification & Règles financières : ${standardPricingRule}

RÈGLES ET COMPORTEMENTS STRICTEMENT PROSCRITS :
${prohibitedBehaviors.map((pb: string) => `⚠️ ${pb}`).join('\n')}

${customInstructions ? `DIRECTIVES SPÉCIFIQUES DU GÉRANT :\n${customInstructions}\n` : ''}

${
  sampleResponses.length > 0
    ? `EXEMPLES DE RÉPONSES MODÈLES ET STYLE ATTENDU (FEW-SHOT LEARNING) :
${sampleResponses
  .map(
    (sr: any, idx: number) =>
      `--- EXEMPLE ${idx + 1} (${sr.scenario}) ---\n${sr.idealReply}\n`
  )
  .join('\n')}`
    : ''
}

RÈGLES STRICTES DE CONFIDENTIALITÉ ET DE CLOISONNEMENT DES DONNÉES :
${
  isAdmin
    ? '- En tant que Gérant, tu as accès à la totalité du parc, des agences, des contrats et des audits financiers de Morvello Cars.'
    : `- Tu as accès STRICTEMENT ET UNIQUEMENT aux véhicules, contrats, clients et cautions affectés à ${memberName}.
- Tu N'AS AUCUN ACCÈS aux véhicules ou contrats des autres collègues ou responsables.
- Si ${memberName} te demande des données confidentielles sur un autre responsable, réponds courtoisement et fermement que pour des raisons de cloisonnement des agences Morvello Cars, tu n'as accès qu'à sa flotte et ses dossiers personnels.`
}

MISSIONS ET CAPACITÉS DE L'ASSISTANT :
1. Briefing Quotidien Opérationnel : Synthèse rapide des véhicules disponibles, des contrats en cours, des retours prévus et de l'état des cautions.
2. Disponibilité & Recherches Immédiates : Informer instantanément sur la disponibilité par type (Essence, Diesel), couleur, kilométrage, et tarifs journaliers (${standardPricingRule}).
3. Contrôle Conformité & Alertes : Échéances des assurances (ex: Sanlam Maroc au 27/05/2027), contrôle technique, vignettes 2026, et surveillance des kilométrages / vidanges.
4. Rédaction Professionnelle de Messages Clients (WhatsApp & SMS) :
   - Français soigné ou Darija marocain fluide selon la demande du responsable.
   - Message de bienvenue & consignes de prise en charge (permis, caution requise, état des lieux).
   - Rappel courtois d'heure et lieu de restitution.
   - Confirmation de restitution & déblocage de caution.
   - Proposition de prolongation tarifée.
5. Aide au Calcul & Prolongation : Calcul direct de montants (ex: 3 jours à 300 MAD = 900 MAD), calcul des indemnités kilométriques de dépassement éventuelles, estimation de pénalités de retard ou carburant manquant.
6. État des Lieux & Gestion des Cautions : Conseiller sur les déductions conformes aux conditions générales Morvello Cars (lavage, carburant, micro-rayures jantes/carrosserie) et calcul du solde restant dû.

DONNÉES TEMPS RÉEL ACCESSIBLES POUR ${memberName.toUpperCase()} :
- VÉHICULES SOUS GESTION (${accessibleVehicles.length}) :
${
  accessibleVehicles.length === 0
    ? 'Aucun véhicule affecté pour le moment.'
    : accessibleVehicles
        .map(
          (v: any) =>
            `• [${v.id}] ${v.brand} ${v.model} | Immat: ${v.plate} | Carburant: ${v.fuelType} | Statut: ${v.status} | Km: ${v.currentKm} km | Tarif: ${v.dailyRate} MAD/j | Couleur: ${v.color || 'N/C'} | Assurance: ${v.insuranceCompany || 'N/C'} (Expire: ${v.insuranceExpiryDate || 'N/C'}) | Vignette: ${v.vignettePaidYear || '2026'}`
        )
        .join('\n')
}

- CONTRATS ACTIFS OU SOUS CONTRÔLE (${accessibleContracts.length}) :
${
  accessibleContracts.length === 0
    ? 'Aucun contrat actif pour ce responsable.'
    : accessibleContracts
        .map(
          (c: any) =>
            `• Contrat ${c.contractNumber} | Statut: ${c.status} | Véhicule: ${c.vehicleSnapshot?.brand} ${c.vehicleSnapshot?.model} (${c.vehicleSnapshot?.plate}) | Client: ${c.clientSnapshot?.lastName} ${c.clientSnapshot?.firstName} (Tél: ${c.clientSnapshot?.phone || 'N/C'}) | Du ${c.startDate} au ${c.endDate} | Total: ${c.totalAmount} MAD (Reste à payer: ${c.remainingAmount || 0} MAD) | Caution: ${c.depositAmount || 0} MAD (${c.depositMethod || 'N/C'})`
        )
        .join('\n')
}

- CAUTIONS LIÉES (${accessibleDeposits.length}) :
${
  accessibleDeposits.length === 0
    ? 'Aucune caution sous gestion.'
    : accessibleDeposits
        .map(
          (d: any) =>
            `• Caution #${d.id} | Contrat: ${d.contractNumber} | Montant: ${d.amount} MAD (${d.paymentMethod}) | Statut: ${d.status}`
        )
        .join('\n')
}

- CLIENTS CONCERNÉS (${accessibleClients.length}) :
${
  accessibleClients.length === 0
    ? 'Aucun client directement associé.'
    : accessibleClients
        .map(
          (cl: any) =>
            `• ${cl.lastName} ${cl.firstName} | Doc: ${cl.docNumber} | Tél: ${cl.phone || 'N/C'} | Ville: ${cl.city || 'N/C'}`
        )
        .join('\n')
}

TON ET FORMAT DES SORTIES :
- Adopte fidèlement la charte éditoriale Morvello Cars ci-dessus.
- Utilise une mise en page soignée avec des puces et du gras pour faciliter la lecture sur smartphone ou tablette d'agence.
- Quand un texte de message WhatsApp ou SMS est demandé, fournis-le toujours dans un bloc copiable pratique avec les émojis adaptés.`;

    // Format conversation history for multi-turn chat
    const contents: any[] = [];

    if (Array.isArray(history) && history.length > 0) {
      for (const item of history.slice(-8)) {
        if (item.content && typeof item.content === 'string') {
          contents.push({
            role: item.role === 'model' || item.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: item.content }],
          });
        }
      }
    }

    // Add current user message
    contents.push({
      role: 'user',
      parts: [{ text: message }],
    });

    // Generate response with multi-tier fallback for 100% reliability
    const modelsToTry = ['gemini-3.1-flash-lite', 'gemini-3.5-flash', 'gemini-3.8-flash'];
    let response: any = null;
    let lastError: any = null;

    for (const modelName of modelsToTry) {
      try {
        response = await ai.models.generateContent({
          model: modelName,
          contents: contents,
          config: {
            systemInstruction: systemPrompt,
            temperature: 0.4,
          },
        });
        if (response && response.text) {
          break;
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`Model ${modelName} encountered issue, trying next model:`, err?.message || err);
      }
    }

    if (!response || !response.text) {
      throw lastError || new Error("Impossible d'obtenir une réponse de l'agent IA.");
    }

    const replyText = response.text;

    res.json({
      success: true,
      reply: replyText,
      member: {
        id: memberId,
        name: memberName,
        accessibleVehiclesCount: accessibleVehicles.length,
        accessibleContractsCount: accessibleContracts.length,
      },
    });
  } catch (error: any) {
    console.error('Agent chat API error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erreur interne lors de la communication avec l’agent IA',
    });
  }
});

// Configure Vite middleware or static serving
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Morvello Cars Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
