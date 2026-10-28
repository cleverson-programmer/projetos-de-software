import { criarErro } from '../utils/erros.js';
import { inteiroPositivo, textoObrigatorio, urlHttpValida } from '../utils/validacao.js';

/**
 * Vantagem oferecida por uma empresa parceira e trocável por moedas.
 */
export class Vantagem {
  constructor({
    id = null,
    empresaId,
    empresaNome = null,
    nome,
    descricao,
    fotoUrl,
    custoMoedas,
    ativa = true,
    createdAt = null,
  }) {
    this.id = id;
    this.empresaId = Number(empresaId);
    this.empresaNome = empresaNome;
    this.nome = nome;
    this.descricao = descricao;
    this.fotoUrl = fotoUrl;
    this.custoMoedas = Number(custoMoedas);
    this.ativa = Boolean(ativa);
    this.createdAt = createdAt;
  }

  /**
   * Valida e normaliza os dados de cadastro/edição de uma vantagem.
   * Lança erro 400 se algum campo for inválido.
   * @returns {{ nome: string, descricao: string, fotoUrl: string, custoMoedas: number }}
   */
  static validarDados(dados = {}) {
    const nome = textoObrigatorio(dados.nome);
    if (nome === null) throw criarErro(400, 'O nome da vantagem é obrigatório.');
    if (nome.length > 150) throw criarErro(400, 'O nome da vantagem deve ter no máximo 150 caracteres.');

    const descricao = textoObrigatorio(dados.descricao);
    if (descricao === null) throw criarErro(400, 'A descrição da vantagem é obrigatória.');

    const fotoUrl = textoObrigatorio(dados.fotoUrl);
    if (fotoUrl === null) throw criarErro(400, 'A foto (URL) da vantagem é obrigatória.');
    if (!urlHttpValida(fotoUrl)) {
      throw criarErro(400, 'A foto deve ser uma URL http(s) válida com até 500 caracteres.');
    }

    const custoMoedas = inteiroPositivo(dados.custoMoedas);
    if (custoMoedas === null) {
      throw criarErro(400, 'O custo da vantagem deve ser um número inteiro maior que zero.');
    }

    return { nome, descricao, fotoUrl, custoMoedas };
  }

  static fromRow(row) {
    if (!row) return null;
    return new Vantagem({
      id: row.id,
      empresaId: row.empresa_id,
      empresaNome: row.empresa_nome ?? null,
      nome: row.nome,
      descricao: row.descricao,
      fotoUrl: row.foto_url,
      custoMoedas: row.custo_moedas,
      ativa: Boolean(row.ativa),
      createdAt: row.created_at,
    });
  }

  toJSON() {
    return {
      id: this.id,
      empresaId: this.empresaId,
      empresaNome: this.empresaNome,
      nome: this.nome,
      descricao: this.descricao,
      fotoUrl: this.fotoUrl,
      custoMoedas: this.custoMoedas,
      ativa: this.ativa,
      createdAt: this.createdAt,
    };
  }
}
