#!/usr/bin/env node
/**
 * Bootstrap / Admin CLI Script: Set Firebase Auth Custom Claims
 * 
 * Usage:
 *   node scripts/set_admin_claim.js <email-or-uid> [admin|manager|agent]
 * 
 * Example:
 *   node scripts/set_admin_claim.js anouar7fac@gmail.com admin
 *   node scripts/set_admin_claim.js anouar@morvellocars.com admin
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const targetIdentifier = process.argv[2] || 'anouar7fac@gmail.com';
const targetRole = process.argv[3] || 'admin';

// Initialize Firebase Admin SDK
try {
  const configPath = path.resolve(__dirname, '../firebase-applet-config.json');
  let projectId = 'reference-unity-289300';
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    projectId = config.projectId || projectId;
  }

  admin.initializeApp({
    projectId: projectId,
  });
  console.log(`[Admin CLI] Initialized Firebase Admin for project: ${projectId}`);
} catch (e) {
  console.error('[Admin CLI] Initialization error:', e.message);
}

async function setClaims() {
  try {
    let userRecord;
    if (targetIdentifier.includes('@')) {
      console.log(`[Admin CLI] Looking up user by email: ${targetIdentifier}...`);
      userRecord = await admin.auth().getUserByEmail(targetIdentifier.toLowerCase());
    } else {
      console.log(`[Admin CLI] Looking up user by UID: ${targetIdentifier}...`);
      userRecord = await admin.auth().getUser(targetIdentifier);
    }

    const isAdmin = targetRole === 'admin';
    const claims = {
      role: targetRole,
      admin: isAdmin,
    };

    console.log(`[Admin CLI] Setting custom claims on UID ${userRecord.uid}:`, claims);
    await admin.auth().setCustomUserClaims(userRecord.uid, claims);

    console.log(`[Admin CLI] Updating Firestore /users/${userRecord.uid}...`);
    try {
      await admin.firestore().collection('users').doc(userRecord.uid).set(
        {
          uid: userRecord.uid,
          email: userRecord.email,
          role: targetRole,
          adminClaim: isAdmin,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch (fsErr) {
      console.warn('[Admin CLI] Firestore update warning:', fsErr.message);
    }

    console.log('---------------------------------------------------------');
    console.log(`✅ SUCCESS: Custom claims successfully set for ${userRecord.email} (${userRecord.uid})!`);
    console.log(`Role: ${targetRole.toUpperCase()}`);
    console.log(`Admin Claim: ${isAdmin}`);
    console.log('---------------------------------------------------------');
    console.log('NOTE: The user will need to refresh their token in the client app:');
    console.log('firebase.auth().currentUser.getIdToken(true);');
  } catch (error) {
    console.error('[Admin CLI] ❌ Error:', error.message || error);
    process.exit(1);
  }
}

setClaims();
