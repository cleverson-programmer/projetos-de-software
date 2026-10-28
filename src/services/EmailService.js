import { criarTransporter, emailSimulado, remetente } from '../config/mail.js';
import { escapeHtml } from '../utils/html.js';

/** Converte `YYYY-MM-DD HH:MM:SS` (UTC, como gravado no banco) para data/hora de Brasília. */
function formatarDataHora(dataHora) {
  if (typeof dataHora !== 'string') return '';
  const data = new Date(`${dataHora.replace(' ', 'T')}Z`);
  if (Number.isNaN(data.getTime())) return dataHora;
  return data.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

/** Remove quebras de linha do assunto (evita injeção de cabeçalhos). */
function limparAssunto(assunto) {
  return String(assunto).replace(/[\r\n]+/g, ' ').trim();
}

/** Texto de moedas com singular/plural. */
function moedas(quantidade) {
  return `${quantidade} ${Number(quantidade) === 1 ? 'moeda' : 'moedas'}`;
}

function paginaHtml(titulo, linhasHtml) {
  return (
    `<div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto;">` +
    `<h2>${escapeHtml(titulo)}</h2>${linhasHtml}` +
    `<p style="color: #666; font-size: 12px;">Sistema de Moeda Estudantil. Esta é uma mensagem automática.</p></div>`
  );
}

/**
 * Envio dos e-mails do sistema (nodemailer). Nenhum método lança: em caso de falha o erro é
 * registrado no console e o método retorna `false` (`true` quando o e-mail foi enviado).
 * Os valores digitados por usuários são escapados no HTML; todo e-mail tem versão em texto puro.
 *
 * Sem SMTP configurado (modo simulado), cada e-mail é impresso numa linha parseável:
 * `[EMAIL-SIMULADO] {"to":...,"subject":...,"text":...}`.
 */
export class EmailService {
  /**
   * @param {{ sendMail: Function } | null} [transporter] injetável em testes; sem ele usa o
   *   transporter configurado pelas variáveis de ambiente (config/mail.js)
   * @param {{ simulado?: boolean, de?: string }} [opcoes]
   */
  constructor(transporter = null, { simulado, de } = {}) {
    if (transporter) {
      this.transporter = transporter;
      this.simulado = simulado ?? false;
    } else {
      this.transporter = criarTransporter();
      this.simulado = simulado ?? emailSimulado();
    }
    this.de = de ?? remetente();
  }

  /**
   * Notifica o aluno de que recebeu moedas.
   * @param {{ aluno: {nome: string, email: string}, professor: {nome: string}, quantidade: number, motivo: string, novoSaldo?: number }} dados
   */
  async notificarRecebimento({ aluno, professor, quantidade, motivo, novoSaldo }) {
    const assunto = `Você recebeu ${moedas(quantidade)} de ${professor.nome}`;
    const saldoTexto = novoSaldo !== undefined ? `\nSeu novo saldo: ${moedas(novoSaldo)}.` : '';
    const text =
      `Olá, ${aluno.nome}!\n\n` +
      `O professor ${professor.nome} enviou ${moedas(quantidade)} para você.\n` +
      `Motivo: ${motivo}${saldoTexto}\n\n` +
      `Acesse o sistema para ver seu extrato e trocar suas moedas por vantagens.`;
    const html = paginaHtml(
      'Você recebeu moedas!',
      `<p>Olá, <strong>${escapeHtml(aluno.nome)}</strong>!</p>` +
        `<p>O professor <strong>${escapeHtml(professor.nome)}</strong> enviou ` +
        `<strong>${escapeHtml(moedas(quantidade))}</strong> para você.</p>` +
        `<p><strong>Motivo:</strong> ${escapeHtml(motivo)}</p>` +
        (novoSaldo !== undefined ? `<p>Seu novo saldo: <strong>${escapeHtml(moedas(novoSaldo))}</strong>.</p>` : '') +
        `<p>Acesse o sistema para ver seu extrato e trocar suas moedas por vantagens.</p>`
    );
    return this.#enviar({ to: aluno.email, subject: assunto, text, html });
  }

  /**
   * Envia ao aluno o cupom do resgate, com o código gerado pelo sistema.
   * @param {{ aluno: {nome: string, email: string}, vantagem: {nome: string, custoMoedas: number, empresaNome?: string}, codigo: string }} dados
   */
  async enviarCupomAluno({ aluno, vantagem, codigo }) {
    const empresa = vantagem.empresaNome ? ` (${vantagem.empresaNome})` : '';
    const assunto = `Seu cupom: ${vantagem.nome} - código ${codigo}`;
    const text =
      `Olá, ${aluno.nome}!\n\n` +
      `Você resgatou a vantagem "${vantagem.nome}"${empresa} por ${moedas(vantagem.custoMoedas)}.\n\n` +
      `Código do cupom: ${codigo}\n\n` +
      `Para usar, apresente este código ao parceiro na troca presencial.`;
    const html = paginaHtml(
      'Seu cupom de resgate',
      `<p>Olá, <strong>${escapeHtml(aluno.nome)}</strong>!</p>` +
        `<p>Você resgatou a vantagem <strong>${escapeHtml(vantagem.nome)}</strong>` +
        `${escapeHtml(empresa)} por <strong>${escapeHtml(moedas(vantagem.custoMoedas))}</strong>.</p>` +
        `<p>Código do cupom:</p>` +
        `<p style="font-size: 22px; font-weight: bold; letter-spacing: 1px;">${escapeHtml(codigo)}</p>` +
        `<p>Para usar, apresente este código ao parceiro na troca presencial.</p>`
    );
    return this.#enviar({ to: aluno.email, subject: assunto, text, html });
  }

  /**
   * Envia à empresa parceira o aviso de resgate, com o mesmo código, para conferência da troca.
   * @param {{ empresa: {nome: string, email: string}, aluno: {nome: string}, vantagem: {nome: string, custoMoedas: number}, codigo: string, dataHora?: string }} dados
   */
  async enviarConferenciaParceiro({ empresa, aluno, vantagem, codigo, dataHora }) {
    const quando = formatarDataHora(dataHora);
    const assunto = `Resgate para conferência: ${vantagem.nome} - código ${codigo}`;
    const text =
      `Olá, ${empresa.nome}!\n\n` +
      `O aluno ${aluno.nome} resgatou a vantagem "${vantagem.nome}" (${moedas(vantagem.custoMoedas)}).\n` +
      (quando ? `Data do resgate: ${quando}\n` : '') +
      `\nCódigo do cupom: ${codigo}\n\n` +
      `Confira este código quando o aluno comparecer para a troca presencial.`;
    const html = paginaHtml(
      'Resgate para conferência',
      `<p>Olá, <strong>${escapeHtml(empresa.nome)}</strong>!</p>` +
        `<p>O aluno <strong>${escapeHtml(aluno.nome)}</strong> resgatou a vantagem ` +
        `<strong>${escapeHtml(vantagem.nome)}</strong> (${escapeHtml(moedas(vantagem.custoMoedas))}).</p>` +
        (quando ? `<p>Data do resgate: ${escapeHtml(quando)}</p>` : '') +
        `<p>Código do cupom:</p>` +
        `<p style="font-size: 22px; font-weight: bold; letter-spacing: 1px;">${escapeHtml(codigo)}</p>` +
        `<p>Confira este código quando o aluno comparecer para a troca presencial.</p>`
    );
    return this.#enviar({ to: empresa.email, subject: assunto, text, html });
  }

  /** Envia a mensagem; nunca lança. */
  async #enviar({ to, subject, text, html }) {
    const assunto = limparAssunto(subject);
    try {
      await this.transporter.sendMail({ from: this.de, to, subject: assunto, text, html });
      if (this.simulado) {
        console.log(`[EMAIL-SIMULADO] ${JSON.stringify({ to, subject: assunto, text })}`);
      }
      return true;
    } catch (erro) {
      console.error(`[E-mail] falha ao enviar "${assunto}" para ${to}:`, erro?.message ?? erro);
      return false;
    }
  }
}
