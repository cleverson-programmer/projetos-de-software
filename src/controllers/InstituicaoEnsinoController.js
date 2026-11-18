import { InstituicaoEnsinoService } from '../services/InstituicaoEnsinoService.js';

export class InstituicaoEnsinoController {
  constructor(service = new InstituicaoEnsinoService()) {
    this.service = service;
  }

  async listar(_req, res) {
    const instituicoes = await this.service.listarInstituicoes();
    res.sendJson(200, instituicoes);
  }
}

