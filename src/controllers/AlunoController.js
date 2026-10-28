import { AlunoService } from '../services/AlunoService.js';

export class AlunoController {
  constructor(service = new AlunoService()) {
    this.service = service;
  }

  destinatarios(_req, res) {
    const destinatarios = this.service.listarDestinatarios();
    res.sendJson(200, destinatarios);
  }

  buscarPorId(_req, res, id) {
    const aluno = this.service.buscarPorId(id);
    res.sendJson(200, aluno);
  }

  criar(req, res) {
    const novoAluno = this.service.cadastrarAluno(req.body || {});
    res.sendJson(201, novoAluno);
  }

  atualizar(req, res, id) {
    const alunoAtualizado = this.service.atualizarAluno(id, req.body || {});
    res.sendJson(200, alunoAtualizado);
  }

  excluir(_req, res, id) {
    this.service.excluirAluno(id);
    res.sendJson(200, { message: 'Aluno excluído com sucesso.' });
  }
}

