import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
async function visit(folder) {
  const result = [];
  for (const entry of await fs.readdir(folder, { withFileTypes: true })) {
    const target = path.join(folder, entry.name);
    if (entry.isDirectory()) result.push(...await visit(target));
    else if (/\.(js|mjs)$/.test(entry.name)) result.push(target);
  }
  return result;
}
let checked = 0;
for (const folder of ['src', 'public', 'database', 'scripts']) {
  for (const file of await visit(path.join(root, folder))) {
    const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8', windowsHide: true });
    if (result.status !== 0) throw new Error(result.stderr || 'Falha de sintaxe: ' + file);
    checked++;
  }
}
// Importa módulos sem inicializar servidor, migrations ou jobs e sem executar testes.
await import(pathToFileURL(path.join(root, 'src/server.js')).href);
await import(pathToFileURL(path.join(root, 'database/migrations/003_dados_iniciais.mjs')).href);
const html = await fs.readFile(path.join(root, 'public/index.html'), 'utf8');
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((item) => item[1]);
if (new Set(ids).size !== ids.length) throw new Error('IDs duplicados no HTML.');
const app = await fs.readFile(path.join(root, 'public/app.js'), 'utf8');
for (const match of app.matchAll(/\$\('#([a-zA-Z0-9_-]+)'\)/g)) {
  if (!ids.includes(match[1])) throw new Error('Elemento da interface não encontrado: ' + match[1]);
}
console.log('Verificação concluída: ' + checked + ' arquivos, importações e referências da interface. Nenhum teste executado.');
