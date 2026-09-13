# Morvello Cars — Application de Gestion de Flotte & Conciergerie

Application web complète de gestion locative automobile, conciergerie haut de gamme, suivi de flotte, édition de contrats avec cachet légal, calcul de cautions et assistant conversationnel IA (Gemini).

## 🚀 Fonctionnalités Clés

- **Tableau de Bord & KPIs** : Suivi en direct du taux d'occupation, des revenus, des cautions bloquées et des alertes d'entretien.
- **Gestion de Flotte Automobile** : Fiches techniques détaillées (immatriculation marocaine, motorisation, kilométrage, échéances Sanlam, contrôles techniques et vignettes).
- **Contrats & Impressions Officielles** : Génération de contrats de location avec numérotation automatique, calcul dynamique des montants TTC et cachet d'entreprise officiel.
- **Gestion des Cautions & Litiges** : Traçabilité des dépôts de garantie, restitution et calcul automatique des déductions (carburant, nettoyage, retards).
- **Assistant IA Minimaliste (Gemini)** : Assistant intelligent pour les agents et le gérant (briefing de flotte, rédaction de messages clients en Français et Darija marocaine, calcul de prolongations).
- **Éditeur de Charte & Vision de Marque** : Personnalisation du ton de voix, des règles tarifaires, des consignes du Gérant et de la signature dans les Paramètres.
- **Synchronisation Cloud Firebase Firestore** : Données partagées en temps réel entre tous les postes de l'agence.
- **Modes Sombre Prestige & Clair Corporate** : Interface adaptable selon les préférences visuelles.

## 🛠️ Stack Technique

- **Frontend** : React 18, TypeScript, Tailwind CSS, Lucide Icons, Vite
- **Backend / API** : Express, Node.js, SDK `@google/genai` (Gemini Flash)
- **Persistance** : Firebase Cloud Firestore (NoSQL temps réel) + LocalStorage
- **Moteur d'impression** : Impression vectorielle de contrats et fiches d'inspection

## 🔐 Authentification, Logins & Mots de Passe

L'application intègre un système d'authentification RBAC (Role-Based Access Control) multi-postes couplé à Firebase Cloud Firestore.

### 1. Comptes & Identifiants par défaut

| Collaborateur | Rôle | Agence / Flotte | Login / Email | Mot de passe initial |
| :--- | :--- | :--- | :--- | :--- |
| **Anouar** | Gérant (Super Admin) | Direction Générale | `anouar@morvellocars.com`<br>*(ou `anouar7fac@gmail.com`)* | `admin123` |
| **Said Khomri** | Responsable Flotte | Casablanca Centre (Citadines & Berlines) | `said.khomri@morvellocars.com` | `manager123` |
| **Abdelkader Ouahib** | Responsable Flotte | Aéroport Nouaceur (SUV & Prestige) | `abdelkader.ouahib@morvellocars.com` | `manager123` |
| **Larbi Khomri** | Responsable Flotte | Casablanca Littoral (Hybrides & Éco) | `larbi.khomri@morvellocars.com` | `manager123` |
| **Mohamed Ezzay** | Responsable Flotte | Marrakech & Région (SUV & Premium) | `mohamed.ezzay@morvellocars.com` | `manager123` |

### 2. Personnalisation des Identifiants
- Dans l'application, accédez à l'onglet **« Équipe & Accès »** (icône clé dorée dans la barre de navigation).
- Cliquez sur le sous-onglet **« Identifiants, Logins & Mots de Passe »**.
- Vous pouvez afficher les mots de passe, en définir de nouveaux pour chaque collaborateur, ajouter un nouveau compte ou synchroniser instantanément avec le Cloud Firestore.

## 📦 Installation Locale

1. **Cloner le dépôt** :
   ```bash
   git clone https://github.com/anouar-el/morvello-cars.git
   cd morvello-cars
   ```

2. **Installer les dépendances** :
   ```bash
   npm install
   ```

3. **Variables d'environnement** :
   Créez un fichier `.env` basé sur `.env.example` :
   ```env
   GEMINI_API_KEY=votre_cle_gemini_api
   ```

4. **Lancer le serveur de développement** :
   ```bash
   npm run dev
   ```
   L'application sera accessible sur `http://localhost:3000`.

5. **Compiler pour la production** :
   ```bash
   npm run build
   ```

## 📄 Licence & Propriété

Développé pour **Morvello Cars SARL** — Casablanca / Nouaceur, Maroc. Tous droits réservés.
