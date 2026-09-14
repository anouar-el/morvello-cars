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

import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const targetIdentifier = process.argv[2] || 'anouar7fac@gmail.com';
const targetRole = process.argv[3] || 'admin';

// Initialize Firebase Admin SDK
let app;
try {
  const configPath = path.resolve(__dirname, '../firebase-applet-config.json');
  let projectId = 'reference-unity-289300';
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    projectId = config.projectId || projectId;
  }

  const existing = getApps();
  if (existing.length > 0) {
    app = existing[0];
  } else {
    app = initializeApp({
      projectId: projectId,
    });
  }
  console.log(`[Admin CLI] Initialized Firebase Admin for project: ${projectId}`);
} catch (e) {
  console.error('[Admin CLI] Initialization error:', e.message);
}

async function setClaims() {
  try {
    const auth = getAuth();
    const firestore = getFirestore();
    let userRecord;
    if (targetIdentifier.includes('@')) {
      console.log(`[Admin CLI] Looking up user by email: ${targetIdentifier}...`);
      userRecord = await auth.getUserByEmail(targetIdentifier.toLowerCase());
    } else {
      console.log(`[Admin CLI] Looking up user by UID: ${targetIdentifier}...`);
      userRecord = await auth.getUser(targetIdentifier);
    }

    const isAdmin = targetRole === 'admin';
    const claims = {
      role: targetRole,
      admin: isAdmin,
    };

    console.log(`[Admin CLI] Setting custom claims on UID ${userRecord.uid}:`, claims);
    await auth.setCustomUserClaims(userRecord.uid, claims);

    console.log(`[Admin CLI] Updating Firestore /users/${userRecord.uid}...`);
    try {
      await firestore.collection('users').doc(userRecord.uid).set(
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
