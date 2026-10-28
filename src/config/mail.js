import nodemailer from 'nodemailer';

/**
 * Configuração de e-mail (nodemailer), lida das variáveis de ambiente:
 * SMTP_HOST, SMTP_PORT (587), SMTP_SECURE (true/false; padrão true se a porta for 465),
 * SMTP_USER, SMTP_PASS e MAIL_FROM.
 *
 * Sem SMTP_HOST (ou vazio) o sistema entra em modo simulado: nenhum e-mail sai pela rede e
 * cada mensagem é impressa no console como `[EMAIL-SIMULADO] {json}`.
 */

const REMETENTE_PADRAO = 'Moeda Estudantil <nao-responder@moeda-estudantil.local>';

/** Indica se o SMTP está configurado (lido a cada chamada, não no import). */
export function emailSimulado() {
  const host = process.env.SMTP_HOST;
  return !host || host.trim() === '';
}

/** Remetente (`MAIL_FROM`) ou um valor padrão. */
export function remetente() {
  const configurado = process.env.MAIL_FROM;
  return configurado && configurado.trim() !== '' ? configurado.trim() : REMETENTE_PADRAO;
}

/**
 * Cria o transporter do nodemailer conforme o ambiente.
 * Modo simulado: `jsonTransport` (não usa a rede).
 */
export function criarTransporter() {
  if (emailSimulado()) {
    return nodemailer.createTransport({ jsonTransport: true });
  }

  const porta = Number(process.env.SMTP_PORT) || 587;
  const seguroConfigurado = (process.env.SMTP_SECURE ?? '').trim().toLowerCase();
  const secure = seguroConfigurado === '' ? porta === 465 : seguroConfigurado === 'true';

  const opcoes = {
    host: process.env.SMTP_HOST.trim(),
    port: porta,
    secure,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  };
  if (process.env.SMTP_USER && process.env.SMTP_USER !== '') {
    opcoes.auth = { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS ?? '' };
  }
  return nodemailer.createTransport(opcoes);
}

/**
 * Avisa na inicialização do servidor se o envio real de e-mails está desativado.
 */
export function avisarConfiguracaoEmail() {
  if (emailSimulado()) {
    console.warn(
      '[E-mail] SMTP_HOST não configurado: modo simulado. Os e-mails serão apenas impressos no console ' +
        'como [EMAIL-SIMULADO]. Defina SMTP_HOST (e demais SMTP_*) para enviar e-mails de verdade.'
    );
  }
}
