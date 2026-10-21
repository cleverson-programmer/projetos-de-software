import { Usuario } from './Usuario.js';
import { InstituicaoEnsino } from './InstituicaoEnsino.js';

/**
 * Subclasse Aluno (especializa Usuario) conforme Diagrama de Classes da Sprint 1.
 */
export class Aluno extends Usuario {
  constructor({
    id = null,
    nome,
    email,
    login,
    senhaHash = null,
    createdAt = null,
    updatedAt = null,
    cpf,
    rg,
    endereco,
    curso,
    saldoMoedas = 0,
    instituicaoId,
    instituicao = null,
  }) {
    super({
      id,
      nome,
      email,
      login,
      senhaHash,
      tipo: 'ALUNO',
      createdAt,
      updatedAt,
    });
    this.cpf = cpf;
    this.rg = rg;
    this.endereco = endereco;
    this.curso = curso;
    this.saldoMoedas = Number(saldoMoedas ?? 0);
    this.instituicaoId = Number(instituicaoId);
    this.instituicao = instituicao;
  }

  receberMoedas(qtd) {
    if (qtd <= 0) {
      throw new Error('A quantidade de moedas recebida deve ser maior que zero.');
    }
    this.saldoMoedas += Number(qtd);
  }

  static fromRow(row) {
    if (!row) return null;
    const instituicao = row.instituicao_nome
      ? new InstituicaoEnsino({
          id: row.instituicao_id,
          nome: row.instituicao_nome,
          endereco: row.instituicao_endereco,
        })
      : null;

    return new Aluno({
      id: row.id ?? row.usuario_id,
      nome: row.nome,
      email: row.email,
      login: row.login,
      senhaHash: row.senha_hash,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      cpf: row.cpf,
      rg: row.rg,
      endereco: row.endereco,
      curso: row.curso,
      saldoMoedas: row.saldo_moedas,
      instituicaoId: row.instituicao_id,
      instituicao,
    });
  }

  toJSON() {
    return {
      ...super.toJSON(),
      cpf: this.cpf,
      rg: this.rg,
      endereco: this.endereco,
      curso: this.curso,
      saldoMoedas: this.saldoMoedas,
      instituicaoId: this.instituicaoId,
      instituicao: this.instituicao ? this.instituicao.toJSON() : null,
    };
  }
}

