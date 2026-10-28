import { ProfessorService } from '../services/ProfessorService.js';

export class ProfessorController {
  constructor(service = new ProfessorService()) {
    this.service = service;
  }

  me(req, res) {
    const professor = this.service.buscarPorId(req.auth.id);
    res.sendJson(200, professor);
  }
}
