/*
 * Remplace les classes Tailwind « physiques » (gauche/droite) par leurs équivalents logiques
 * (début/fin) pour que la mise en page se retourne toute seule en mode arabe (RTL).
 *   node scripts/i18n-rtl-classes.mjs src/components/Foo.tsx [...]
 * Ne touche pas à `left-1/2` & co (centrage avec translate) ni aux classes déjà logiques.
 */
import fs from 'node:fs';

const RULES = [
  [/(?<![\w])(-?)ml-/g, '$1ms-'],
  [/(?<![\w])(-?)mr-/g, '$1me-'],
  [/(?<![\w])pl-/g, 'ps-'],
  [/(?<![\w])pr-/g, 'pe-'],
  [/(?<![\w])text-left(?![\w-])/g, 'text-start'],
  [/(?<![\w])text-right(?![\w-])/g, 'text-end'],
  [/(?<![\w])(-?)left-(?!1\/2)/g, '$1start-'],
  [/(?<![\w])(-?)right-/g, '$1end-'],
  [/(?<![\w])border-l(?![\w])/g, 'border-s'],
  [/(?<![\w])border-r(?![\w])/g, 'border-e'],
  [/(?<![\w])border-l-/g, 'border-s-'],
  [/(?<![\w])border-r-/g, 'border-e-'],
  [/(?<![\w])rounded-l(?![\w])/g, 'rounded-s'],
  [/(?<![\w])rounded-r(?![\w])/g, 'rounded-e'],
  [/(?<![\w])rounded-l-/g, 'rounded-s-'],
  [/(?<![\w])rounded-r-/g, 'rounded-e-'],
];

let total = 0;
for (const file of process.argv.slice(2)) {
  let src = fs.readFileSync(file, 'utf8');
  const before = src;
  // Uniquement dans les attributs className="…" et les gabarits de classes (chaînes) : on évite le code.
  src = src.replace(/(className=(?:"[^"]*"|\{`[^`]*`\}|\{'[^']*'\}))|((?:'|")[a-z0-9:\-\s\/\[\]\.#%_()]*(?:ml-|mr-|pl-|pr-|text-left|text-right|left-|right-|border-l|border-r|rounded-l|rounded-r)[a-z0-9:\-\s\/\[\]\.#%_()]*(?:'|"))/g, (m) => {
    let out = m;
    for (const [re, to] of RULES) out = out.replace(re, to);
    return out;
  });
  // Flèches : se retournent en RTL
  src = src.replace(/<(ArrowRight|ArrowLeft|ChevronRight|ChevronLeft)(\s+)className="([^"]*)"/g, (m, name, sp, cls) =>
    cls.includes('rtl:rotate-180') ? m : `<${name}${sp}className="${cls} rtl:rotate-180"`
  );
  if (src !== before) {
    fs.writeFileSync(file, src, 'utf8');
    total += 1;
    console.log(`modifié : ${file}`);
  }
}
console.log(`${total} fichier(s) modifié(s)`);
