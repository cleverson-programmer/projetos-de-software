import { Transacao } from './Transacao.js';

/**
 * Crédito semestral de moedas para um professor (gera a Transacao tipo CREDITO).
 */
export class CreditoSemestral extends Transacao {
  constructor({ id = null, dataHora = null, quantidade, professorId, semestre }) {
    super({ id, dataHora, quantidade, tipo: 'CREDITO' });
    this.professorId = professorId === undefined || professorId === null ? null : Number(professorId);
    this.semestre = semestre;
  }

  getDescricao() {
    return `Crédito semestral de ${this.quantidade} moedas (${this.semestre})`;
  }

  static fromRow(row) {
    if (!row) return null;
    return new CreditoSemestral({
      id: row.id ?? row.transacao_id,
      dataHora: row.data_hora,
      quantidade: row.quantidade,
      professorId: row.professor_id,
      semestre: row.semestre,
    });
  }

  toJSON() {
    return {
      ...super.toJSON(),
      professorId: this.professorId,
      semestre: this.semestre,
    };
  }
}
