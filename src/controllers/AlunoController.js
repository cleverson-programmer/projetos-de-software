import { ContaController } from './ContaController.js';
import { fail } from '../utils/validation.js';

export class AlunoController extends ContaController {
  validar(req, id) { if (req.user?.tipo !== 'ALUNO' || req.user.id !== Number(id)) fail(403, 'Acesso permitido apenas ao seu cadastro.'); }
  async criar(req, res) { return this.cadastrar(req, res, 'ALUNO'); }
  async buscarPorId(req, res, id) { this.validar(req, id); return this.perfil(req, res); }
  async atualizar(req, res, id) { this.validar(req, id); return super.atualizar(req, res); }
  async excluir(req, res, id) { this.validar(req, id); return this.desativar(req, res); }
  async listar(req, res) { return this.alunos(req, res); }
}
