import { InstituicaoEnsinoDAO } from '../dao/InstituicaoEnsinoDAO.js';

export class InstituicaoEnsinoService {
  constructor(instituicaoDAO = new InstituicaoEnsinoDAO()) {
    this.instituicaoDAO = instituicaoDAO;
  }

  listarInstituicoes() {
    return this.instituicaoDAO.findAll();
  }

  buscarPorId(id) {
    const inst = this.instituicaoDAO.findById(id);
    if (!inst) {
      const error = new Error('Instituição de ensino não encontrada.');
      error.statusCode = 404;
      throw error;
    }
    return inst;
  }
}

