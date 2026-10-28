import './config/env.js';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { LIMITE_CORPO_BYTES } from './config/regras.js';
import { getDatabase } from './config/database.js';
import { rotas } from './routes.js';
import { autenticarRequisicao, exigirPerfil, exigirProprietario, obterSegredo } from './middleware/auth.js';
import { criarErro, traduzirErroBanco } from './utils/erros.js';
import { avisarConfiguracaoEmail } from './config/mail.js';
import { iniciarCreditoSemestral } from './jobs/creditoSemestralJob.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.resolve(__dirname, '../public');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
};

// A política exige front-end sem scripts/estilos inline (somente arquivos da própria origem).
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' https: data:",
  "connect-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

function corpoGrandeDemais() {
  return criarErro(413, 'O corpo da requisição excede o limite de 1 MB.', { Connection: 'close' });
}

/**
 * Lê o corpo JSON (limite de LIMITE_CORPO_BYTES). Corpo vazio resulta em `{}`.
 */
function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    const declarado = Number(req.headers['content-length']);
    if (Number.isFinite(declarado) && declarado > LIMITE_CORPO_BYTES) {
      return reject(corpoGrandeDemais());
    }

    const pedacos = [];
    let total = 0;
    let estourou = false;

    req.on('data', (chunk) => {
      if (estourou) return;
      total += chunk.length;
      if (total > LIMITE_CORPO_BYTES) {
        estourou = true;
        pedacos.length = 0;
        reject(corpoGrandeDemais());
        return;
      }
      pedacos.push(chunk);
    });

    req.on('end', () => {
      if (estourou) return;
      const raw = Buffer.concat(pedacos).toString('utf8');
      if (raw.trim() === '') return resolve({});
      try {
        const corpo = JSON.parse(raw);
        if (corpo === null || typeof corpo !== 'object' || Array.isArray(corpo)) {
          return reject(criarErro(400, 'O corpo da requisição deve ser um objeto JSON.'));
        }
        resolve(corpo);
      } catch {
        reject(criarErro(400, 'JSON inválido no corpo da requisição.'));
      }
    });

    req.on('error', reject);
  });
}

/**
 * Procura a rota pelo método e pelo caminho.
 * Retorna `{ rota, params }`, `{ metodosPermitidos }` (caminho existe com outro método) ou `null`.
 */
function encontrarRota(metodo, pathname) {
  const permitidos = new Set();
  for (const rota of rotas) {
    const match = rota.padrao.exec(pathname);
    if (!match) continue;
    if (rota.metodo === metodo) return { rota, params: match.slice(1) };
    permitidos.add(rota.metodo);
  }
  return permitidos.size > 0 ? { metodosPermitidos: [...permitidos] } : null;
}

function servirArquivoEstatico(req, res, pathname) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD', 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Método não permitido.');
  }

  const naoEncontrado = () => {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Página não encontrada.');
  };

  let caminhoDecodificado;
  try {
    caminhoDecodificado = decodeURIComponent(pathname);
  } catch {
    return naoEncontrado();
  }
  if (caminhoDecodificado.includes('\0')) return naoEncontrado();

  const relativePath = caminhoDecodificado === '/' ? 'index.html' : caminhoDecodificado.replace(/^\/+/, '');
  const filePath = path.resolve(PUBLIC_DIR, relativePath);

  if (!filePath.startsWith(PUBLIC_DIR + path.sep)) return naoEncontrado();

  let stat;
  try {
    stat = fs.statSync(filePath);
  } catch {
    return naoEncontrado();
  }
  if (stat.isDirectory()) return naoEncontrado();

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  const content = fs.readFileSync(filePath);
  res.writeHead(200, {
    'Content-Type': contentType,
    'Content-Length': content.length,
    'Content-Security-Policy': CONTENT_SECURITY_POLICY,
  });
  return res.end(req.method === 'HEAD' ? undefined : content);
}

export function createAppServer() {
  return http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // Helper para envio padronizado de respostas JSON (API em mesma origem: sem CORS)
    res.sendJson = (statusCode, payload, headers = {}) => {
      res.writeHead(statusCode, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        ...headers,
      });
      res.end(JSON.stringify(payload));
    };

    try {
      let urlObj;
      try {
        urlObj = new URL(`http://localhost${req.url}`);
      } catch {
        throw criarErro(400, 'URL inválida.');
      }
      const pathname = urlObj.pathname;

      // Rotas da API REST
      if (pathname.startsWith('/api/')) {
        const encontrada = encontrarRota(req.method, pathname);

        if (!encontrada) {
          throw criarErro(404, 'Rota da API não encontrada.');
        }
        if (encontrada.metodosPermitidos) {
          throw criarErro(405, 'Método não permitido para esta rota.', {
            Allow: encontrada.metodosPermitidos.join(', '),
          });
        }

        const { rota, params } = encontrada;

        if (!rota.publica) {
          autenticarRequisicao(req);
          if (rota.perfis) exigirPerfil(req, ...rota.perfis);
          if (rota.proprietario) exigirProprietario(req, params[0], rota.proprietario);
        }

        if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
          req.body = await parseJsonBody(req);
        }

        await rota.handler(req, res, params);
        return;
      }

      // Arquivos estáticos do Front-end (public/)
      return servirArquivoEstatico(req, res, pathname);
    } catch (error) {
      const tratado = error.statusCode ? error : traduzirErroBanco(error);

      if (!tratado) {
        console.error('[Servidor] Erro inesperado:', error);
      }

      if (res.headersSent) {
        return res.end();
      }
      if (tratado) {
        return res.sendJson(tratado.statusCode, { error: tratado.message }, tratado.headers);
      }
      return res.sendJson(500, { error: 'Erro interno no servidor.' });
    }
  });
}

// Inicialização direta quando executado via `npm start` ou `node src/server.js`
if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const PORT = process.env.PORT || 3000;

  // Abre o banco já na subida: aplica o schema (banco novo) e a migração de senhas legadas.
  getDatabase();
  // Emite o aviso de AUTH_SECRET ausente (se for o caso) na inicialização.
  obterSegredo();
  // Avisa se o envio real de e-mails está desativado (modo simulado).
  avisarConfiguracaoEmail();

  const server = createAppServer();
  server.listen(PORT, () => {
    // Crédito semestral automático (na subida e de hora em hora); nunca disparado por import.
    iniciarCreditoSemestral();
    console.log(`Servidor MVC rodando em http://localhost:${PORT}`);
  });
}
