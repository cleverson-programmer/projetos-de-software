import { ContaService } from './ContaService.js';
import { fail } from '../utils/validation.js';

export class AlunoService {
  constructor() { this.contas = new ContaService(); }
  async listarAlunos(actor) { if (!actor) fail(401, 'Autenticação necessária.'); return this.contas.alunosDoProfessor(actor); }
  validar(actor, id) { if (!actor || actor.tipo !== 'ALUNO' || actor.id !== Number(id)) fail(403, 'Acesso permitido apenas ao seu cadastro.'); }
  async buscarPorId(id, actor) { this.validar(actor, id); return this.contas.perfil(actor); }
  async cadastrarAluno(dados) { return this.contas.cadastrar('ALUNO', dados); }
  async atualizarAluno(id, dados, actor) { this.validar(actor, id); return this.contas.atualizar(actor, dados); }
  async excluirAluno(id, senhaAtual, actor) { this.validar(actor, id); return this.contas.desativar(actor, senhaAtual); }
}
