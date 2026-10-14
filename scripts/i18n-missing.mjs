/*
 * Liste les textes passés à t('...') qui n'ont pas encore de traduction arabe.
 *   node scripts/i18n-missing.mjs            -> affiche la liste (une clé JSON par ligne)
 * Le dictionnaire est lu via tsx-free regex sur src/i18n/ar*.ts (clés entre quotes ou identifiants).
 */
import fs from 'node:fs';
import path from 'node:path';

const dictFiles = fs.readdirSync('src/i18n').filter((f) => /^ar.*\.ts$/.test(f));
const dict = dictFiles.map((f) => fs.readFileSync(path.join('src/i18n', f), 'utf8')).join('\n');

const known = new Set();
for (const m of dict.matchAll(/^\s{2}(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"|([A-Za-zÀ-ÿ_$][\w$À-ÿ]*)):/gm)) {
  known.add((m[1] ?? m[2] ?? m[3]).replace(/\\'/g, "'"));
}

const files = [];
(function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (/\.tsx$/.test(name) && !/\.test\./.test(name)) files.push(p);
  }
})('src');

const missing = new Map();
for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  for (const m of src.matchAll(/\b(?:t|tr)\('((?:[^'\\]|\\.)*)'/g)) {
    const key = m[1].replace(/\\'/g, "'");
    if (!known.has(key)) missing.set(key, file);
  }
  for (const m of src.matchAll(/\b(?:t|tr)\("((?:[^"\\]|\\.)*)"/g)) {
    if (!known.has(m[1])) missing.set(m[1], file);
  }
}

console.log(`${missing.size} clé(s) sans traduction arabe`);
for (const key of missing.keys()) console.log(JSON.stringify(key));
