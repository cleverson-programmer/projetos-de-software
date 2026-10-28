import { Transacao } from './Transacao.js';

/**
 * Envio de moedas de um professor a um aluno, com motivo obrigatório (Transacao tipo TRANSFERENCIA).
 */
export class TransferenciaMoedas extends Transacao {
  constructor({
    id = null,
    dataHora = null,
    quantidade,
    professorId = null,
    alunoId = null,
    motivo,
    professorNome = null,
    alunoNome = null,
  }) {
    super({ id, dataHora, quantidade, tipo: 'TRANSFERENCIA' });
    this.professorId = professorId === null ? null : Number(professorId);
    this.alunoId = alunoId === null ? null : Number(alunoId);
    this.motivo = motivo;
    this.professorNome = professorNome;
    this.alunoNome = alunoNome;
  }

  getDescricao() {
    // Extrato do aluno traz só o professor (recebimento); o do professor traz só o aluno (envio).
    if (this.professorNome && !this.alunoNome) {
      return `Recebimento de ${this.quantidade} moedas de ${this.professorNome}`;
    }
    const de = this.professorNome ? ` de ${this.professorNome}` : '';
    const para = this.alunoNome ? ` para ${this.alunoNome}` : '';
    return `Envio de ${this.quantidade} moedas${de}${para}`;
  }

  static fromRow(row) {
    if (!row) return null;
    return new TransferenciaMoedas({
      id: row.id ?? row.transacao_id,
      dataHora: row.data_hora,
      quantidade: row.quantidade,
      professorId: row.professor_id ?? null,
      alunoId: row.aluno_id ?? null,
      motivo: row.motivo,
      professorNome: row.professor_nome ?? null,
      alunoNome: row.aluno_nome ?? null,
    });
  }

  toJSON() {
    return {
      ...super.toJSON(),
      professorId: this.professorId ?? undefined,
      professorNome: this.professorNome ?? undefined,
      alunoId: this.alunoId ?? undefined,
      alunoNome: this.alunoNome ?? undefined,
      motivo: this.motivo,
    };
  }
}
