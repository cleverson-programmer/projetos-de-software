import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Carrega as variáveis de ambiente do arquivo `.env` (se existir) na raiz do projeto.
 * Variáveis já definidas no ambiente não são sobrescritas.
 * Deve ser o primeiro import dos pontos de entrada (server.js, importar_professores.mjs).
 */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const RAIZ_PROJETO = path.resolve(__dirname, '../..');

const arquivoEnv = path.join(RAIZ_PROJETO, '.env');

if (fs.existsSync(arquivoEnv)) {
  try {
    process.loadEnvFile(arquivoEnv);
  } catch (error) {
    console.warn(`[Config] Não foi possível ler o arquivo .env: ${error.message}`);
  }
}
