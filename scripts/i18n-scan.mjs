/*
 * Liste les chaînes françaises encore « en dur » dans des fichiers .tsx, hors t('...').
 *   node scripts/i18n-scan.mjs src/components/Foo.tsx [...]
 * Sert à repérer ce que l'outil de migration n'a pas pu envelopper automatiquement.
 */
import ts from 'typescript';
import fs from 'node:fs';

const FR = /[À-ÿ]|\b(le|la|les|des|du|de|un|une|et|ou|pour|sur|avec|sans|dans|est|sont|pas|votre|vos|aucun|aucune|date|numéro|montant|client|contrat|caution)\b/i;
const SKIP_ATTRS = new Set(['className', 'key', 'type', 'id', 'name', 'value', 'htmlFor', 'href', 'target', 'rel', 'style', 'role', 'to', 'viewBox', 'd', 'fill']);

for (const file of process.argv.slice(2)) {
  const src = fs.readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX);
  const out = [];
  (function walk(n) {
    // Texte JSX resté en clair (hors { t(...) })
    if (ts.isJsxText(n)) {
      const text = src.slice(n.pos, n.end).replace(/\s+/g, ' ').trim();
      if (/\p{L}{2,}/u.test(text)) {
        const { line } = sf.getLineAndCharacterOfPosition(n.pos);
        out.push(`${file}:${line + 1}: [JSX] ${text.slice(0, 120)}`);
      }
    }
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isTemplateExpression(n)) {
      const text = ts.isTemplateExpression(n) ? n.head.text + n.templateSpans.map((s) => '${…}' + s.literal.text).join('') : n.text;
      const p = n.parent;
      const inT = p && ts.isCallExpression(p) && ts.isIdentifier(p.expression) && p.expression.text === 't';
      const inImport = p && (ts.isImportDeclaration(p) || ts.isExportDeclaration(p));
      const inAttr = p && ts.isJsxAttribute(p) && SKIP_ATTRS.has(p.name.text);
      const inCompare =
        p && ts.isBinaryExpression(p) && [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken].includes(p.operatorToken.kind);
      const isConsole = p && ts.isCallExpression(p) && /^console\./.test(p.expression.getText(sf));
      if (!inT && !inImport && !inAttr && !inCompare && !isConsole && /\p{L}{3,}/u.test(text) && FR.test(text) && /\s/.test(text.trim()) && text.length > 6) {
        const { line } = sf.getLineAndCharacterOfPosition(n.getStart());
        out.push(`${file}:${line + 1}: ${text.replace(/\s+/g, ' ').slice(0, 120)}`);
      }
    }
    ts.forEachChild(n, walk);
  })(sf);
  if (out.length) console.log(out.join('\n'));
}
