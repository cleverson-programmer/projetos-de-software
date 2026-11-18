import nodemailer from 'nodemailer';
import { getDatabase, withTransaction } from '../config/database.js';

let transport;
let running;
let stopping = false;

function smtp() {
  if (!process.env.SMTP_HOST) throw Object.assign(new Error('SMTP não configurado.'), { code: 'SMTP_NOT_CONFIGURED' });
  if (!process.env.SMTP_FROM) throw Object.assign(new Error('Remetente SMTP não configurado.'), { code: 'SMTP_NOT_CONFIGURED' });
  if (!transport) {
    const port = Number(process.env.SMTP_PORT || 587);
    transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST, port,
      secure: process.env.SMTP_SECURE === undefined ? port === 465 : process.env.SMTP_SECURE === 'true',
      requireTLS: process.env.SMTP_REQUIRE_TLS === 'true',
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
      connectionTimeout: 8000, greetingTimeout: 8000, socketTimeout: 10000,
      disableFileAccess: true, disableUrlAccess: true,
    });
  }
  return transport;
}

/** Chamar dentro da mesma transação que registra as moedas/cupom. */
export async function enfileirarEmail(client, { transacaoId, chave, destinatario, assunto, texto }) {
  await client.query(
    'INSERT INTO emails_pendentes (transacao_id, chave, destinatario, assunto, texto) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (chave) DO NOTHING',
    [transacaoId, chave, destinatario, assunto, texto]
  );
}

async function claim() {
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      "SELECT * FROM emails_pendentes WHERE status = 'PENDENTE' AND disponivel_em <= NOW() AND (processando_ate IS NULL OR processando_ate < NOW()) ORDER BY id LIMIT 1 FOR UPDATE SKIP LOCKED"
    );
    if (!rows.length) return null;
    await client.query("UPDATE emails_pendentes SET processando_ate = NOW() + INTERVAL '2 minutes', tentativas = tentativas + 1 WHERE id = $1", [rows[0].id]);
    return rows[0];
  });
}

export function processarEmails(limit = 20) {
  if (running) return running;
  stopping = false;
  running = (async () => {
    for (let count = 0; count < limit && !stopping; count++) {
      const mail = await claim();
      if (!mail) break;
      try {
        const result = await smtp().sendMail({
          from: process.env.SMTP_FROM, to: mail.destinatario, subject: mail.assunto, text: mail.texto,
          messageId: '<moeda-' + mail.id + '@notificacoes.moeda-estudantil>',
        });
        if (!result.accepted?.length) throw Object.assign(new Error('Destinatário rejeitado.'), { code: 'SMTP_REJECTED' });
        await getDatabase().query("UPDATE emails_pendentes SET status = 'ENVIADO', enviado_em = NOW(), processando_ate = NULL, ultimo_erro = NULL WHERE id = $1", [mail.id]);
      } catch (error) {
        const delay = Math.min(3600, 30 * 2 ** Math.min(mail.tentativas, 7));
        await getDatabase().query(
          "UPDATE emails_pendentes SET processando_ate = NULL, ultimo_erro = $2, disponivel_em = NOW() + ($3 * INTERVAL '1 second') WHERE id = $1",
          [mail.id, String(error.code || 'SMTP_ERROR').slice(0, 100), delay]
        );
        console.error('Email pendente de nova tentativa:', mail.id, error.code || 'SMTP_ERROR');
        // Sem configuração, aguardar o próximo ciclo sem varrer toda a fila.
        if (error.code === 'SMTP_NOT_CONFIGURED') break;
      }
    }
  })().finally(() => { running = null; });
  return running;
}

export async function pararEmails() {
  stopping = true;
  if (running) await running;
  if (transport) transport.close();
}
