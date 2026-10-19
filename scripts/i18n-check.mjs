import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { translations } from '../src/locales/translations.js';

const root = path.resolve('src');
const out = path.resolve('reports/i18n-coverage.md');
const uiAttributes = new Set(['placeholder', 'title', 'alt', 'aria-label', 'aria-description', 'label', 'description']);
const values = object => Object.entries(object).flatMap(([key, value]) => value && typeof value === 'object' && !Array.isArray(value)
  ? values(value).map(([child, text]) => [`${key}.${child}`, text]) : [[key, value]]);
const canonical = new Map(values(translations.en));
const variables = value => new Set([...String(value).matchAll(/\{([A-Za-z]\w*)\}/g)].map(match => match[1]));
const issues = [];
const localeDetails = {};
const sourceKeys = new Set();
const hardcoded = [];
const duplicate = [];
const walkFiles = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory()
  ? walkFiles(path.join(dir, entry.name)) : /\.[jt]sx?$/.test(entry.name) ? [path.join(dir, entry.name)] : []);

for (const file of walkFiles(root)) {
  if (file.includes(`${path.sep}locales${path.sep}`)) continue;
  const source = fs.readFileSync(file, 'utf8');
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.JS);
  const location = node => `${path.relative(process.cwd(), file).replaceAll('\\', '/')}:${ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1}`;
  const addHardcoded = (node, value) => {
    const clean = value.replace(/\s+/g, ' ').trim();
    if (/[A-Za-zÀ-ž]{2}/.test(clean) && !/^(https?:|data:|[a-z-]+\.[a-z-]+$)/i.test(clean)) hardcoded.push(`${location(node)} ${clean.slice(0, 110)}`);
  };
  const visit = node => {
    if (ts.isCallExpression(node) && node.expression.getText(ast) === 't' && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) sourceKeys.add(node.arguments[0].text);
    if (ts.isJsxText(node)) addHardcoded(node, node.getText(ast));
    if (ts.isJsxAttribute(node) && uiAttributes.has(node.name.text) && node.initializer && ts.isStringLiteral(node.initializer)) addHardcoded(node, node.initializer.text);
    if (ts.isCallExpression(node) && ['alert', 'confirm', 'prompt', 'setError', 'setMessage', 'toast.error', 'toast.success', 'toast.warning', 'toast.info'].includes(node.expression.getText(ast)) && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) addHardcoded(node, node.arguments[0].text);
    if (ts.isJsxExpression(node) && node.expression && ts.isStringLiteral(node.expression)) addHardcoded(node, node.expression.text);
    ts.forEachChild(node, visit);
  };
  visit(ast);
}

for (const file of walkFiles(path.join(root, 'locales')).filter(name => /translations_[\w-]+\.js$/.test(name))) {
  const ast = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const checkObject = (node, prefix = '') => {
    if (!ts.isObjectLiteralExpression(node)) return;
    const seen = new Set();
    for (const property of node.properties) {
      if (!ts.isPropertyAssignment(property)) continue;
      const key = property.name.getText(ast).replace(/^['"]|['"]$/g, '');
      if (seen.has(key)) duplicate.push(`${path.basename(file)}: ${prefix}${key}`);
      seen.add(key);
      checkObject(property.initializer, `${prefix}${key}.`);
    }
  };
  ts.forEachChild(ast, node => { if (ts.isExportAssignment(node)) checkObject(node.expression); });
}

const lines = ['# Localization coverage', '', `Generated: ${new Date().toISOString()}`, '', 'Counts describe catalog entries, not fully localized screens. Identical values can be legitimate names or untranslated copy.', '', '| Locale | Keys | Missing | Extra | Placeholder errors | Same as English | Coverage |', '|---|---:|---:|---:|---:|---:|---:|'];
const namespaceCoverage = [];
for (const [locale, dictionary] of Object.entries(translations)) {
  const local = new Map(values(dictionary));
  const missing = [...canonical.keys()].filter(key => !local.has(key) || local.get(key) === '');
  const extra = [...local.keys()].filter(key => !canonical.has(key));
  const placeholders = [...canonical].filter(([key, text]) => local.has(key) && (variables(text).size !== variables(local.get(key)).size || [...variables(text)].some(name => !variables(local.get(key)).has(name)))).map(([key]) => key);
  const same = [...canonical].filter(([key, text]) => locale !== 'en' && local.get(key) === text && /[A-Za-z]{4}/.test(text)).map(([key]) => key);
  localeDetails[locale] = { missing, extra, placeholders, sameAsEnglish: same };
  lines.push(`| ${locale} | ${local.size} | ${missing.length} | ${extra.length} | ${placeholders.length} | ${same.length} | ${((canonical.size - missing.length) / canonical.size * 100).toFixed(1)}% |`);
  namespaceCoverage.push(`| ${locale} | ${Object.keys(translations.en).map(namespace => {
    const keys = [...canonical.keys()].filter(name => name.startsWith(`${namespace}.`));
    return `${namespace}: ${((keys.filter(name => local.has(name) && local.get(name) !== '').length / keys.length) * 100).toFixed(0)}%`;
  }).join(' · ')} |`);
  if (missing.length || extra.length || placeholders.length || same.length) issues.push(`${locale}: ${missing.length} missing (${missing.slice(0, 12).join(', ') || 'none'}${missing.length > 12 ? ', …' : ''}); ${extra.length} extra; ${placeholders.length} placeholder errors; ${same.length} possible untranslated values`);
}
const unknown = [...sourceKeys].filter(key => !canonical.has(key) && !canonical.has(`${key}_one`) && !canonical.has(`${key}_other`));
lines.push('', '## Coverage by namespace', '', '| Locale | Namespace coverage |', '|---|---|', ...namespaceCoverage, '', '## Source keys absent from English', '', ...unknown.map(key => `- ${key}`), '', '## Duplicate keys', '', ...duplicate.map(key => `- ${key}`), '', `## Hardcoded UI candidates (${hardcoded.length})`, '', ...hardcoded.map(item => `- ${item}`), '', '## Locale issues', '', 'The first 12 missing keys for each locale appear below. The companion `i18n-issues.json` contains every key, placeholder error, and suspected untranslated value.', '', ...issues.map(item => `- ${item}`), '');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, lines.join('\n'));
fs.writeFileSync(path.resolve('reports/i18n-issues.json'), JSON.stringify({ generated: new Date().toISOString(), canonicalKeys: canonical.size, locales: localeDetails, unknownSourceKeys: unknown, duplicateKeys: duplicate, hardcodedCandidates: hardcoded }, null, 2) + '\n');
console.log(`Wrote ${out}`);
console.log(`${canonical.size} English keys; ${unknown.length} unknown source keys; ${duplicate.length} duplicate keys; ${hardcoded.length} hardcoded UI candidates`);
for (const [locale, dictionary] of Object.entries(translations)) console.log(`${locale}: ${((new Map(values(dictionary)).size / canonical.size) * 100).toFixed(1)}% catalog coverage`);
if (process.argv.includes('--strict') && (unknown.length || duplicate.length || hardcoded.length || Object.values(localeDetails).some(detail => detail.missing.length || detail.extra.length || detail.placeholders.length))) process.exitCode = 1;
