import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

import crypto from 'crypto';
import { initializeApp, getApps, App as FirebaseAdminApp } from 'firebase-admin/app';
import { getAuth, UserRecord, CreateRequest, Auth as FirebaseAdminAuth } from 'firebase-admin/auth';
import { getFirestore, Firestore as FirebaseAdminFirestore } from 'firebase-admin/firestore';

dotenv.config();

// Lazy initialization for Firebase Admin SDK
let adminApp: FirebaseAdminApp | null = null;
let adminAuth: FirebaseAdminAuth | null = null;
let adminDb: FirebaseAdminFirestore | null = null;

function getAdminApp(): FirebaseAdminApp {
  if (!adminApp) {
    const existing = getApps();
    if (existing.length > 0) {
      adminApp = existing[0];
    } else {
      adminApp = initializeApp({
        projectId: 'reference-unity-289300',
      });
    }
  }
  return adminApp;
}

function getAdminAuth(): FirebaseAdminAuth {
  if (!adminAuth) {
    adminAuth = getAuth(getAdminApp());
  }
  return adminAuth;
}

function getAdminDb(): FirebaseAdminFirestore {
  if (!adminDb) {
    adminDb = getFirestore(getAdminApp());
  }
  return adminDb;
}

const app = express();
// PORT Configuration:
// In the AI Studio / Cloud Run preview container, Nginx reverse proxy runs on port 8080 (the container's ingress port)
// and routes all incoming HTTP traffic exclusively to localhost:3000.
// Binding directly to process.env.PORT in this container would cause an immediate EADDRINUSE crash (port 8080 collision with Nginx).
// For standalone external deployment (e.g. standalone Docker without internal Nginx), process.env.STANDALONE_PORT or process.env.PORT can be read if not in AI Studio.
const PORT = process.env.AI_STUDIO === 'false' && process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '10mb' }));

// Helper to verify admin caller via Firebase Auth ID Token
async function verifyAdminCaller(
  req: express.Request
): Promise<{ isAdmin: boolean; callerUid?: string; error?: string }> {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    return { isAdmin: false, error: 'Jeton d\'authentification manquant dans l\'en-tête Authorization' };
  }

  try {
    const auth = getAdminAuth();
    const decoded = await auth.verifyIdToken(token);
    const hasAdminClaim = decoded.admin === true || decoded.role === 'admin';

    // NOTE: To bootstrap an admin account manually, use the CLI script:
    // node scripts/set_admin_claim.js <email-or-uid> admin
    if (!hasAdminClaim) {
      return {
        isAdmin: false,
        callerUid: decoded.uid,
        error: 'Action réservée aux administrateurs (Custom Claim "admin" requis).',
      };
    }

    return { isAdmin: true, callerUid: decoded.uid };
  } catch (err: any) {
    return { isAdmin: false, error: 'Jeton d\'authentification Firebase invalide ou expiré.' };
  }
}

// ============================================================================
// Firebase Auth Custom Claims & Team Member Provisioning Endpoints
// ============================================================================

/**
 * Set User Role and Custom Claims ({ role, admin: boolean })
 * Strict verification of admin privileges via Firebase Auth token
 */
app.post('/api/admin/set-user-role', async (req, res) => {
  try {
    const authCheck = await verifyAdminCaller(req);
    if (!authCheck.isAdmin) {
      return res.status(403).json({ success: false, error: authCheck.error });
    }

    const { uid, role } = req.body;
    if (!uid || typeof uid !== 'string') {
      return res.status(400).json({ success: false, error: 'UID utilisateur cible requis.' });
    }

    const allowed = ['admin', 'manager', 'agent'];
    if (!role || !allowed.includes(role)) {
      return res.status(400).json({ success: false, error: `Rôle invalide. Autorisés: ${allowed.join(', ')}` });
    }

    const isAdminRole = role === 'admin';
    await getAdminAuth().setCustomUserClaims(uid, {
      role: role,
      admin: isAdminRole,
    });

    // Update Firestore /users/{uid} document
    try {
      await getAdminDb().collection('users').doc(uid).set(
        {
          uid,
          role,
          adminClaim: isAdminRole,
          updatedAt: new Date().toISOString(),
          updatedBy: authCheck.callerUid,
        },
        { merge: true }
      );
    } catch (fsErr: any) {
      console.warn('[Server] Firestore update warning in set-user-role:', fsErr?.message);
    }

    console.log(`[Server] Applied Custom Claims for UID ${uid}: role=${role}, admin=${isAdminRole}`);

    res.json({
      success: true,
      uid,
      role,
      admin: isAdminRole,
      message: `Rôle ${role.toUpperCase()} appliqué avec succès (Custom Claims).`,
    });
  } catch (error: any) {
    console.error('[Server] set-user-role error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erreur lors de la mise à jour des Custom Claims.',
    });
  }
});

/**
 * Provision Team Member:
 * Creates user in Firebase Auth without public client signup,
 * applies Custom Claims, generates activation link, and registers in Firestore.
 */
app.post('/api/admin/provision-team-member', async (req, res) => {
  try {
    const authCheck = await verifyAdminCaller(req);
    if (!authCheck.isAdmin) {
      return res.status(403).json({ success: false, error: authCheck.error });
    }

    const {
      email,
      name,
      role = 'manager',
      agency = 'Agence Morvello',
      phone = '',
      assignedFleetName = '',
      password = '',
    } = req.body;

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ success: false, error: 'Email valide obligatoire.' });
    }

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedName = (name || trimmedEmail.split('@')[0]).trim();
    const allowed = ['admin', 'manager', 'agent'];
    const targetRole = allowed.includes(role) ? role : 'manager';
    const isAdminRole = targetRole === 'admin';

    // Check if user already exists or create new Firebase Auth user
    let userRecord: UserRecord;
    const auth = getAdminAuth();
    try {
      userRecord = await auth.getUserByEmail(trimmedEmail);
      console.log(`[Server] User ${trimmedEmail} exists with UID: ${userRecord.uid}`);
    } catch (err: any) {
      if (err.code === 'auth/user-not-found') {
        const createPayload: CreateRequest = {
          email: trimmedEmail,
          displayName: trimmedName,
          disabled: false,
        };
        if (password && typeof password === 'string' && password.length >= 6) {
          createPayload.password = password;
        }
        if (phone && typeof phone === 'string' && phone.startsWith('+')) {
          createPayload.phoneNumber = phone;
        }
        userRecord = await auth.createUser(createPayload);
        console.log(`[Server] Provisioned new Auth user ${trimmedEmail} (UID: ${userRecord.uid})`);
      } else {
        throw err;
      }
    }

    // Set Custom Claims
    await auth.setCustomUserClaims(userRecord.uid, {
      role: targetRole,
      admin: isAdminRole,
    });

    // Generate secure password reset / activation link
    let resetLink: string | null = null;
    try {
      resetLink = await auth.generatePasswordResetLink(trimmedEmail);
    } catch (linkErr: any) {
      console.warn('[Server] Could not generate reset link:', linkErr?.message);
    }

    // Persist user record in Firestore /users/{uid}
    try {
      await getAdminDb().collection('users').doc(userRecord.uid).set(
        {
          uid: userRecord.uid,
          email: trimmedEmail,
          name: trimmedName,
          role: targetRole,
          agency,
          phone,
          assignedFleetName,
          adminClaim: isAdminRole,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: authCheck.callerUid,
        },
        { merge: true }
      );
    } catch (fsErr: any) {
      console.warn('[Server] Firestore doc write warning:', fsErr?.message);
    }

    res.json({
      success: true,
      uid: userRecord.uid,
      email: trimmedEmail,
      name: trimmedName,
      role: targetRole,
      admin: isAdminRole,
      resetLink,
      message: `Collaborateur ${trimmedName} provisionné avec succès.`,
    });
  } catch (error: any) {
    console.error('[Server] provision-team-member error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erreur lors du provisionnement du compte collaborateur.',
    });
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

// In-memory sliding-window rate limiter for /api/agent-chat (prevents API abuse and quota exhaustion)
interface RateLimitRecord {
  count: number;
  resetTime: number;
}
const chatRateLimitMap = new Map<string, RateLimitRecord>();

setInterval(() => {
  const now = Date.now();
  for (const [key, record] of chatRateLimitMap.entries()) {
    if (now > record.resetTime) {
      chatRateLimitMap.delete(key);
    }
  }
}, 5 * 60 * 1000).unref();

function chatRateLimiter(req: express.Request, res: express.Response, next: express.NextFunction) {
  const clientIp =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.socket.remoteAddress ||
    'unknown-ip';
  const memberId = req.body?.memberId || 'anonymous';
  const rateLimitKey = `${clientIp}:${memberId}`;

  const WINDOW_MS = 60 * 1000; // 1 minute window
  const MAX_REQUESTS = 25; // 25 requests per minute

  const now = Date.now();
  let record = chatRateLimitMap.get(rateLimitKey);

  if (!record || now > record.resetTime) {
    record = { count: 1, resetTime: now + WINDOW_MS };
    chatRateLimitMap.set(rateLimitKey, record);
  } else {
    record.count++;
  }

  const remaining = Math.max(0, MAX_REQUESTS - record.count);
  const resetSeconds = Math.ceil((record.resetTime - now) / 1000);

  res.setHeader('X-RateLimit-Limit', MAX_REQUESTS);
  res.setHeader('X-RateLimit-Remaining', remaining);
  res.setHeader('X-RateLimit-Reset', resetSeconds);

  if (record.count > MAX_REQUESTS) {
    res.setHeader('Retry-After', resetSeconds);
    return res.status(429).json({
      error: 'Trop de requêtes vers l\'assistant IA. Veuillez patienter avant de continuer.',
      retryAfterSeconds: resetSeconds,
    });
  }

  next();
}

// AI Agent Chat Endpoint - strictly isolated per member
app.post('/api/agent-chat', chatRateLimiter, async (req, res) => {
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

startServer().catch((err) => {
  console.error('[Server] Fatal startup error:', err);
  process.exit(1);
});

