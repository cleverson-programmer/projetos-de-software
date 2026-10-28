// Gera icones vetoriais (desenhados a mao em SVG, sem licenca de terceiros) -> PNG 1024x1024 transparente.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(here, '..', 'assets');
fs.mkdirSync(outDir, { recursive: true });

const S = 'stroke-linejoin="round" stroke-linecap="round"';

const person = (x, y, fill) => `
  <circle cx="${x}" cy="${y}" r="38" fill="${fill}" stroke="#1e293b" stroke-width="6"/>
  <circle cx="${x}" cy="${y - 8}" r="11" fill="#fff"/>
  <path d="M${x - 20} ${y + 24} q20 -26 40 0 z" fill="#fff"/>`;

const icons = {
  'moeda-cofrinho': `
    <circle cx="256" cy="86" r="50" fill="#fbbf24" stroke="#d97706" stroke-width="10"/>
    <text x="256" y="106" font-family="Segoe UI, Arial" font-weight="800" font-size="62" text-anchor="middle" fill="#b45309">$</text>
    <path d="M104 300 q-52 -6 -40 -48" fill="none" stroke="#db2777" stroke-width="10" ${S}/>
    <ellipse cx="250" cy="320" rx="152" ry="112" fill="#f9a8d4" stroke="#db2777" stroke-width="10"/>
    <polygon points="296,232 326,172 360,240" fill="#f472b6" stroke="#db2777" stroke-width="10" ${S}/>
    <rect x="148" y="400" width="48" height="64" rx="14" fill="#f472b6" stroke="#db2777" stroke-width="10"/>
    <rect x="304" y="400" width="48" height="64" rx="14" fill="#f472b6" stroke="#db2777" stroke-width="10"/>
    <rect x="372" y="292" width="66" height="62" rx="26" fill="#f472b6" stroke="#db2777" stroke-width="10"/>
    <circle cx="396" cy="323" r="7" fill="#9d174d"/><circle cx="416" cy="323" r="7" fill="#9d174d"/>
    <circle cx="338" cy="282" r="9" fill="#1e293b"/>
    <rect x="160" y="224" width="96" height="14" rx="7" fill="#9d174d"/>`,

  'capelo-livros': `
    <rect x="86" y="350" width="340" height="44" rx="8" fill="#3b82f6" stroke="#1d4ed8" stroke-width="8"/>
    <rect x="108" y="394" width="300" height="44" rx="8" fill="#22c55e" stroke="#15803d" stroke-width="8"/>
    <rect x="74" y="438" width="350" height="44" rx="8" fill="#f59e0b" stroke="#b45309" stroke-width="8"/>
    <path d="M146 236 v62 q110 58 220 0 v-62 l-110 46 z" fill="#475569" stroke="#1e293b" stroke-width="8" ${S}/>
    <polygon points="256,112 468,196 256,280 44,196" fill="#1e293b" stroke="#0f172a" stroke-width="8" ${S}/>
    <path d="M256 196 L430 214 V292" fill="none" stroke="#f59e0b" stroke-width="9" ${S}/>
    <circle cx="430" cy="302" r="16" fill="#fbbf24" stroke="#b45309" stroke-width="6"/>
    <circle cx="256" cy="196" r="10" fill="#fbbf24"/>`,

  'loja-vitrine': `
    <rect x="92" y="216" width="328" height="244" rx="10" fill="#fef3c7" stroke="#92400e" stroke-width="8"/>
    <rect x="212" y="316" width="88" height="144" rx="8" fill="#3b82f6" stroke="#1d4ed8" stroke-width="8"/>
    <circle cx="282" cy="392" r="6" fill="#fbbf24"/>
    <rect x="116" y="252" width="80" height="108" rx="8" fill="#bae6fd" stroke="#0369a1" stroke-width="8"/>
    <rect x="316" y="252" width="80" height="108" rx="8" fill="#bae6fd" stroke="#0369a1" stroke-width="8"/>
    ${[0, 1, 2, 3, 4, 5].map((i) => `<rect x="${64 + i * 64}" y="140" width="64" height="76" fill="${i % 2 ? '#fee2e2' : '#ef4444'}" stroke="#b91c1c" stroke-width="6"/>
    <path d="M${64 + i * 64} 216 a32 32 0 0 0 64 0 z" fill="${i % 2 ? '#fee2e2' : '#ef4444'}" stroke="#b91c1c" stroke-width="6" ${S}/>`).join('')}
    <rect x="186" y="62" width="140" height="62" rx="14" fill="#fbbf24" stroke="#b45309" stroke-width="8"/>
    <text x="256" y="106" font-family="Segoe UI, Arial" font-weight="800" font-size="36" text-anchor="middle" fill="#7c2d12">LOJA</text>`,

  'camadas-predio': (() => {
    const layer = (y, top, left, right) => `
      <polygon points="76,${y + 106} 256,${y + 176} 256,${y + 212} 76,${y + 142}" fill="${left}"/>
      <polygon points="436,${y + 106} 256,${y + 176} 256,${y + 212} 436,${y + 142}" fill="${right}"/>
      <polygon points="256,${y + 36} 436,${y + 106} 256,${y + 176} 76,${y + 106}" fill="${top}" stroke="#fff" stroke-width="4" ${S}/>`;
    return layer(250, '#60a5fa', '#2563eb', '#1d4ed8') + layer(170, '#4ade80', '#16a34a', '#15803d') + layer(90, '#fbbf24', '#d97706', '#b45309');
  })(),

  'dao-arquivo': `
    <rect x="116" y="50" width="280" height="412" rx="22" fill="#e0e7ff" stroke="#4338ca" stroke-width="10"/>
    ${[0, 1, 2].map((i) => `<rect x="140" y="${76 + i * 128}" width="232" height="108" rx="12" fill="#c7d2fe" stroke="#4338ca" stroke-width="8"/>
    <rect x="196" y="${100 + i * 128}" width="120" height="30" rx="6" fill="#fff" stroke="#4338ca" stroke-width="5"/>
    <rect x="226" y="${146 + i * 128}" width="60" height="16" rx="8" fill="#4338ca"/>`).join('')}
    <rect x="132" y="462" width="30" height="22" rx="4" fill="#4338ca"/><rect x="350" y="462" width="30" height="22" rx="4" fill="#4338ca"/>`,

  'checklist-guiche': `
    <rect x="104" y="80" width="304" height="396" rx="26" fill="#fff" stroke="#475569" stroke-width="10"/>
    <rect x="176" y="48" width="160" height="62" rx="16" fill="#94a3b8" stroke="#475569" stroke-width="8"/>
    ${[0, 1, 2].map((i) => `<rect x="140" y="${160 + i * 100}" width="52" height="52" rx="10" fill="#dcfce7" stroke="#16a34a" stroke-width="6"/>
    <path d="M152 ${186 + i * 100} l14 14 l24 -30" fill="none" stroke="#16a34a" stroke-width="10" ${S}/>
    <rect x="216" y="${172 + i * 100}" width="${[150, 120, 140][i]}" height="14" rx="7" fill="#cbd5e1"/>
    <rect x="216" y="${196 + i * 100}" width="${[100, 130, 90][i]}" height="12" rx="6" fill="#e2e8f0"/>`).join('')}`,

  'cadeado-seguranca': `
    <path d="M168 238 V170 a88 88 0 0 1 176 0 V238" fill="none" stroke="#64748b" stroke-width="38" ${S}/>
    <path d="M168 238 V170 a88 88 0 0 1 176 0 V238" fill="none" stroke="#cbd5e1" stroke-width="14" ${S}/>
    <rect x="112" y="226" width="288" height="236" rx="40" fill="#fbbf24" stroke="#b45309" stroke-width="10"/>
    <circle cx="256" cy="324" r="34" fill="#1e293b"/>
    <rect x="243" y="334" width="26" height="76" rx="12" fill="#1e293b"/>`,

  'arvore-genealogica': (() => {
    const lines = `<g fill="none" stroke="#94a3b8" stroke-width="8" ${S}>
      <path d="M256 128 V170 M150 170 H362 M150 170 V192 M362 170 V192"/>
      <path d="M150 268 V300 M90 300 H210 M90 300 V330 M210 300 V330"/>
      <path d="M362 268 V300 M302 300 H422 M302 300 V330 M422 300 V330"/></g>`;
    return lines + person(256, 90, '#8b5cf6') + person(150, 230, '#3b82f6') + person(362, 230, '#3b82f6') +
      person(90, 380, '#22c55e') + person(210, 380, '#22c55e') + person(302, 380, '#22c55e') + person(422, 380, '#22c55e');
  })(),

  'commit-rollback': `
    <circle cx="136" cy="256" r="100" fill="#dcfce7" stroke="#16a34a" stroke-width="12"/>
    <path d="M90 258 l32 32 l60 -70" fill="none" stroke="#16a34a" stroke-width="22" ${S}/>
    <circle cx="376" cy="256" r="100" fill="#fee2e2" stroke="#dc2626" stroke-width="12"/>
    <path d="M332.7 231 A50 50 0 1 1 332.7 281" fill="none" stroke="#dc2626" stroke-width="20" ${S}/>
    <polygon points="350,241 315.4,221 319.7,253.5" fill="#dc2626" stroke="#dc2626" stroke-width="6" ${S}/>
    <path d="M242 256 h28" stroke="#94a3b8" stroke-width="10" ${S}/>`,

  'tech-nodejs': `
    <polygon points="256,50 436,153 436,359 256,462 76,359 76,153" fill="#539e43" stroke="#3c7a2f" stroke-width="12" ${S}/>
    <text x="256" y="320" font-family="Segoe UI, Arial" font-weight="800" font-size="190" text-anchor="middle" fill="#fff">N</text>`,

  'tech-javascript': `
    <rect x="62" y="62" width="388" height="388" rx="36" fill="#f7df1e" stroke="#ca8a04" stroke-width="10"/>
    <text x="428" y="418" font-family="Segoe UI, Arial" font-weight="800" font-size="170" text-anchor="end" fill="#1e293b">JS</text>`,

  'tech-sqlite': `
    <path d="M110 120 v250 c0 48 66 80 146 80 s146 -32 146 -80 V120" fill="#0f80cc" stroke="#075985" stroke-width="10"/>
    <path d="M110 220 c0 48 66 80 146 80 s146 -32 146 -80 M110 320 c0 48 66 80 146 80 s146 -32 146 -80" fill="none" stroke="#bae6fd" stroke-width="10"/>
    <ellipse cx="256" cy="120" rx="146" ry="64" fill="#38bdf8" stroke="#075985" stroke-width="10"/>`,

  'tech-html-css': `
    <path d="M24 90 H244 L226 400 L134 440 L42 400 Z" fill="#e44d26" stroke="#9a3412" stroke-width="8" ${S}/>
    <path d="M268 90 H488 L470 400 L378 440 L286 400 Z" fill="#1572b6" stroke="#0c4a6e" stroke-width="8" ${S}/>
    <text x="134" y="285" font-family="Segoe UI, Arial" font-weight="800" font-size="62" text-anchor="middle" fill="#fff">HTML</text>
    <text x="378" y="285" font-family="Segoe UI, Arial" font-weight="800" font-size="62" text-anchor="middle" fill="#fff">CSS</text>`,

  'tech-api-rest': `
    <rect x="40" y="130" width="170" height="170" rx="26" fill="#ede9fe" stroke="#7c3aed" stroke-width="10"/>
    <rect x="302" y="130" width="170" height="170" rx="26" fill="#ede9fe" stroke="#7c3aed" stroke-width="10"/>
    <text x="125" y="244" font-family="Consolas, monospace" font-weight="800" font-size="84" text-anchor="middle" fill="#7c3aed">&lt;/&gt;</text>
    <text x="387" y="244" font-family="Consolas, monospace" font-weight="800" font-size="84" text-anchor="middle" fill="#7c3aed">{ }</text>
    <path d="M222 190 H290 M270 170 l22 20 l-22 20" fill="none" stroke="#22c55e" stroke-width="12" ${S}/>
    <path d="M290 240 H222 M242 220 l-22 20 l22 20" fill="none" stroke="#f59e0b" stroke-width="12" ${S}/>
    <text x="256" y="400" font-family="Segoe UI, Arial" font-weight="800" font-size="84" text-anchor="middle" fill="#4c1d95">REST</text>`,

  'tech-docker': `
    ${[0, 1, 2, 3].map((i) => `<rect x="${86 + i * 66}" y="206" width="58" height="50" rx="6" fill="#2496ed" stroke="#0b5ea8" stroke-width="5"/>`).join('')}
    ${[1, 2, 3].map((i) => `<rect x="${86 + i * 66}" y="150" width="58" height="50" rx="6" fill="#2496ed" stroke="#0b5ea8" stroke-width="5"/>`).join('')}
    <rect x="218" y="94" width="58" height="50" rx="6" fill="#2496ed" stroke="#0b5ea8" stroke-width="5"/>
    <path d="M30 270 H430 C458 270 474 250 480 224 C500 220 506 240 502 252 C494 330 410 440 250 440 C120 440 50 370 30 270 Z" fill="#2496ed" stroke="#0b5ea8" stroke-width="10" ${S}/>
    <circle cx="410" cy="318" r="10" fill="#fff"/>`,
};

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 512, height: 512 }, deviceScaleFactor: 2 });
for (const [name, body] of Object.entries(icons)) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">${body}</svg>`;
  fs.writeFileSync(path.join(outDir, `${name}.svg`), svg);
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`);
  await page.locator('svg').screenshot({ path: path.join(outDir, `${name}.png`), omitBackground: true });
  console.log('ok', name);
}
await browser.close();
