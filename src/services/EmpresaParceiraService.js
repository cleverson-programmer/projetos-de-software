import { ContaService } from './ContaService.js';
import { fail } from '../utils/validation.js';

export class EmpresaParceiraService {
  constructor() { this.contas = new ContaService(); }
  validar(actor, id) { if (!actor || actor.tipo !== 'EMPRESA' || actor.id !== Number(id)) fail(403, 'Acesso permitido apenas ao seu cadastro.'); }
  async listarEmpresas(actor) { if (!actor) fail(401, 'Autenticação necessária.'); return actor.tipo === 'EMPRESA' ? [await this.contas.perfil(actor)] : []; }
  async buscarPorId(id, actor) { this.validar(actor, id); return this.contas.perfil(actor); }
  async cadastrarEmpresa(dados) { return this.contas.cadastrar('EMPRESA', dados); }
  async atualizarEmpresa(id, dados, actor) { this.validar(actor, id); return this.contas.atualizar(actor, dados); }
  async excluirEmpresa(id, senhaAtual, actor) { this.validar(actor, id); return this.contas.desativar(actor, senhaAtual); }
}
