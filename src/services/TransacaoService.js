import { TransacaoDAO } from '../dao/TransacaoDAO.js';
import { ProfessorDAO } from '../dao/ProfessorDAO.js';
import { AlunoDAO } from '../dao/AlunoDAO.js';
import { EmpresaParceiraDAO } from '../dao/EmpresaParceiraDAO.js';
import { VantagemDAO } from '../dao/VantagemDAO.js';
import { EmailService } from './EmailService.js';
import { criarEstrategiasExtrato } from './extrato/ExtratoEstrategias.js';
import { CREDITO_SEMESTRAL_MOEDAS } from '../config/regras.js';
import { criarErro } from '../utils/erros.js';
import { semestreAtual } from '../utils/semestre.js';
import { inteiroPositivo } from '../utils/validacao.js';

const MOTIVO_TAMANHO_MAXIMO = 1000;

export class TransacaoService {
  constructor(
    transacaoDAO = new TransacaoDAO(),
    professorDAO = new ProfessorDAO(),
    alunoDAO = new AlunoDAO(),
    empresaDAO = new EmpresaParceiraDAO(),
    emailService = new EmailService(),
    vantagemDAO = new VantagemDAO(),
    estrategiasExtrato = null
  ) {
    this.transacaoDAO = transacaoDAO;
    this.professorDAO = professorDAO;
    this.alunoDAO = alunoDAO;
    this.emailService = emailService;
    this.vantagemDAO = vantagemDAO;
    this.estrategiasExtrato =
      estrategiasExtrato ??
      criarEstrategiasExtrato({ transacaoDAO, professorDAO, alunoDAO, empresaDAO });
  }

  /**
   * Professor envia moedas a um aluno (motivo obrigatório, saldo suficiente).
   * Delega a validação de domínio ao Information Expert (`Professor.enviarMoedas`)
   * e persiste de forma atômica no `TransacaoDAO`. O e-mail ao aluno só é enviado
   * depois do COMMIT e, se falhar, a transação permanece (`emailEnviado: false`).
   *
   * @param {number} professorId professor autenticado
   * @param {{ alunoId: unknown, quantidade: unknown, motivo: unknown }} dados
   */
  async enviarMoedas(professorId, { alunoId, quantidade, motivo } = {}) {
    const idAluno = inteiroPositivo(alunoId);
    if (idAluno === null) {
      throw criarErro(400, 'Informe o aluno que receberá as moedas.');
    }

    const professor = this.professorDAO.findById(professorId);
    if (!professor) {
      throw criarErro(404, 'Professor não encontrado.');
    }

    const aluno = this.alunoDAO.findById(idAluno);
    if (!aluno) {
      throw criarErro(404, 'Aluno não encontrado.');
    }

    // GRASP (Information Expert): Professor valida quantidade, motivo e saldo e cria TransferenciaMoedas
    const transferenciaDominio = professor.enviarMoedas(aluno, quantidade, motivo);
    if (transferenciaDominio.motivo.length > MOTIVO_TAMANHO_MAXIMO) {
      throw criarErro(400, `O motivo deve ter no máximo ${MOTIVO_TAMANHO_MAXIMO} caracteres.`);
    }

    const resultado = this.transacaoDAO.registrarTransferencia({
      professorId: transferenciaDominio.professorId,
      alunoId: transferenciaDominio.alunoId,
      quantidade: transferenciaDominio.quantidade,
      motivo: transferenciaDominio.motivo,
    });

    const emailEnviado = await this.emailService.notificarRecebimento({
      aluno: resultado.aluno,
      professor: resultado.professor,
      quantidade: transferenciaDominio.quantidade,
      motivo: transferenciaDominio.motivo,
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
   * Aluno resgata uma vantagem: delega a validação de domínio ao Information Expert
   * (`Aluno.resgatarVantagem`), persiste atomicamente com código de cupom único e,
   * depois do COMMIT, envia o cupom ao aluno e a conferência ao parceiro (MESMO código).
   *
   * @param {number} alunoId aluno autenticado
   * @param {string | number} vantagemId
   */
  async resgatarVantagem(alunoId, vantagemId) {
    const idVantagem = inteiroPositivo(vantagemId);
    if (idVantagem === null) {
      throw criarErro(404, 'Vantagem não encontrada.');
    }

    const alunoAtual = this.alunoDAO.findById(alunoId);
    if (!alunoAtual) {
      throw criarErro(404, 'Aluno não encontrado.');
    }

    const vantagemAtual = this.vantagemDAO.findById(idVantagem);
    // GRASP (Information Expert): Aluno valida existência, disponibilidade e saldo da vantagem
    alunoAtual.resgatarVantagem(vantagemAtual);

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
    const estrategia = this.estrategiasExtrato[tipo];
    if (!estrategia) {
      throw criarErro(403, 'Perfil sem extrato.');
    }
    return estrategia.gerar(usuarioId);
  }
}
