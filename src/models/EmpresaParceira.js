import { Usuario } from './Usuario.js';
import { Vantagem } from './Vantagem.js';
import { criarErro } from '../utils/erros.js';

/**
 * Subclasse EmpresaParceira (especializa Usuario) conforme Diagrama de Classes da Sprint 1.
 */
export class EmpresaParceira extends Usuario {
  constructor({
    id = null,
    nome,
    email,
    login,
    senhaHash = null,
    createdAt = null,
    updatedAt = null,
    cnpj,
    descricao = null,
    vantagens = [],
  }) {
    super({
      id,
      nome,
      email,
      login,
      senhaHash,
      tipo: 'EMPRESA',
      createdAt,
      updatedAt,
    });
    this.cnpj = cnpj;
    this.descricao = descricao;
    this.vantagens = vantagens;
  }

  /**
   * Cadastra uma vantagem desta empresa (em memória). A persistência é do VantagemDAO.
   * @returns {Vantagem}
   */
  cadastrarVantagem(dados) {
    const validados = Vantagem.validarDados(dados);
    const vantagem = new Vantagem({
      ...validados,
      empresaId: this.id,
      empresaNome: this.nome,
      ativa: true,
    });
    this.vantagens.push(vantagem);
    return vantagem;
  }

  /**
   * Edita uma vantagem desta empresa (em memória).
   * @returns {Vantagem}
   */
  editarVantagem(vantagemId, dados) {
    const vantagem = this.#localizarVantagem(vantagemId);
    Object.assign(vantagem, Vantagem.validarDados(dados));
    return vantagem;
  }

  /**
   * Remove uma vantagem desta empresa (em memória).
   * @returns {Vantagem} a vantagem removida
   */
  removerVantagem(vantagemId) {
    const vantagem = this.#localizarVantagem(vantagemId);
    this.vantagens = this.vantagens.filter((v) => v !== vantagem);
    return vantagem;
  }

  #localizarVantagem(vantagemId) {
    const vantagem = this.vantagens.find((v) => v.id === Number(vantagemId));
    if (!vantagem) {
      throw criarErro(404, 'Vantagem não encontrada.');
    }
    if (vantagem.empresaId !== this.id) {
      throw criarErro(403, 'Esta vantagem pertence a outra empresa.');
    }
    return vantagem;
  }

  static fromRow(row) {
    if (!row) return null;
    return new EmpresaParceira({
      id: row.id ?? row.usuario_id,
      nome: row.nome,
      email: row.email,
      login: row.login,
      senhaHash: row.senha_hash,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      cnpj: row.cnpj,
      descricao: row.descricao,
    });
  }

  toJSON() {
    return {
      ...super.toJSON(),
      cnpj: this.cnpj,
      descricao: this.descricao,
    };
  }
}

