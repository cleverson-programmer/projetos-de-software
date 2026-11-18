import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDatabase, closeDatabase } from './config/database.js';
import { ContaController } from './controllers/ContaController.js';
import { OperacaoController } from './controllers/OperacaoController.js';
import { SessionService } from './services/SessionService.js';
import { sincronizarCreditos } from './services/CreditoService.js';
import { iniciarJobs } from './services/JobService.js';
import { InstituicaoEnsinoDAO } from './dao/InstituicaoEnsinoDAO.js';
import { fail } from './utils/validation.js';

const filename = fileURLToPath(import.meta.url);
const publicDir = fileURLToPath(new URL('../public/', import.meta.url));
const conta = new ContaController();
const operacoes = new OperacaoController();
const sessoes = new SessionService();
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml' };

async function body(req) {
  const max = 3 * 1024 * 1024;
  if (!req.headers['content-type']?.toLowerCase().startsWith('application/json')) fail(415, 'Envie os dados em formato JSON.');
  return new Promise((resolve, reject) => {
    let length = 0;
    let chunks = [];
    let large = false;
    req.on('data', (chunk) => {
      length += chunk.length;
      if (length > max) { large = true; chunks = []; }
      if (!large) chunks.push(chunk);
    });
    req.on('error', reject);
    req.on('end', () => {
      if (large) return reject(Object.assign(new Error('Dados maiores que o limite de 3 MB.'), { statusCode: 413 }));
      try {
        const value = length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};
        if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
        resolve(value);
      } catch {
        reject(Object.assign(new Error('JSON inválido.'), { statusCode: 400 }));
      }
    });
  });
}

function verificarOrigem(req) {
  const origin = req.headers.origin;
  if (!origin) return;
  let parsed;
  try { parsed = new URL(origin); } catch { fail(403, 'Origem da requisição inválida.'); }
  if (process.env.APP_URL) {
    if (parsed.origin !== new URL(process.env.APP_URL).origin) fail(403, 'Origem da requisição não permitida.');
  } else if (parsed.host !== req.headers.host) fail(403, 'Origem da requisição não permitida.');
}

export function createAppServer() {
  const server = http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' https: blob: data:; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
    res.sendJson = (status, data) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(data));
    };
    try {
      const url = new URL(req.url, 'http://localhost');
      const route = url.pathname;
      req.query = url.searchParams;
      if (route === '/health' && req.method === 'GET') {
        try { await getDatabase().query('SELECT 1'); return res.sendJson(200, { status: 'ok' }); }
        catch { return res.sendJson(503, { status: 'unavailable' }); }
      }
      if (route.startsWith('/api/')) {
        const changing = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
        if (changing) { verificarOrigem(req); req.body = await body(req); }
        if (req.method === 'GET' && route === '/api/instituicoes') return res.sendJson(200, await new InstituicaoEnsinoDAO().findAll());
        if (req.method === 'POST' && route === '/api/auth/login') return await conta.login(req, res);
        if (req.method === 'POST' && route === '/api/alunos') return await conta.cadastrar(req, res, 'ALUNO');
        if (req.method === 'POST' && route === '/api/empresas') return await conta.cadastrar(req, res, 'EMPRESA');

        await sessoes.autenticar(req);
        if (changing) sessoes.verificarCSRF(req);
        if (req.method === 'GET' && ['/api/auth/me', '/api/conta'].includes(route)) {
          if (req.user.tipo === 'PROFESSOR') await sincronizarCreditos(req.user.id);
          return await conta.perfil(req, res);
        }
        if (req.method === 'POST' && route === '/api/auth/logout') return await conta.sair(req, res);
        if (req.method === 'PUT' && route === '/api/conta') return await conta.atualizar(req, res);
        if (req.method === 'DELETE' && route === '/api/conta') return await conta.desativar(req, res);
        if (req.method === 'GET' && route === '/api/alunos') return await conta.alunos(req, res);

        const self = route.match(/^\/api\/(alunos|empresas)\/(\d+)$/);
        if (self) {
          const expected = self[1] === 'alunos' ? 'ALUNO' : 'EMPRESA';
          if (req.user.tipo !== expected || req.user.id !== Number(self[2])) fail(403, 'Você só pode acessar seu próprio cadastro.');
          if (req.method === 'GET') return await conta.perfil(req, res);
          if (req.method === 'PUT') return await conta.atualizar(req, res);
          if (req.method === 'DELETE') return await conta.desativar(req, res);
        }
        if (req.method === 'GET' && route === '/api/empresas') {
          const { rows } = await getDatabase().query('SELECT u.id, u.nome, e.descricao FROM empresas_parceiras e JOIN usuarios u ON u.id = e.usuario_id WHERE u.ativo ORDER BY u.nome');
          return res.sendJson(200, rows.map((row) => ({ ...row, id: Number(row.id) })));
        }
        if (req.method === 'GET' && route === '/api/extrato') return await operacoes.extrato(req, res);
        if (req.method === 'POST' && route === '/api/transferencias') return await operacoes.transferir(req, res);
        if (req.method === 'POST' && route === '/api/resgates') return await operacoes.resgatar(req, res);
        if (req.method === 'GET' && route === '/api/cupons') return await operacoes.listarCupons(req, res);
        if (req.method === 'GET' && route === '/api/cupons/conferir') return await operacoes.conferir(req, res);
        const cupom = route.match(/^\/api\/cupons\/(\d+)\/(confirmar|reenviar)$/);
        if (cupom && req.method === 'POST') {
          return cupom[2] === 'confirmar' ? await operacoes.confirmar(req, res, cupom[1]) : await operacoes.reenviar(req, res, cupom[1]);
        }
        if (req.method === 'GET' && route === '/api/vantagens') return await operacoes.listarVantagens(req, res);
        if (req.method === 'POST' && route === '/api/vantagens') return await operacoes.criarVantagem(req, res);
        if (req.method === 'POST' && route === '/api/vantagens/foto') return await operacoes.enviarFoto(req, res);
        const vantagem = route.match(/^\/api\/vantagens\/(\d+)$/);
        if (vantagem && req.method === 'PUT') return await operacoes.atualizarVantagem(req, res, vantagem[1]);
        if (vantagem && req.method === 'DELETE') return await operacoes.desativarVantagem(req, res, vantagem[1]);
        const foto = route.match(/^\/api\/fotos\/([a-f0-9-]{36})$/i);
        if (foto && req.method === 'GET') return await operacoes.foto(req, res, foto[1]);
        fail(404, 'Funcionalidade não encontrada.');
      }

      if (!['GET', 'HEAD'].includes(req.method)) fail(405, 'Método não permitido.');
      const relative = route === '/' ? 'index.html' : decodeURIComponent(route).replace(/^\/+/, '');
      const file = path.resolve(publicDir, relative);
      if (!file.startsWith(path.resolve(publicDir) + path.sep) || !mime[path.extname(file)]) fail(404, 'Página não encontrada.');
      let content;
      try { content = await fs.readFile(file); } catch { fail(404, 'Página não encontrada.'); }
      res.writeHead(200, { 'Content-Type': mime[path.extname(file)], 'Cache-Control': 'no-cache' });
      res.end(req.method === 'HEAD' ? undefined : content);
    } catch (error) {
      if (res.headersSent) { res.end(); return; }
      const errors = {
        '23505': [409, 'Já existe um cadastro com este email, login, CPF ou CNPJ.'],
        '23503': [409, 'O cadastro está vinculado a outros registros.'],
        '23514': [400, 'Confira os campos obrigatórios e os valores informados.'],
        '22003': [409, 'O valor ultrapassa o limite permitido.'],
        '22P02': [400, 'Identificador ou formato de dado inválido.'],
      };
      const [status, message] = errors[error.code] || [error.statusCode || 500, error.statusCode ? error.message : 'Não foi possível concluir a operação. Tente novamente.'];
      if (status >= 500) console.error('Erro de requisição:', error.code || error.name);
      res.sendJson(status, { error: message });
    }
  });
  server.requestTimeout = 30000;
  server.headersTimeout = 15000;
  return server;
}

export async function startServer() {
  await getDatabase().query('SELECT 1');
  await sincronizarCreditos();
  const server = createAppServer();
  const port = Number(process.env.PORT || 3000);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '0.0.0.0', resolve);
  });
  const stopJobs = iniciarJobs();
  console.log('Moeda Estudantil disponível na porta ' + port + '.');
  let closing = false;
  async function shutdown() {
    if (closing) return;
    closing = true;
    const timeout = setTimeout(() => process.exit(1), 25000);
    timeout.unref();
    const closed = new Promise((resolve) => server.close(resolve));
    server.closeIdleConnections();
    try {
      await stopJobs();
      await closed;
      await closeDatabase();
      clearTimeout(timeout);
    } catch (error) { console.error('Falha ao encerrar:', error.code || error.name); process.exitCode = 1; }
  }
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
  return server;
}

if (process.argv[1] && path.resolve(process.argv[1]) === filename) {
  try { await startServer(); }
  catch (error) { console.error('Falha na inicialização:', error.code || error.message); await closeDatabase(); process.exitCode = 1; }
}
