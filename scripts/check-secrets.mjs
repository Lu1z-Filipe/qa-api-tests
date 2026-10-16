// Varredura simples de segredos nos arquivos versionáveis. Falha (exit 1) se encontrar algo.
// Não substitui uma ferramenta dedicada; é uma rede de proteção barata para um repositório público.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const IGNORE = new Set(['node_modules', 'dist', '.git', 'reports', 'playwright-report', 'test-results']);
const PATTERNS = [
  ['GitHub token', /gh[pousr]_[A-Za-z0-9]{36,}/],
  ['GitHub fine-grained token', /github_pat_[A-Za-z0-9_]{50,}/],
  ['AWS access key', /AKIA[0-9A-Z]{16}/],
  ['Chave privada', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ['Atribuição de segredo', /(?:password|secret|token|api[_-]?key)\s*[:=]\s*['"][^'"\s]{12,}['"]/i],
];
// Credencial fictícia do app de demonstração, documentada nos READMEs.
const ALLOWED = ['Passw0rd!'];

const hits = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (IGNORE.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(js|mjs|json|html|css|md|yml|yaml|sql|txt)$/.test(name)) {
      const text = readFileSync(p, 'utf8');
      for (const [label, re] of PATTERNS) {
        const m = re.exec(text);
        if (m && !ALLOWED.some((a) => m[0].includes(a))) hits.push(`${p}: ${label}`);
      }
    }
  }
})(process.cwd());

if (hits.length) {
  console.error(`Possíveis segredos encontrados:\n${hits.join('\n')}`);
  process.exit(1);
}
console.log('Nenhum segredo encontrado.');
