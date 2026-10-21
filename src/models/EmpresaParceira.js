import { Usuario } from './Usuario.js';

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

