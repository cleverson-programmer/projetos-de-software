import crypto from 'node:crypto';
import { Transacao } from './Transacao.js';

const ALFABETO_BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * Resgate de uma vantagem por um aluno (Transacao tipo RESGATE), com código de cupom.
 */
export class ResgateVantagem extends Transacao {
  constructor({
    id = null,
    dataHora = null,
    quantidade,
    alunoId = null,
    vantagemId = null,
    codigoCupom = null,
    alunoNome = null,
    vantagemNome = null,
    empresaNome = null,
  }) {
    super({ id, dataHora, quantidade, tipo: 'RESGATE' });
    this.alunoId = alunoId === null ? null : Number(alunoId);
    this.vantagemId = vantagemId === null ? null : Number(vantagemId);
    this.codigoCupom = codigoCupom;
    this.alunoNome = alunoNome;
    this.vantagemNome = vantagemNome;
    this.empresaNome = empresaNome;
  }

  /**
   * Gera o código do cupom: `CUPOM-<ano>-<8 caracteres base32 (A-Z, 2-7)>`.
   * Usa `crypto.randomBytes` e `byte % 32` (256 é divisível por 32, sem viés).
   */
  static gerarCodigo(data = new Date()) {
    const bytes = crypto.randomBytes(8);
    let sufixo = '';
    for (const byte of bytes) {
      sufixo += ALFABETO_BASE32[byte % 32];
    }
    return `CUPOM-${data.getFullYear()}-${sufixo}`;
  }

  getDescricao() {
    const nome = this.vantagemNome ? ` "${this.vantagemNome}"` : '';
    return `Resgate da vantagem${nome} (${this.quantidade} moedas)`;
  }

  static fromRow(row) {
    if (!row) return null;
    return new ResgateVantagem({
      id: row.id ?? row.transacao_id,
      dataHora: row.data_hora,
      quantidade: row.quantidade,
      alunoId: row.aluno_id ?? null,
      vantagemId: row.vantagem_id ?? null,
      codigoCupom: row.codigo_cupom,
      alunoNome: row.aluno_nome ?? null,
      vantagemNome: row.vantagem_nome ?? null,
      empresaNome: row.empresa_nome ?? null,
    });
  }

  toJSON() {
    return {
      ...super.toJSON(),
      alunoId: this.alunoId ?? undefined,
      alunoNome: this.alunoNome ?? undefined,
      vantagemId: this.vantagemId ?? undefined,
      vantagemNome: this.vantagemNome ?? undefined,
      empresaNome: this.empresaNome ?? undefined,
      codigoCupom: this.codigoCupom,
    };
  }
}
