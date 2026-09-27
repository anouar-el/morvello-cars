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

if (admin && admin.apps && !admin.apps.length) {
  admin.initializeApp();
}

/**
 * Callable Function: setUserRole (DEPRECATED - SAFEGUARDED COMPATIBILITY WRAPPER)
 * 
 * Strict Single Authority:
 * Independent modification of roles via Firebase custom claims is prohibited.
 * All administrative mutations must execute through the authoritative Express API (/api/admin/set-user-role)
 * backed by Supabase Auth and public.profiles.
 */
exports.setUserRole = functions.https.onCall(async (data, context) => {
  throw new functions.https.HttpsError(
    'permission-denied',
    'Action refusée: L’autorité de sécurité unique est Supabase Auth. Utilisez l’API administrative /api/admin/set-user-role.'
  );
});

/**
 * Callable Function: provisionTeamMember (DEPRECATED - SAFEGUARDED COMPATIBILITY WRAPPER)
 * 
 * Strict Single Authority:
 * Independent provisioning without Supabase profile creation is prohibited.
 * All provisioning must execute through /api/admin/provision-team-member.
 */
exports.provisionTeamMember = functions.https.onCall(async (data, context) => {
  throw new functions.https.HttpsError(
    'permission-denied',
    'Action refusée: L’autorité de sécurité unique est Supabase Auth. Utilisez l’API administrative /api/admin/provision-team-member.'
  );
});
