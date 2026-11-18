import { ContaService } from '../services/ContaService.js';
import { AuthService } from '../services/AuthService.js';
import { SessionService } from '../services/SessionService.js';

export class ContaController {
  constructor() { this.contas = new ContaService(); this.auth = new AuthService(); this.sessoes = new SessionService(); }
  async login(req, res) { res.sendJson(200, await this.sessoes.criar(req, res, await this.auth.autenticar(req.body.login, req.body.senha))); }
  async cadastrar(req, res, tipo) { res.sendJson(201, await this.sessoes.criar(req, res, await this.contas.cadastrar(tipo, req.body))); }
  async perfil(req, res) { res.sendJson(200, { usuario: await this.contas.perfil(req.user), csrfToken: req.csrfToken }); }
  async atualizar(req, res) { res.sendJson(200, { usuario: await this.contas.atualizar(req.user, req.body) }); }
  async desativar(req, res) {
    await this.contas.desativar(req.user, req.body.senhaAtual);
    this.sessoes.limparCookie(res);
    res.sendJson(200, { message: 'Conta desativada. Seu histórico foi preservado.' });
  }
  async sair(req, res) { await this.sessoes.sair(req, res); res.sendJson(200, { message: 'Você saiu da conta.' }); }
  async alunos(req, res) { res.sendJson(200, await this.contas.alunosDoProfessor(req.user)); }
}
