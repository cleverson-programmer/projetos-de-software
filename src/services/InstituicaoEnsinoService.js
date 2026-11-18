import { InstituicaoEnsinoDAO } from '../dao/InstituicaoEnsinoDAO.js';

export class InstituicaoEnsinoService {
  constructor(instituicaoDAO = new InstituicaoEnsinoDAO()) {
    this.instituicaoDAO = instituicaoDAO;
  }

  async listarInstituicoes() {
    return await this.instituicaoDAO.findAll();
  }

  async buscarPorId(id) {
    const inst = await this.instituicaoDAO.findById(id);
    if (!inst) {
      const error = new Error('Instituição de ensino não encontrada.');
      error.statusCode = 404;
      throw error;
    }
    return inst;
  }
}

