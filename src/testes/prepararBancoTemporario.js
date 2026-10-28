import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fecharDatabase } from '../config/database.js';

/**
 * Isola os testes do banco real. Deve ser o PRIMEIRO import de cada script de teste.
 *
 * Se `DB_PATH` não estiver definido, copia `database/moeda_estudantil.db` (quando existir;
 * senão o schema é aplicado em um banco novo) para uma pasta temporária, aponta `DB_PATH`
 * para essa cópia e a remove ao encerrar o processo.
 */
const __dirname = path.dirname(fileURLToPath(import.meta.url));

if (!process.env.DB_PATH || process.env.DB_PATH.trim() === '') {
  const bancoPadrao = path.resolve(__dirname, '../../database/moeda_estudantil.db');
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'moeda-estudantil-teste-'));
  const destino = path.join(pasta, 'teste.db');

  if (fs.existsSync(bancoPadrao)) {
    fs.copyFileSync(bancoPadrao, destino);
  }

  process.env.DB_PATH = destino;
  process.on('exit', () => {
    try {
      fecharDatabase();
      fs.rmSync(pasta, { recursive: true, force: true });
    } catch {
      // Falha ao limpar a pasta temporária não deve alterar o resultado dos testes.
    }
  });
}
