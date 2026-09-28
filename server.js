/**
 * Morvello Cars — Root Production Startup File for Hostinger / hPanel Node.js Selector
 *
 * This file serves exclusively as a bridge for hosting providers that expect a root-level
 * startup file (e.g. server.js). It delegates execution directly to the compiled production
 * bundle located at dist/server.cjs without duplicating Express instances or business logic.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

const bundlePath = path.resolve(__dirname, 'dist', 'server.cjs');

if (!fs.existsSync(bundlePath)) {
  console.error(`[Morvello Cars] Error: Compiled server bundle not found at: ${bundlePath}`);
  console.error('[Morvello Cars] Hostinger deployment requires "npm run build" to generate dist/server.cjs and dist/index.html.');
  process.exit(1);
}

// Ensure NODE_ENV defaults to production when started through server.js
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'production';
}

require(bundlePath);
