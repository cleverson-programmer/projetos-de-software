import { VantagemService } from '../services/VantagemService.js';

export class VantagemController {
  constructor(service = new VantagemService()) {
    this.service = service;
  }

  /** Catálogo do aluno (somente ativas); filtro opcional `?empresaId=`. */
  listar(req, res) {
    const { searchParams } = new URL(req.url, 'http://localhost');
    const vantagens = this.service.listarAtivas({ empresaId: searchParams.get('empresaId') });
    res.sendJson(200, vantagens);
  }

  /** Vantagens da empresa autenticada (ativas e inativas). */
  minhas(req, res) {
    res.sendJson(200, this.service.listarDaEmpresa(req.auth.id));
  }

  criar(req, res) {
    const vantagem = this.service.cadastrar(req.auth.id, req.body || {});
    res.sendJson(201, vantagem);
  }

  atualizar(req, res, id) {
    const vantagem = this.service.atualizar(req.auth.id, id, req.body || {});
    res.sendJson(200, vantagem);
  }

  alterarAtiva(req, res, id) {
    const vantagem = this.service.alterarAtiva(req.auth.id, id, (req.body || {}).ativa);
    res.sendJson(200, vantagem);
  }

  excluir(req, res, id) {
    this.service.excluir(req.auth.id, id);
    res.sendJson(200, { message: 'Vantagem excluída com sucesso.' });
  }
}
