/**
 * Compiles design-system/tokens.json (the Mutabaa design system, the single source of truth for every
 * colour, size and radius) into src/styles/tokens.css. Run with `npm run tokens` after editing tokens.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

type Themed = string | Record<string, string>;
interface Token { name: string; value: Themed; usage?: string }
interface Tokens {
  color: { themes: { id: string }[]; tokens: Token[] };
  type: { families: Record<string, string>; groups: { family: string; styles: { name: string; fontSize: string; lineHeight: string; fontWeight: number | string }[] }[] };
  spacing: { tokens: Token[] };
  radius: { tokens: Token[] };
  shadow?: { tokens: Token[] };
}

const root = path.resolve(import.meta.dirname, '..');
const t = JSON.parse(readFileSync(path.join(root, 'design-system/tokens.json'), 'utf8')) as Tokens;
const [first, ...rest] = t.color.themes.map((x) => x.id);
const val = (tok: Token, theme: string) => (typeof tok.value === 'string' ? tok.value : (tok.value[theme] ?? tok.value[first]));
const themed = [...t.color.tokens, ...(t.shadow?.tokens ?? [])];

const out: string[] = ['/* Mutabaa — generated from design-system/tokens.json by scripts/build-tokens.ts. Do not edit. */'];
out.push(`:root, [data-theme="${first}"] {`, ...themed.map((x) => `  --${x.name}: ${val(x, first)};`), '}');
for (const theme of rest) {
  out.push(`[data-theme="${theme}"] {`, ...themed.map((x) => `  --${x.name}: ${val(x, theme)};`), '  color-scheme: dark;', '}');
}
out.push(':root {');
for (const x of [...t.spacing.tokens, ...t.radius.tokens]) out.push(`  --${x.name}: ${x.value as string};`);
for (const [k, v] of Object.entries(t.type.families)) out.push(`  --font-${k}: ${v};`);
out.push('}');
for (const g of t.type.groups) {
  for (const s of g.styles) out.push(`.${s.name} { font-family: var(--font-${g.family}); font-size: ${s.fontSize}; line-height: ${s.lineHeight}; font-weight: ${s.fontWeight}; }`);
}
writeFileSync(path.join(root, 'src/styles/tokens.css'), `${out.join('\n')}\n`);
console.log(`tokens.css written (${t.color.tokens.length} colours × ${t.color.themes.length} themes).`);
