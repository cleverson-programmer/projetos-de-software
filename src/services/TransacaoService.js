import { TransacaoDAO } from '../dao/TransacaoDAO.js';
import { ProfessorDAO } from '../dao/ProfessorDAO.js';
import { AlunoDAO } from '../dao/AlunoDAO.js';
import { EmpresaParceiraDAO } from '../dao/EmpresaParceiraDAO.js';
import { EmailService } from './EmailService.js';
import { CREDITO_SEMESTRAL_MOEDAS } from '../config/regras.js';
import { criarErro } from '../utils/erros.js';
import { semestreAtual } from '../utils/semestre.js';
import { inteiroPositivo, textoObrigatorio } from '../utils/validacao.js';

const MOTIVO_TAMANHO_MAXIMO = 1000;

export class TransacaoService {
  constructor(
    transacaoDAO = new TransacaoDAO(),
    professorDAO = new ProfessorDAO(),
    alunoDAO = new AlunoDAO(),
    empresaDAO = new EmpresaParceiraDAO(),
    emailService = new EmailService()
  ) {
    this.transacaoDAO = transacaoDAO;
    this.professorDAO = professorDAO;
    this.alunoDAO = alunoDAO;
    this.empresaDAO = empresaDAO;
    this.emailService = emailService;
  }

  /**
   * Professor envia moedas a um aluno (motivo obrigatório, saldo suficiente).
   * A transação é gravada de forma atômica; o e-mail ao aluno só é enviado depois do COMMIT e,
   * se falhar, a transação permanece (`emailEnviado: false`).
   *
   * @param {number} professorId professor autenticado
   * @param {{ alunoId: unknown, quantidade: unknown, motivo: unknown }} dados
   */
  async enviarMoedas(professorId, { alunoId, quantidade, motivo } = {}) {
    const qtd = inteiroPositivo(quantidade);
    if (qtd === null) {
      throw criarErro(400, 'A quantidade de moedas deve ser um número inteiro maior que zero.');
    }
    const motivoLimpo = textoObrigatorio(motivo);
    if (motivoLimpo === null) {
      throw criarErro(400, 'O motivo do reconhecimento é obrigatório.');
    }
    if (motivoLimpo.length > MOTIVO_TAMANHO_MAXIMO) {
      throw criarErro(400, `O motivo deve ter no máximo ${MOTIVO_TAMANHO_MAXIMO} caracteres.`);
    }
    const idAluno = inteiroPositivo(alunoId);
    if (idAluno === null) {
      throw criarErro(400, 'Informe o aluno que receberá as moedas.');
    }
    if (!this.alunoDAO.findById(idAluno)) {
      throw criarErro(404, 'Aluno não encontrado.');
    }

    const resultado = this.transacaoDAO.registrarTransferencia({
      professorId,
      alunoId: idAluno,
      quantidade: qtd,
      motivo: motivoLimpo,
    });

    const emailEnviado = await this.emailService.notificarRecebimento({
      aluno: resultado.aluno,
      professor: resultado.professor,
      quantidade: qtd,
      motivo: motivoLimpo,
      novoSaldo: resultado.saldoAluno,
    });

    const { transferencia } = resultado;
    return {
      transacao: {
        id: transferencia.id,
        dataHora: transferencia.dataHora,
        quantidade: transferencia.quantidade,
        motivo: transferencia.motivo,
        alunoId: transferencia.alunoId,
        alunoNome: transferencia.alunoNome,
      },
      saldoProfessor: resultado.saldoProfessor,
      emailEnviado,
    };
  }

  /**
   * Aluno resgata uma vantagem: debita o saldo, gera o código do cupom e, depois do COMMIT,
   * envia o cupom ao aluno e a conferência ao parceiro (ambos com o MESMO código).
   *
   * @param {number} alunoId aluno autenticado
   * @param {string | number} vantagemId
   */
  async resgatarVantagem(alunoId, vantagemId) {
    const idVantagem = inteiroPositivo(vantagemId);
    if (idVantagem === null) {
      throw criarErro(404, 'Vantagem não encontrada.');
    }

    const { resgate, vantagem, novoSaldo, aluno, empresa } = this.transacaoDAO.registrarResgate({
      alunoId,
      vantagemId: idVantagem,
    });
    const codigo = resgate.codigoCupom;
    const dadosVantagem = { nome: vantagem.nome, custoMoedas: vantagem.custoMoedas, empresaNome: empresa.nome };

    const [emailAlunoEnviado, emailEmpresaEnviado] = await Promise.all([
      this.emailService.enviarCupomAluno({ aluno, vantagem: dadosVantagem, codigo }),
      this.emailService.enviarConferenciaParceiro({
        empresa,
        aluno,
        vantagem: dadosVantagem,
        codigo,
        dataHora: resgate.dataHora,
      }),
    ]);

    return {
      codigo,
      vantagem: {
        id: vantagem.id,
        nome: vantagem.nome,
        custoMoedas: vantagem.custoMoedas,
        empresaNome: empresa.nome,
      },
      transacao: { id: resgate.id, dataHora: resgate.dataHora, quantidade: resgate.quantidade },
      novoSaldo,
      emailAlunoEnviado,
      emailEmpresaEnviado,
    };
  }

  /**
   * Credita as moedas do semestre a todos os professores que ainda não receberam
   * (no máximo um crédito por professor por semestre; o valor acumula ao saldo corrente).
   * Um erro em um professor é registrado e não impede os demais.
   *
   * @param {{ semestre?: string }} [opcoes] semestre `AAAA/S` (padrão: semestre atual)
   * @returns {{ semestre: string, creditados: { professorId: number, nome: string, quantidade: number, saldoMoedas: number }[], jaCreditados: number }}
   */
  creditarSemestre({ semestre = semestreAtual() } = {}) {
    const creditados = [];
    let jaCreditados = 0;

    for (const professor of this.professorDAO.findAll()) {
      try {
        const resultado = this.transacaoDAO.registrarCredito({
          professorId: professor.id,
          semestre,
          quantidade: CREDITO_SEMESTRAL_MOEDAS,
        });
        if (resultado === null) {
          jaCreditados += 1;
        } else {
          creditados.push({
            professorId: professor.id,
            nome: professor.nome,
            quantidade: resultado.credito.quantidade,
            saldoMoedas: resultado.saldoMoedas,
          });
        }
      } catch (erro) {
        console.error(`[Crédito semestral] falha ao creditar o professor ${professor.id} (${semestre}):`, erro.message);
      }
    }

    return { semestre, creditados, jaCreditados };
  }

  /**
   * Extrato da conta do usuário autenticado, mais recentes primeiro.
   * - PROFESSOR: `{ tipo, saldoMoedas, transacoes }` com envios e créditos.
   * - ALUNO: `{ tipo, saldoMoedas, transacoes }` com recebimentos e resgates.
   * - EMPRESA: `{ tipo, transacoes }` com os resgates recebidos (sem saldo).
   *
   * @param {number} usuarioId
   * @param {'PROFESSOR' | 'ALUNO' | 'EMPRESA'} tipo
   */
  gerarExtrato(usuarioId, tipo) {
    if (tipo === 'PROFESSOR') {
      const professor = this.professorDAO.findById(usuarioId);
      if (!professor) throw criarErro(404, 'Professor não encontrado.');
      professor.transacoes = this.transacaoDAO.buscarExtratoProfessor(professor.id);
      return { tipo, ...professor.consultarExtrato() };
    }

    if (tipo === 'ALUNO') {
      const aluno = this.alunoDAO.findById(usuarioId);
      if (!aluno) throw criarErro(404, 'Aluno não encontrado.');
      aluno.transacoes = this.transacaoDAO.buscarExtratoAluno(aluno.id);
      return { tipo, ...aluno.consultarExtrato() };
    }

    if (tipo === 'EMPRESA') {
      const empresa = this.empresaDAO.findById(usuarioId);
      if (!empresa) throw criarErro(404, 'Empresa parceira não encontrada.');
      return { tipo, transacoes: this.transacaoDAO.buscarResgatesDaEmpresa(empresa.id) };
    }

    throw criarErro(403, 'Perfil sem extrato.');
  }
}
