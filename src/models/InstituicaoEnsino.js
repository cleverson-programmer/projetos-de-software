/**
 * Entidade InstituicaoEnsino conforme Diagrama de Classes da Sprint 1.
 */
export class InstituicaoEnsino {
  constructor({ id = null, nome, endereco }) {
    this.id = id;
    this.nome = nome;
    this.endereco = endereco;
  }

  static fromRow(row) {
    if (!row) return null;
    return new InstituicaoEnsino({
      id: row.id,
      nome: row.nome,
      endereco: row.endereco,
    });
  }

  toJSON() {
    return {
      id: this.id,
      nome: this.nome,
      endereco: this.endereco,
    };
  }
}

