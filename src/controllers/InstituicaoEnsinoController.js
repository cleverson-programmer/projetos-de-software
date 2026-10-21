import { InstituicaoEnsinoService } from '../services/InstituicaoEnsinoService.js';

export class InstituicaoEnsinoController {
  constructor(service = new InstituicaoEnsinoService()) {
    this.service = service;
  }

  listar(_req, res) {
    const instituicoes = this.service.listarInstituicoes();
    res.sendJson(200, instituicoes);
  }
}

