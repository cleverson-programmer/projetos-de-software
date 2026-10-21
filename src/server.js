import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { InstituicaoEnsinoController } from './controllers/InstituicaoEnsinoController.js';
import { AlunoController } from './controllers/AlunoController.js';
import { EmpresaParceiraController } from './controllers/EmpresaParceiraController.js';
import { AuthController } from './controllers/AuthController.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.resolve(__dirname, '../public');

const instituicaoController = new InstituicaoEnsinoController();
const alunoController = new AlunoController();
const empresaController = new EmpresaParceiraController();
const authController = new AuthController();

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        const err = new Error('JSON inválido no corpo da requisição.');
        err.statusCode = 400;
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

export function createAppServer() {
  return http.createServer(async (req, res) => {
    // Helper para envio padronizado de respostas JSON
    res.sendJson = (statusCode, payload) => {
      res.writeHead(statusCode, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      });
      res.end(JSON.stringify(payload));
    };

    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      });
      return res.end();
    }

    const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = urlObj.pathname;

    try {
      // Rotas da API REST
      if (pathname.startsWith('/api/')) {
        if (['POST', 'PUT'].includes(req.method)) {
          req.body = await parseJsonBody(req);
        }

        // Instituições de Ensino
        if (pathname === '/api/instituicoes' && req.method === 'GET') {
          return instituicaoController.listar(req, res);
        }

        // Autenticação
        if (pathname === '/api/auth/login' && req.method === 'POST') {
          return authController.login(req, res);
        }

        // CRUD Alunos
        if (pathname === '/api/alunos') {
          if (req.method === 'GET') return alunoController.listar(req, res);
          if (req.method === 'POST') return alunoController.criar(req, res);
        }

        const alunoMatch = pathname.match(/^\/api\/alunos\/(\d+)$/);
        if (alunoMatch) {
          const id = Number(alunoMatch[1]);
          if (req.method === 'GET') return alunoController.buscarPorId(req, res, id);
          if (req.method === 'PUT') return alunoController.atualizar(req, res, id);
          if (req.method === 'DELETE') return alunoController.excluir(req, res, id);
        }

        // CRUD Empresas Parceiras
        if (pathname === '/api/empresas') {
          if (req.method === 'GET') return empresaController.listar(req, res);
          if (req.method === 'POST') return empresaController.criar(req, res);
        }

        const empresaMatch = pathname.match(/^\/api\/empresas\/(\d+)$/);
        if (empresaMatch) {
          const id = Number(empresaMatch[1]);
          if (req.method === 'GET') return empresaController.buscarPorId(req, res, id);
          if (req.method === 'PUT') return empresaController.atualizar(req, res, id);
          if (req.method === 'DELETE') return empresaController.excluir(req, res, id);
        }

        return res.sendJson(404, { error: 'Rota da API não encontrada.' });
      }

      // Arquivos estáticos do Front-end (public/)
      const relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
      const filePath = path.resolve(PUBLIC_DIR, relativePath);

      if (!filePath.startsWith(PUBLIC_DIR) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end('Página não encontrada.');
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      const content = fs.readFileSync(filePath);
      res.writeHead(200, { 'Content-Type': contentType });
      return res.end(content);
    } catch (error) {
      const status = error.statusCode || 500;
      return res.sendJson(status, {
        error: error.message || 'Erro interno no servidor.',
      });
    }
  });
}

// Inicialização direta quando executado via `npm start` ou `node src/server.js`
if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const PORT = process.env.PORT || 3000;
  const server = createAppServer();
  server.listen(PORT, () => {
    console.log(`Servidor MVC rodando em http://localhost:${PORT}`);
  });
}

