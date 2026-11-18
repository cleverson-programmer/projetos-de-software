import { MoedaService } from '../services/MoedaService.js';
import { CupomService } from '../services/CupomService.js';
import { VantagemService } from '../services/VantagemService.js';

export class OperacaoController {
  constructor() { this.moedas = new MoedaService(); this.cupons = new CupomService(); this.vantagens = new VantagemService(); }
  async extrato(req, res) { res.sendJson(200, await this.moedas.extrato(req.user, req.query.get('antesDe'))); }
  async transferir(req, res) { res.sendJson(201, await this.moedas.transferir(req.user, req.body, req.headers['idempotency-key'])); }
  async resgatar(req, res) { res.sendJson(201, await this.cupons.resgatar(req.user, req.body, req.headers['idempotency-key'])); }
  async listarCupons(req, res) { res.sendJson(200, await this.cupons.listar(req.user, req.query.get('antesDe'))); }
  async conferir(req, res) { res.sendJson(200, await this.cupons.conferir(req.user, req.query.get('codigo'))); }
  async confirmar(req, res, id) { res.sendJson(200, await this.cupons.confirmar(req.user, id)); }
  async reenviar(req, res, id) { res.sendJson(200, await this.cupons.reenviar(req.user, id)); }
  async listarVantagens(req, res) { res.sendJson(200, await this.vantagens.listar(req.user, req.query.get('busca'))); }
  async criarVantagem(req, res) { res.sendJson(201, await this.vantagens.criar(req.user, req.body)); }
  async atualizarVantagem(req, res, id) { res.sendJson(200, await this.vantagens.atualizar(req.user, id, req.body)); }
  async desativarVantagem(req, res, id) { res.sendJson(200, await this.vantagens.desativar(req.user, id)); }
  async enviarFoto(req, res) { res.sendJson(201, await this.vantagens.foto(req.user, req.body)); }
  async foto(req, res, id) {
    const foto = await this.vantagens.buscarFoto(id);
    res.writeHead(200, { 'Content-Type': foto.mime, 'Content-Length': foto.conteudo.length, 'Cache-Control': 'private, max-age=3600', 'X-Content-Type-Options': 'nosniff' });
    res.end(foto.conteudo);
  }
}
