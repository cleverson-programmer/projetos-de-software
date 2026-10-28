import { Usuario } from './Usuario.js';
import { InstituicaoEnsino } from './InstituicaoEnsino.js';
import { TransferenciaMoedas } from './TransferenciaMoedas.js';
import { CreditoSemestral } from './CreditoSemestral.js';
import { CREDITO_SEMESTRAL_MOEDAS } from '../config/regras.js';
import { criarErro } from '../utils/erros.js';
import { inteiroPositivo, textoObrigatorio } from '../utils/validacao.js';

/**
 * Subclasse Professor (especializa Usuario) conforme Diagrama de Classes.
 * Os professores são pré-cadastrados e vinculados a uma instituição de ensino.
 * Os métodos de domínio operam em memória; a persistência atômica é do TransacaoDAO.
 */
export class Professor extends Usuario {
  constructor({
    id = null,
    nome,
    email,
    login,
    senhaHash = null,
    createdAt = null,
    updatedAt = null,
    cpf,
    departamento,
    saldoMoedas = 0,
    instituicaoId,
    instituicao = null,
    transacoes = [],
  }) {
    super({
      id,
      nome,
      email,
      login,
      senhaHash,
      tipo: 'PROFESSOR',
      createdAt,
      updatedAt,
    });
    this.cpf = cpf;
    this.departamento = departamento;
    this.saldoMoedas = Number(saldoMoedas ?? 0);
    this.instituicaoId = Number(instituicaoId);
    this.instituicao = instituicao;
    this.transacoes = transacoes;
  }

  /**
   * Envia moedas a um aluno: valida quantidade, motivo e saldo e altera os saldos em memória.
   * @param {import('./Aluno.js').Aluno} aluno
   * @returns {TransferenciaMoedas}
   */
  enviarMoedas(aluno, quantidade, motivo) {
    const qtd = inteiroPositivo(quantidade);
    if (qtd === null) {
      throw criarErro(400, 'A quantidade de moedas deve ser um número inteiro maior que zero.');
    }
    const motivoLimpo = textoObrigatorio(motivo);
    if (motivoLimpo === null) {
      throw criarErro(400, 'O motivo do reconhecimento é obrigatório.');
    }
    if (qtd > this.saldoMoedas) {
      throw criarErro(409, 'Saldo insuficiente');
    }

    this.saldoMoedas -= qtd;
    aluno.receberMoedas(qtd);

    return new TransferenciaMoedas({
      quantidade: qtd,
      professorId: this.id,
      alunoId: aluno.id,
      motivo: motivoLimpo,
      professorNome: this.nome,
      alunoNome: aluno.nome,
    });
  }

  /**
   * Credita o total semestral (acumulando ao saldo corrente) em memória.
   * @returns {CreditoSemestral}
   */
  receberCreditoSemestral(semestre, quantidade = CREDITO_SEMESTRAL_MOEDAS) {
    const qtd = inteiroPositivo(quantidade);
    if (qtd === null) {
      throw criarErro(400, 'A quantidade do crédito deve ser um número inteiro maior que zero.');
    }
    this.saldoMoedas += qtd;
    return new CreditoSemestral({ quantidade: qtd, professorId: this.id, semestre });
  }

  consultarExtrato() {
    return { saldoMoedas: this.saldoMoedas, transacoes: this.transacoes ?? [] };
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

    return new Professor({
      id: row.id ?? row.usuario_id,
      nome: row.nome,
      email: row.email,
      login: row.login,
      senhaHash: row.senha_hash,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      cpf: row.cpf,
      departamento: row.departamento,
      saldoMoedas: row.saldo_moedas,
      instituicaoId: row.instituicao_id,
      instituicao,
    });
  }

  toJSON() {
    return {
      ...super.toJSON(),
      cpf: this.cpf,
      departamento: this.departamento,
      saldoMoedas: this.saldoMoedas,
      instituicaoId: this.instituicaoId,
      instituicao: this.instituicao ? this.instituicao.toJSON() : null,
    };
  }
}
