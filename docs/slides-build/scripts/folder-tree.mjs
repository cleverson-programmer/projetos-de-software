// Gera docs/estrutura-pastas.png a partir da arvore REAL do projeto (tema claro, via Chromium/Chrome).
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..', '..');
const out = path.resolve(root, 'docs', 'estrutura-pastas.png');

const OMIT = new Set(['.git', 'node_modules', 'slides-build']);
// papel de cada pasta (chave = caminho relativo com /)
const ROLES = {
  'database': ['Banco de dados', 'db'],
  'docs': ['Documentação', 'doc'],
  'public': ['View', 'view'],
  'src': ['Back-end', 'src'],
  'src/config': ['Config', 'cfg'],
  'src/controllers': ['Controller', 'ctl'],
  'src/dao': ['DAO', 'dao'],
  'src/models': ['Model', 'mod'],
  'src/services': ['Service', 'svc'],
};
// pastas dentro de docs: mostra so arquivos de nivel superior e contagem
const COLLAPSE_FILES = new Set(['docs/Sprint 1', 'docs/Sprint-2']);

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

function walk(dirAbs, rel) {
  const entries = fs.readdirSync(dirAbs, { withFileTypes: true })
    .filter((e) => !OMIT.has(e.name))
    .sort((a, b) => (b.isDirectory() - a.isDirectory()) || a.name.localeCompare(b.name, 'pt'));
  return entries.map((e) => {
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) {
      const abs = path.join(dirAbs, e.name);
      if (COLLAPSE_FILES.has(r)) {
        const n = fs.readdirSync(abs).length;
        return { name: e.name, dir: true, role: null, note: `${n} arquivos (diagramas UML/ER)`, children: [] };
      }
      return { name: e.name, dir: true, role: ROLES[r] || null, children: walk(abs, r) };
    }
    return { name: e.name, dir: false };
  });
}

const tree = walk(root, '');

function render(nodes) {
  return '<ul>' + nodes.map((n) => {
    if (n.dir) {
      const tag = n.role ? `<span class="tag ${n.role[1]}">${esc(n.role[0])}</span>` : '';
      const note = n.note ? `<span class="note">${esc(n.note)}</span>` : '';
      return `<li><span class="dir">📁 ${esc(n.name)}/</span>${tag}${note}${n.children.length ? render(n.children) : ''}</li>`;
    }
    const cls = n.name.endsWith('.js') || n.name.endsWith('.mjs') ? 'js' : '';
    return `<li><span class="file ${cls}">📄 ${esc(n.name)}</span></li>`;
  }).join('') + '</ul>';
}

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box}
body{margin:0;background:#fff;font-family:'Segoe UI',Arial,sans-serif;color:#1f2937}
.wrap{width:1800px;padding:40px 56px}
h1{margin:0 0 6px;font-size:40px;color:#0f172a}
.sub{color:#64748b;font-size:22px;margin-bottom:24px}
.root{font-size:28px;font-weight:700;color:#0f172a;margin-bottom:6px}
ul{list-style:none;margin:0;padding-left:34px;border-left:2px solid #e2e8f0;margin-left:10px}
.root-ul{border-left:none;padding-left:0;margin-left:0}
.cols{display:grid;grid-template-columns:1fr 1fr;gap:40px}
li{margin:5px 0;font-size:26px;line-height:1.35}
.dir{font-weight:700;color:#0f172a}
.file{color:#475569}
.file.js{color:#334155}
.tag{display:inline-block;margin-left:14px;padding:1px 14px;border-radius:999px;font-size:22px;font-weight:600;border:2px solid}
.tag::before{content:'(';} .tag::after{content:')';}
.tag.mod{background:#e0f2fe;color:#0369a1;border-color:#7dd3fc}
.tag.view{background:#fce7f3;color:#be185d;border-color:#f9a8d4}
.tag.ctl{background:#dcfce7;color:#15803d;border-color:#86efac}
.tag.svc{background:#fef3c7;color:#b45309;border-color:#fcd34d}
.tag.dao{background:#ede9fe;color:#6d28d9;border-color:#c4b5fd}
.tag.cfg{background:#f1f5f9;color:#475569;border-color:#cbd5e1}
.tag.db,.tag.doc,.tag.src{background:#f8fafc;color:#475569;border-color:#cbd5e1}
.note{margin-left:14px;color:#64748b;font-size:22px;font-style:italic}
</style></head><body><div class="wrap">
<h1>Estrutura de pastas do projeto</h1>
<div class="sub">Sistema de Moeda Estudantil · arquitetura MVC + DAO</div>
<div class="root">📦 projetos-de-software/</div>
<div class="cols">
<div class="root-ul">${render(tree.filter((n) => n.name !== 'src')).replace('<ul>', '<ul class="root-ul">')}</div>
<div class="root-ul">${render(tree.filter((n) => n.name === 'src')).replace('<ul>', '<ul class="root-ul">')}</div>
</div>
</div></body></html>`;

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1800, height: 1000 }, deviceScaleFactor: 1 });
await page.setContent(html);
await page.locator('.wrap').screenshot({ path: out });
await browser.close();
console.log('Salvo em', out);
