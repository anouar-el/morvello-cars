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

import { initializeApp, getApps, cert } from 'firebase-admin/app';
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
const configPath = path.resolve(__dirname, '../firebase-applet-config.json');
try {
  let projectId = 'reference-unity-289300';
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    projectId = config.projectId || projectId;
  }

  // Check for local Service Account Key
  const potentialKeyPaths = [
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
    path.resolve(__dirname, '../serviceAccountKey.json'),
    path.resolve(__dirname, '../firebase-service-account.json'),
    path.resolve(__dirname, '../service-account.json')
  ].filter(Boolean);

  let credential = undefined;
  for (const p of potentialKeyPaths) {
    if (fs.existsSync(p)) {
      try {
        const saJson = JSON.parse(fs.readFileSync(p, 'utf8'));
        credential = cert(saJson);
        projectId = saJson.project_id || projectId;
        console.log(`[Admin CLI] Using Service Account Key from: ${p}`);
        break;
      } catch (err) {
        console.warn(`[Admin CLI] Failed to parse service account from ${p}:`, err.message);
      }
    }
  }

  const existing = getApps();
  if (existing.length > 0) {
    app = existing[0];
  } else {
    app = initializeApp({
      projectId: projectId,
      ...(credential ? { credential } : {})
    });
  }
  console.log(`[Admin CLI] Initialized Firebase Admin for project: ${projectId}`);
} catch (e) {
  console.error('[Admin CLI] Initialization error:', e.message);
}

async function setClaims() {
  try {
    const auth = getAuth();
    let databaseId = undefined;
    if (fs.existsSync(configPath)) {
      try {
        const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        if (cfg.firestoreDatabaseId) databaseId = cfg.firestoreDatabaseId;
      } catch (_) {}
    }
    const firestore = databaseId ? getFirestore(databaseId) : getFirestore();
    let userRecord;
    if (targetIdentifier.includes('@')) {
      const emailLower = targetIdentifier.toLowerCase();
      console.log(`[Admin CLI] Looking up user by email: ${emailLower}...`);
      try {
        userRecord = await auth.getUserByEmail(emailLower);
      } catch (findErr) {
        if (findErr.code === 'auth/user-not-found') {
          console.log(`[Admin CLI] User ${emailLower} not found in Firebase Auth. Creating new user record...`);
          userRecord = await auth.createUser({
            email: emailLower,
            displayName: emailLower.split('@')[0],
            emailVerified: true,
          });
          console.log(`[Admin CLI] Created user ${emailLower} with UID: ${userRecord.uid}`);
        } else {
          throw findErr;
        }
      }
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
