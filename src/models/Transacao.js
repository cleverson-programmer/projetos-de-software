/**
 * Superclasse Transacao conforme Diagrama de Classes.
 * `dataHora` é UTC no formato `YYYY-MM-DD HH:MM:SS` (como gravado pelo SQLite).
 */
export class Transacao {
  constructor({ id = null, dataHora = null, quantidade, tipo }) {
    this.id = id;
    this.dataHora = dataHora;
    this.quantidade = Number(quantidade);
    this.tipo = tipo;
  }

  getDescricao() {
    return `Transação de ${this.quantidade} moedas`;
  }

  toJSON() {
    return {
      tipo: this.tipo,
      id: this.id,
      dataHora: this.dataHora,
      quantidade: this.quantidade,
      descricao: this.getDescricao(),
    };
  }
}
