import { EmpresaParceiraService } from '../services/EmpresaParceiraService.js';

export class EmpresaParceiraController {
  constructor(service = new EmpresaParceiraService()) {
    this.service = service;
  }

  buscarPorId(_req, res, id) {
    const empresa = this.service.buscarPorId(id);
    res.sendJson(200, empresa);
  }

  criar(req, res) {
    const novaEmpresa = this.service.cadastrarEmpresa(req.body || {});
    res.sendJson(201, novaEmpresa);
  }

  atualizar(req, res, id) {
    const empresaAtualizada = this.service.atualizarEmpresa(id, req.body || {});
    res.sendJson(200, empresaAtualizada);
  }

  excluir(_req, res, id) {
    this.service.excluirEmpresa(id);
    res.sendJson(200, { message: 'Empresa parceira excluída com sucesso.' });
  }
}

