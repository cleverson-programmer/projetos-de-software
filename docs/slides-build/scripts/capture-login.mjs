// Captura real da tela de login (aba "Autenticacao (Login)") da aplicacao em http://localhost:3000
import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(here, '..', '..', 'tela-login.png');

// Chromium baixado pelo Playwright nao esta disponivel (download bloqueado); usa o Chrome instalado.
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
await page.click('button[data-tab="tab-login"]');
await page.waitForSelector('#tab-login.active #form-login', { state: 'visible' });
await page.waitForTimeout(500);
await page.screenshot({ path: out });
await browser.close();
console.log('Salvo em', out);
