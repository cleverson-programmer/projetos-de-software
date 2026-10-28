import { TransacaoService } from '../services/TransacaoService.js';

export class TransacaoController {
  constructor(service = new TransacaoService()) {
    this.service = service;
  }

  async enviarMoedas(req, res) {
    const resultado = await this.service.enviarMoedas(req.auth.id, req.body || {});
    res.sendJson(201, { message: 'Moedas enviadas com sucesso.', ...resultado });
  }

  async resgatar(req, res, vantagemId) {
    const resultado = await this.service.resgatarVantagem(req.auth.id, vantagemId);
    res.sendJson(201, { message: 'Vantagem resgatada com sucesso.', ...resultado });
  }

  extrato(req, res) {
    res.sendJson(200, this.service.gerarExtrato(req.auth.id, req.auth.tipo));
  }

  executarCreditoSemestral(_req, res) {
    const resultado = this.service.creditarSemestre();
    const message =
      resultado.creditados.length > 0
        ? `Crédito do semestre ${resultado.semestre} realizado para ${resultado.creditados.length} professor(es).`
        : `Nenhum professor pendente: o crédito do semestre ${resultado.semestre} já foi realizado.`;
    res.sendJson(200, { ...resultado, message });
  }
}
