/**
 * Cloud Functions for Morvello Cars Rental Management Platform
 * 
 * Functions provided:
 * 1. setUserRole: Sets Custom Claims ({ role, admin: boolean }) on target user via Firebase Admin SDK
 *    and syncs the role in Firestore /users/{uid}.
 * 2. provisionTeamMember: Creates new Firebase Auth user server-side, sets Custom Claims,
 *    generates an activation / password reset link, and creates /users/{uid} in Firestore.
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}

/**
 * Callable Function: setUserRole
 * 
 * Requirements:
 * - Caller must be authenticated with Firebase Auth
 * - Caller must possess admin custom claim (context.auth.token.admin === true || context.auth.token.role === 'admin')
 * - Arguments: { uid: string, role: 'admin' | 'manager' | 'agent' }
 */
exports.setUserRole = functions.https.onCall(async (data, context) => {
  // 1. Verify authentication
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'Authentification requise pour modifier les rôles utilisateurs.'
    );
  }

  // 2. Verify admin rights (Custom Claims check)
  const callerClaims = context.auth.token || {};
  const isCallerAdmin = callerClaims.admin === true || callerClaims.role === 'admin';

  if (!isCallerAdmin) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Action réservée aux administrateurs (Custom Claim "admin" requis).'
    );
  }

  // 3. Validate input parameters
  const { uid, role } = data || {};
  if (!uid || typeof uid !== 'string') {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Identifiant UID utilisateur cible manquant ou invalide.'
    );
  }

  const allowedRoles = ['admin', 'manager', 'agent'];
  if (!role || !allowedRoles.includes(role)) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      `Rôle invalide. Rôles autorisés: ${allowedRoles.join(', ')}`
    );
  }

  try {
    // 4. Apply Custom Claims via Firebase Admin SDK
    const isAdminRole = role === 'admin';
    await admin.auth().setCustomUserClaims(uid, {
      role: role,
      admin: isAdminRole,
    });

    // 5. Update or sync user profile in Firestore /users/{uid}
    const userDocRef = admin.firestore().collection('users').doc(uid);
    await userDocRef.set(
      {
        uid,
        role,
        adminClaim: isAdminRole,
        updatedAt: new Date().toISOString(),
        updatedBy: context.auth.uid,
      },
      { merge: true }
    );

    console.log(`[setUserRole] Successfully set role "${role}" for UID: ${uid} by admin UID: ${context.auth.uid}`);

    return {
      success: true,
      uid,
      role,
      admin: isAdminRole,
      message: `Rôle ${role.toUpperCase()} attribué avec succès (Custom Claims appliqués).`,
    };
  } catch (error) {
    console.error('[setUserRole] Error updating user custom claims:', error);
    throw new functions.https.HttpsError(
      'internal',
      error.message || 'Erreur interne lors de la mise à jour des Custom Claims.'
    );
  }
});

/**
 * Callable Function: provisionTeamMember
 * 
 * Requirements:
 * - Caller must be an authenticated Admin
 * - Creates Firebase Auth user account server-side without public client signup
 * - Assigns Custom Claims ({ role, admin: boolean })
 * - Generates secure password reset / activation link
 * - Persists profile in Firestore /users/{uid}
 */
exports.provisionTeamMember = functions.https.onCall(async (data, context) => {
  // 1. Verify caller authentication
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'Authentification requise pour provisionner un collaborateur.'
    );
  }

  // 2. Verify caller admin privileges
  const callerClaims = context.auth.token || {};
  const isCallerAdmin = callerClaims.admin === true || callerClaims.role === 'admin';

  if (!isCallerAdmin) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Action réservée aux administrateurs (Custom Claim "admin" requis).'
    );
  }

  // 3. Extract and validate parameters
  const {
    email,
    name,
    role = 'manager',
    agency = 'Agence Morvello',
    phone = '',
    assignedFleetName = '',
    password = '',
  } = data || {};

  if (!email || typeof email !== 'string' || !email.includes('@')) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Adresse email valide obligatoire.'
    );
  }

  const trimmedEmail = email.trim().toLowerCase();
  const trimmedName = (name || trimmedEmail.split('@')[0]).trim();
  const allowedRoles = ['admin', 'manager', 'agent'];
  const targetRole = allowedRoles.includes(role) ? role : 'manager';
  const isAdminRole = targetRole === 'admin';

  try {
    // 4. Create or retrieve existing Firebase Auth user
    let userRecord;
    try {
      userRecord = await admin.auth().getUserByEmail(trimmedEmail);
      console.log(`[provisionTeamMember] User already exists with UID: ${userRecord.uid}`);
    } catch (notFoundError) {
      if (notFoundError.code === 'auth/user-not-found') {
        const createPayload = {
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
        userRecord = await admin.auth().createUser(createPayload);
        console.log(`[provisionTeamMember] Created new Auth user with UID: ${userRecord.uid}`);
      } else {
        throw notFoundError;
      }
    }

    // 5. Apply Custom Claims
    await admin.auth().setCustomUserClaims(userRecord.uid, {
      role: targetRole,
      admin: isAdminRole,
    });

    // 6. Generate Password Reset / Account Activation link
    let resetLink = null;
    try {
      resetLink = await admin.auth().generatePasswordResetLink(trimmedEmail);
    } catch (linkErr) {
      console.warn('[provisionTeamMember] Could not generate reset link:', linkErr.message);
    }

    // 7. Persist user document in Firestore /users/{uid}
    const firestoreUserPayload = {
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
      createdBy: context.auth.uid,
    };

    await admin
      .firestore()
      .collection('users')
      .doc(userRecord.uid)
      .set(firestoreUserPayload, { merge: true });

    return {
      success: true,
      uid: userRecord.uid,
      email: trimmedEmail,
      name: trimmedName,
      role: targetRole,
      admin: isAdminRole,
      resetLink,
      message: `Compte collaborateur provisionné avec succès pour ${trimmedName}.`,
    };
  } catch (error) {
    console.error('[provisionTeamMember] Error provisioning team member:', error);
    throw new functions.https.HttpsError(
      'internal',
      error.message || 'Échec du provisionnement du compte collaborateur.'
    );
  }
});
