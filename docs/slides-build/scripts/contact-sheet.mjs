// Gera uma folha de contato dos icones (apenas para conferencia visual) em $TEMP\icons-sheet.png
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dir = path.resolve(here, '..', 'assets');
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.png'));
const html = `<body style="margin:0;background:#fff;display:grid;grid-template-columns:repeat(5,240px);gap:8px;padding:8px;font:14px Arial">` +
  files.map((f) => `<div style="text-align:center"><img src="file:///${path.join(dir, f).replace(/\\/g, '/')}" width="220"><br>${f}</div>`).join('') + '</body>';
const out = path.join(os.tmpdir(), 'icons-sheet.png');
fs.writeFileSync(path.join(os.tmpdir(), 'icons-sheet.html'), html);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto('file:///' + path.join(os.tmpdir(), 'icons-sheet.html').replace(/\\/g, '/'));
await page.waitForTimeout(500);
await page.screenshot({ path: out, fullPage: true });
await browser.close();
console.log(out);
