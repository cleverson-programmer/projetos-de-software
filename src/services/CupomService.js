import crypto from 'node:crypto';
import { getDatabase, withTransaction } from '../config/database.js';
import { executarOperacao } from './OperacaoService.js';
import { enfileirarEmail } from './EmailService.js';
import * as v from '../utils/validation.js';

const SELECT_CUPOM = 'SELECT r.*, t.quantidade, t.data_hora, COALESCE(r.vantagem_nome, va.nome) AS vantagem, COALESCE(r.empresa_nome, emp.nome) AS empresa, va.empresa_id, aluno.nome AS aluno_nome, aluno.email AS aluno_email, emp.email AS empresa_email FROM resgates_vantagens r JOIN transacoes t ON t.id = r.transacao_id JOIN vantagens va ON va.id = r.vantagem_id JOIN usuarios aluno ON aluno.id = r.aluno_id JOIN usuarios emp ON emp.id = va.empresa_id';

function dto(row) {
  return {
    id: Number(row.transacao_id), codigo: row.codigo_cupom, vantagem: row.vantagem, empresa: row.empresa,
    aluno: row.aluno_nome, quantidade: row.quantidade, dataHora: row.data_hora,
    confirmadoEm: row.confirmado_em, status: row.confirmado_em ? 'UTILIZADO' : 'DISPONIVEL',
    emailsPendentes: Number(row.emails_pendentes || 0), emailsEnviados: Number(row.emails_enviados || 0),
  };
}

function checarPerfil(actor) {
  if (!['ALUNO', 'EMPRESA'].includes(actor.tipo)) v.fail(403, 'Cupons disponíveis para alunos e empresas.');
}
function autorizado(actor, row) {
  return actor.tipo === 'ALUNO' ? Number(row.aluno_id) === actor.id : Number(row.empresa_id) === actor.id;
}

export async function emailsDoCupom(client, row) {
  const detalhes = 'Código do cupom: ' + row.codigo_cupom + '\nVantagem: ' + row.vantagem + '\nParceiro: ' + row.empresa +
    '\nAluno: ' + row.aluno_nome + '\nValor: ' + row.quantidade + ' moedas.\n\nApresente este código no estabelecimento para a troca presencial.';
  await enfileirarEmail(client, {
    transacaoId: row.transacao_id, chave: 'resgate-aluno:' + row.transacao_id, destinatario: row.aluno_email,
    assunto: 'Seu cupom: ' + row.vantagem, texto: 'Olá, ' + row.aluno_nome + '!\n\nSeu resgate foi concluído.\n\n' + detalhes,
  });
  await enfileirarEmail(client, {
    transacaoId: row.transacao_id, chave: 'resgate-empresa:' + row.transacao_id, destinatario: row.empresa_email,
    assunto: 'Novo resgate: ' + row.vantagem, texto: 'Um aluno resgatou uma vantagem da sua empresa.\n\n' + detalhes +
      '\n\nConfira o código na área de cupons da empresa e confirme a utilização na entrega.',
  });
}

export class CupomService {
  async resgatar(actor, dados, chave) {
    if (actor.tipo !== 'ALUNO') v.fail(403, 'Somente alunos podem resgatar vantagens.');
    const vantagemId = v.id(dados.vantagemId);
    const custoEsperado = v.integer(dados.custoEsperado, 'Custo da vantagem');
    return executarOperacao(actor, chave, 'RESGATE', { vantagemId, custoEsperado }, async (client) => {
      const vantagem = (await client.query(
        'SELECT va.*, u.nome AS empresa_nome FROM vantagens va JOIN usuarios u ON u.id = va.empresa_id WHERE va.id = $1 AND va.ativa AND u.ativo FOR UPDATE OF va',
        [vantagemId]
      )).rows[0];
      if (!vantagem) v.fail(404, 'Esta vantagem não está mais disponível.');
      if (vantagem.custo_moedas !== custoEsperado) v.fail(409, 'O custo desta vantagem foi alterado. Atualize o catálogo antes de resgatar.');
      const aluno = (await client.query('SELECT a.* FROM alunos a JOIN usuarios u ON u.id = a.usuario_id WHERE a.usuario_id = $1 AND u.ativo FOR UPDATE OF a', [actor.id])).rows[0];
      if (!aluno || !aluno.rg || aluno.rg.trim().length < 4) v.fail(422, 'Complete seu cadastro com o RG antes de resgatar.');
      if (aluno.saldo_moedas < vantagem.custo_moedas) v.fail(409, 'Seu saldo é insuficiente para resgatar esta vantagem.');
      const transacao = (await client.query("INSERT INTO transacoes (quantidade, tipo) VALUES ($1, 'RESGATE') RETURNING id", [vantagem.custo_moedas])).rows[0];
      const codigo = 'ME-' + crypto.randomBytes(16).toString('hex').toUpperCase();
      await client.query(
        'INSERT INTO resgates_vantagens (transacao_id, aluno_id, vantagem_id, codigo_cupom, vantagem_nome, empresa_nome) VALUES ($1, $2, $3, $4, $5, $6)',
        [transacao.id, actor.id, vantagemId, codigo, vantagem.nome, vantagem.empresa_nome]
      );
      await client.query('UPDATE alunos SET saldo_moedas = saldo_moedas - $1 WHERE usuario_id = $2', [vantagem.custo_moedas, actor.id]);
      const row = (await client.query(SELECT_CUPOM + ' WHERE r.transacao_id = $1', [transacao.id])).rows[0];
      await emailsDoCupom(client, row);
      return { cupom: { ...dto(row), emailsPendentes: 2 }, saldoMoedas: aluno.saldo_moedas - vantagem.custo_moedas };
    });
  }

  async listar(actor, antesDe) {
    checarPerfil(actor);
    const filter = actor.tipo === 'ALUNO' ? 'r.aluno_id = $1' : 'va.empresa_id = $1';
    const cursor = antesDe ? v.id(antesDe) : null;
    const { rows } = await getDatabase().query(
      SELECT_CUPOM.replace(' FROM resgates_vantagens', ", (SELECT count(*) FROM emails_pendentes ep WHERE ep.transacao_id = r.transacao_id AND ep.status = 'PENDENTE') AS emails_pendentes, (SELECT count(*) FROM emails_pendentes ep WHERE ep.transacao_id = r.transacao_id AND ep.status = 'ENVIADO') AS emails_enviados FROM resgates_vantagens") +
        ' WHERE ' + filter + ' AND ($2::bigint IS NULL OR r.transacao_id < $2) ORDER BY r.transacao_id DESC LIMIT 51',
      [actor.id, cursor]
    );
    const summary = (await getDatabase().query(
      'SELECT count(*) AS total, count(*) FILTER (WHERE r.confirmado_em IS NULL) AS disponiveis, COALESCE(sum(t.quantidade), 0) AS moedas FROM resgates_vantagens r JOIN vantagens va ON va.id = r.vantagem_id JOIN transacoes t ON t.id = r.transacao_id WHERE ' + filter,
      [actor.id]
    )).rows[0];
    return {
      cupons: rows.slice(0, 50).map(dto), proximo: rows.length > 50 ? Number(rows[49].transacao_id) : null,
      resumo: { total: Number(summary.total), disponiveis: Number(summary.disponiveis), moedas: Number(summary.moedas) },
    };
  }

  async conferir(actor, codigo) {
    if (actor.tipo !== 'EMPRESA') v.fail(403, 'Somente empresas podem conferir cupons.');
    const clean = v.text(codigo, 'código do cupom', 50).toUpperCase();
    const row = (await getDatabase().query(SELECT_CUPOM + ' WHERE r.codigo_cupom = $1 AND va.empresa_id = $2', [clean, actor.id])).rows[0];
    if (!row) v.fail(404, 'Cupom não encontrado para sua empresa.');
    return dto(row);
  }

  async confirmar(actor, cupomId) {
    if (actor.tipo !== 'EMPRESA') v.fail(403, 'Somente empresas podem confirmar a utilização.');
    return withTransaction(async (client) => {
      const row = (await client.query(SELECT_CUPOM + ' WHERE r.transacao_id = $1 AND va.empresa_id = $2 FOR UPDATE OF r', [v.id(cupomId), actor.id])).rows[0];
      if (!row) v.fail(404, 'Cupom não encontrado para sua empresa.');
      if (!row.confirmado_em) {
        const updated = (await client.query('UPDATE resgates_vantagens SET confirmado_em = NOW(), confirmado_por = $2 WHERE transacao_id = $1 RETURNING confirmado_em', [row.transacao_id, actor.id])).rows[0];
        row.confirmado_em = updated.confirmado_em;
      }
      return dto(row);
    });
  }

  async reenviar(actor, cupomId) {
    checarPerfil(actor);
    await withTransaction(async (client) => {
      const row = (await client.query(SELECT_CUPOM + ' WHERE r.transacao_id = $1 FOR UPDATE OF r', [v.id(cupomId)])).rows[0];
      if (!row || !autorizado(actor, row)) v.fail(404, 'Cupom não encontrado.');
      if (Date.now() - new Date(row.ultimo_reenvio_em).getTime() < 60000) v.fail(429, 'Aguarde um minuto antes de solicitar outro envio.');
      const pending = (await client.query('SELECT processando_ate FROM emails_pendentes WHERE transacao_id = $1 FOR UPDATE', [row.transacao_id])).rows;
      if (pending.some((item) => item.processando_ate && new Date(item.processando_ate).getTime() > Date.now())) v.fail(429, 'Um envio já está em processamento. Aguarde alguns instantes.');
      await emailsDoCupom(client, row);
      await client.query(
        "UPDATE emails_pendentes SET status = 'PENDENTE', enviado_em = NULL, tentativas = 0, disponivel_em = NOW(), ultimo_erro = NULL, destinatario = CASE WHEN chave = $2 THEN $4 ELSE $5 END WHERE transacao_id = $1 AND chave IN ($2, $3)",
        [row.transacao_id, 'resgate-aluno:' + row.transacao_id, 'resgate-empresa:' + row.transacao_id, row.aluno_email, row.empresa_email]
      );
      await client.query('UPDATE resgates_vantagens SET ultimo_reenvio_em = NOW() WHERE transacao_id = $1', [row.transacao_id]);
    });
    return { message: 'O cupom será enviado novamente ao aluno e à empresa.' };
  }
}
