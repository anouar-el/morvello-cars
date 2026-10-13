/*
 * Outil de migration : enveloppe les textes français visibles d'un composant React dans t('...').
 *
 *   node scripts/i18n-codemod.mjs src/components/Foo.tsx [autres fichiers…]
 *
 * Ce qu'il fait :
 *  - texte JSX (avec expressions simples fusionnées en {param}) -> {t('Texte {param}', { param })}
 *  - attributs title, placeholder, aria-label, alt, label -> {t('...')}
 *  - chaînes d'un ternaire / && / || placé en enfant JSX ou en valeur de ces attributs
 *  - ajoute `const { t } = useI18n();` en tête du composant et l'import
 * Ce qu'il ne fait pas (à traiter à la main, il les signale) : chaînes dans des tableaux d'objets,
 * fonctions utilitaires, composants à corps expression, fichiers où `t` est déjà un identifiant.
 * Les clés trouvées sont écrites dans scripts/i18n-keys.json.
 */
import ts from 'typescript';
import fs from 'node:fs';
import path from 'node:path';

const ATTRS = new Set(['title', 'placeholder', 'aria-label', 'alt', 'label']);
// Appels dont le premier argument est un message affiché à l'utilisateur.
const MESSAGE_CALLS = /^(?:window\.)?(?:alert|confirm|prompt)$|^set\w*(?:Error|Msg|Message|Toast|Notice|Warning|Feedback)\w*$/;
const ENTITIES = { '&amp;': '&', '&nbsp;': ' ', '&apos;': "'", '&quot;': '"', '&lt;': '<', '&gt;': '>', '&laquo;': '«', '&raquo;': '»', '&#39;': "'" };

const decode = (s) => s.replace(/&[a-z#0-9]+;/gi, (m) => ENTITIES[m] ?? m);
const hasLetters = (s) => /\p{L}{2,}/u.test(s.replace(/\{\w+\}/g, ''));
const looksLikeIdentifier = (s) => /^[a-z0-9_\-:./#]+$/.test(s) && s.length <= 24;

function quote(s) {
  if (!s.includes("'")) return `'${s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n')}'`;
  if (!s.includes('"')) return `"${s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n')}"`;
  return `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')}'`;
}

const allKeys = new Set();
const report = [];

function processFile(file) {
  const src = fs.readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX);
  const edits = [];
  const covered = [];
  const needsHook = new Set(); // fonctions composants
  let shadowed = false;

  const isCovered = (a, b) => covered.some(([s, e]) => a >= s && b <= e);
  const addEdit = (start, end, text) => {
    if (isCovered(start, end)) return;
    edits.push({ start, end, text });
    covered.push([start, end]);
  };

  // `t` déjà déclaré quelque part ? (paramètre, variable) -> on ne touche pas au fichier.
  (function scan(node) {
    if (
      (ts.isParameter(node) || ts.isVariableDeclaration(node) || ts.isBindingElement(node)) &&
      ts.isIdentifier(node.name) &&
      node.name.text === 't'
    ) {
      // const { t } = useI18n(); est le cas normal, pas une collision.
      const decl = ts.isBindingElement(node) ? node.parent?.parent : null;
      const fromHook = decl && ts.isVariableDeclaration(decl) && decl.initializer && ts.isCallExpression(decl.initializer) && decl.initializer.expression.getText(sf) === 'useI18n';
      if (!fromHook) shadowed = true;
    }
    ts.forEachChild(node, scan);
  })(sf);
  if (shadowed) {
    report.push(`${file}: identifiant « t » déjà utilisé — fichier ignoré (à traiter à la main)`);
    return;
  }

  const enclosingComponent = (node) => {
    let n = node.parent;
    while (n) {
      if (ts.isFunctionDeclaration(n) && n.name && /^[A-Z]/.test(n.name.text)) return n;
      if ((ts.isArrowFunction(n) || ts.isFunctionExpression(n)) && n.parent && ts.isVariableDeclaration(n.parent) && ts.isIdentifier(n.parent.name) && /^[A-Z]/.test(n.parent.name.text)) return n;
      n = n.parent;
    }
    return null;
  };

  const markUse = (node) => {
    const comp = enclosingComponent(node);
    if (comp) needsHook.add(comp);
    else report.push(`${file}:${sf.getLineAndCharacterOfPosition(node.getStart()).line + 1}: texte hors composant (t() non disponible)`);
    return comp;
  };

  const isSimpleExpr = (e) => {
    if (ts.isIdentifier(e)) return true;
    if (ts.isPropertyAccessExpression(e)) return isSimpleExpr(e.expression);
    if (ts.isNonNullExpression(e)) return isSimpleExpr(e.expression);
    if (ts.isElementAccessExpression(e)) return isSimpleExpr(e.expression) && (ts.isNumericLiteral(e.argumentExpression) || ts.isStringLiteral(e.argumentExpression) || ts.isIdentifier(e.argumentExpression));
    if (ts.isCallExpression(e)) return isSimpleExpr(e.expression) && e.arguments.every((a) => isSimpleExpr(a) || ts.isStringLiteral(a) || ts.isNumericLiteral(a));
    if (ts.isParenthesizedExpression(e)) return isSimpleExpr(e.expression);
    if (ts.isNumericLiteral(e) || ts.isStringLiteral(e)) return true;
    if (ts.isBinaryExpression(e)) {
      const k = e.operatorToken.kind;
      const ok = [ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken, ts.SyntaxKind.PlusToken, ts.SyntaxKind.MinusToken, ts.SyntaxKind.AsteriskToken].includes(k);
      return ok && isSimpleExpr(e.left) && isSimpleExpr(e.right);
    }
    return false;
  };

  const paramName = (e, used) => {
    let base = 'v';
    let e2 = ts.isParenthesizedExpression(e) ? e.expression : e;
    while (ts.isBinaryExpression(e2)) e2 = ts.isParenthesizedExpression(e2.left) ? e2.left.expression : e2.left;
    if (ts.isIdentifier(e2)) base = e2.text;
    else if (ts.isStringLiteral(e2) || ts.isNumericLiteral(e2)) base = 'v';
    else if (ts.isPropertyAccessExpression(e2)) {
      base = e2.name.text;
      if (base === 'length' && ts.isIdentifier(e2.expression)) base = `${e2.expression.text}Count`;
      else if (base === 'length' && ts.isPropertyAccessExpression(e2.expression)) base = `${e2.expression.name.text}Count`;
    } else if (ts.isCallExpression(e2)) {
      const c = e2.expression;
      const passthrough = new Set(['toLocaleString', 'toFixed', 'toUpperCase', 'toLowerCase', 'toString', 'trim', 'join', 'slice']);
      if (ts.isIdentifier(c)) base = c.text;
      else if (ts.isPropertyAccessExpression(c)) {
        if (passthrough.has(c.name.text)) return paramName(c.expression, used);
        base = c.name.text;
      }
    }
    base = base.replace(/[^A-Za-z0-9_]/g, '') || 'v';
    if (/^\d/.test(base)) base = `v${base}`;
    let name = base;
    let i = 2;
    while (used.has(name)) name = `${base}${i++}`;
    used.add(name);
    return name;
  };

  const tCall = (key, params) => {
    allKeys.add(key);
    return params.length ? `t(${quote(key)}, { ${params.map(([n, code]) => (n === code ? n : `${n}: ${code}`)).join(', ')} })` : `t(${quote(key)})`;
  };

  // Chaînes d'une expression (ternaire, &&, ||) -> t('...')
  const transformLeaves = (expr) => {
    if (!expr) return;
    if (ts.isParenthesizedExpression(expr)) return transformLeaves(expr.expression);
    if (ts.isConditionalExpression(expr)) {
      transformLeaves(expr.whenTrue);
      transformLeaves(expr.whenFalse);
      return;
    }
    if (ts.isBinaryExpression(expr)) {
      const k = expr.operatorToken.kind;
      if (k === ts.SyntaxKind.AmpersandAmpersandToken || k === ts.SyntaxKind.BarBarToken || k === ts.SyntaxKind.QuestionQuestionToken) {
        transformLeaves(expr.right);
      }
      return;
    }
    if (expr.parent && ts.isCallExpression(expr.parent) && ts.isIdentifier(expr.parent.expression) && expr.parent.expression.text === 't') return;
    if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) {
      const text = expr.text;
      if (hasLetters(text) && !looksLikeIdentifier(text)) {
        if (markUse(expr)) addEdit(expr.getStart(), expr.getEnd(), tCall(text, []));
      }
      return;
    }
    if (ts.isTemplateExpression(expr)) {
      let key = expr.head.text;
      const params = [];
      const used = new Set();
      let ok = true;
      for (const span of expr.templateSpans) {
        if (!isSimpleExpr(span.expression)) {
          ok = false;
          break;
        }
        const name = paramName(span.expression, used);
        params.push([name, span.expression.getText(sf)]);
        key += `{${name}}${span.literal.text}`;
      }
      if (ok && hasLetters(key) && key.length < 200) {
        if (markUse(expr)) addEdit(expr.getStart(), expr.getEnd(), tCall(key, params));
      }
      return;
    }
    if (ts.isJsxElement(expr) || ts.isJsxFragment(expr) || ts.isJsxSelfClosingElement(expr)) visit(expr);
  };

  const processChildren = (children) => {
    let run = [];
    const flush = () => {
      if (run.length === 0) return;
      const nodes = run;
      run = [];
      // texte statique présent ?
      let key = '';
      const params = [];
      const used = new Set();
      for (const n of nodes) {
        if (ts.isJsxText(n)) key += decode(src.slice(n.pos, n.end));
        else {
          const e = n.expression;
          const name = paramName(e, used);
          params.push([name, e.getText(sf)]);
          key += `{${name}}`;
        }
      }
      const collapsed = key.replace(/\s+/g, ' ').trim();
      if (!hasLetters(collapsed) || collapsed.length > 400) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const start = first.pos;
      const end = last.end;
      // espaces de bord conservés tels quels autour du { }
      const firstText = ts.isJsxText(first) ? src.slice(first.pos, first.end) : '';
      const lastText = ts.isJsxText(last) ? src.slice(last.pos, last.end) : '';
      const lead = firstText.match(/^\s*/)?.[0] ?? '';
      const trail = lastText.match(/\s*$/)?.[0] ?? '';
      if (!markUse(first)) return;
      addEdit(start, end, `${lead}{${tCall(collapsed, params)}}${trail}`);
    };

    for (const child of children) {
      if (ts.isJsxText(child)) {
        run.push(child);
      } else if (ts.isJsxExpression(child) && child.expression && isSimpleExpr(child.expression) && !ts.isStringLiteral(child.expression)) {
        // expression simple : fusionnée seulement si le run contient (ou contiendra) du texte
        run.push(child);
      } else {
        flush();
        if (ts.isJsxExpression(child) && child.expression) {
          transformLeaves(child.expression);
          descend(child.expression);
        }
        else if (ts.isJsxElement(child) || ts.isJsxSelfClosingElement(child) || ts.isJsxFragment(child)) visit(child);
      }
    }
    flush();
  };

  // Cherche des éléments JSX imbriqués dans une expression (callbacks de .map, fonctions de rendu…).
  const descend = (node) => {
    if (ts.isJsxElement(node) || ts.isJsxFragment(node) || ts.isJsxSelfClosingElement(node)) {
      visit(node);
      return;
    }
    ts.forEachChild(node, descend);
  };

  const visit = (node) => {
    if (ts.isJsxElement(node)) {
      handleAttributes(node.openingElement.attributes);
      processChildren(node.children);
      return;
    }
    if (ts.isJsxFragment(node)) {
      processChildren(node.children);
      return;
    }
    if (ts.isJsxSelfClosingElement(node)) {
      handleAttributes(node.attributes);
      return;
    }
    ts.forEachChild(node, visit);
  };

  const handleAttributes = (attrs) => {
    for (const attr of attrs.properties) {
      if (!ts.isJsxAttribute(attr) || !ts.isIdentifier(attr.name) || !attr.initializer) continue;
      const name = attr.name.text;
      if (!ATTRS.has(name)) continue;
      const init = attr.initializer;
      if (ts.isStringLiteral(init)) {
        const text = decode(init.text);
        if (hasLetters(text) && !looksLikeIdentifier(text) && markUse(init)) {
          addEdit(init.getStart(), init.getEnd(), `{${tCall(text, [])}}`);
        }
      } else if (ts.isJsxExpression(init) && init.expression) {
        transformLeaves(init.expression);
        descend(init.expression);
      }
    }
  };

  // Parcours : on cherche les racines JSX (return (...), expressions) puis on descend dans les éléments.
  (function walk(node) {
    if (ts.isCallExpression(node) && node.arguments.length > 0) {
      const callee = node.expression.getText(sf);
      if (MESSAGE_CALLS.test(callee)) transformLeaves(node.arguments[0]);
    }
    if (ts.isJsxElement(node) || ts.isJsxFragment(node) || ts.isJsxSelfClosingElement(node)) {
      visit(node);
      return; // visit gère les descendants JSX
    }
    ts.forEachChild(node, walk);
  })(sf);

  // Deuxième passe : appels de messages, y compris dans les gestionnaires d'événements JSX.
  (function messageCalls(node) {
    if (ts.isCallExpression(node) && node.arguments.length > 0) {
      const callee = node.expression.getText(sf);
      if (MESSAGE_CALLS.test(callee)) transformLeaves(node.arguments[0]);
    }
    ts.forEachChild(node, messageCalls);
  })(sf);

  if (edits.length === 0) {
    report.push(`${file}: rien à traduire`);
    return;
  }

  // Insertion du hook dans chaque composant concerné
  const hookLine = 'const { t } = useI18n();';
  const insertions = [];
  for (const comp of needsHook) {
    if (!comp.body || !ts.isBlock(comp.body)) {
      report.push(`${file}: composant à corps expression — ajouter useI18n à la main`);
      continue;
    }
    const bodyText = comp.body.getText(sf);
    if (/\bconst \{[^}]*\bt\b[^}]*\} = useI18n\(\)/.test(bodyText)) continue;
    const braceEnd = comp.body.getStart() + 1;
    const bodyLine = sf.getLineAndCharacterOfPosition(comp.body.getStart()).line;
    const lineText = src.split('\n')[bodyLine] ?? '';
    const indent = (lineText.match(/^\s*/)?.[0] ?? '') + '  ';
    insertions.push({ start: braceEnd, end: braceEnd, text: `\n${indent}${hookLine}` });
  }

  let out = src;
  const all = [...edits, ...insertions].sort((a, b) => b.start - a.start || b.end - a.end);
  for (const e of all) out = out.slice(0, e.start) + e.text + out.slice(e.end);

  if (!/from '[^']*i18n\/I18nContext'/.test(out)) {
    const rel = path.relative(path.dirname(file), path.join('src', 'i18n', 'I18nContext')).replace(/\\/g, '/');
    const importLine = `import { useI18n } from '${rel.startsWith('.') ? rel : './' + rel}';`;
    const matches = [...out.matchAll(/^import[\s\S]*?;\s*$/gm)];
    const last = matches[matches.length - 1];
    const at = last ? last.index + last[0].length : 0;
    out = out.slice(0, at) + '\n' + importLine + out.slice(at);
  }

  fs.writeFileSync(file, out, 'utf8');
  report.push(`${file}: ${edits.length} texte(s) enveloppé(s), ${insertions.length} hook(s)`);
}

for (const file of process.argv.slice(2)) processFile(file);

const keysPath = path.join('scripts', 'i18n-keys.json');
const previous = fs.existsSync(keysPath) ? JSON.parse(fs.readFileSync(keysPath, 'utf8')) : [];
const merged = Array.from(new Set([...previous, ...allKeys])).sort();
fs.writeFileSync(keysPath, JSON.stringify(merged, null, 2), 'utf8');
console.log(report.join('\n'));
console.log(`\n${allKeys.size} clé(s) nouvelle(s) dans cette passe, ${merged.length} au total.`);
