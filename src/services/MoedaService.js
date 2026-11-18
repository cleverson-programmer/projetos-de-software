import { withTransaction } from '../config/database.js';
import { executarOperacao } from './OperacaoService.js';
import { sincronizarCreditos } from './CreditoService.js';
import { enfileirarEmail } from './EmailService.js';
import * as v from '../utils/validation.js';

export class MoedaService {
  async transferir(actor, dados, chave) {
    if (actor.tipo !== 'PROFESSOR') v.fail(403, 'Somente professores podem enviar moedas.');
    const alunoId = v.id(dados.alunoId);
    const quantidade = v.integer(dados.quantidade, 'Quantidade');
    const motivo = v.text(dados.motivo, 'motivo do reconhecimento', 2000);
    await sincronizarCreditos(actor.id);
    return executarOperacao(actor, chave, 'TRANSFERENCIA', { alunoId, quantidade, motivo }, async (client) => {
      const professor = (await client.query(
        'SELECT p.*, u.nome FROM professores p JOIN usuarios u ON u.id = p.usuario_id WHERE p.usuario_id = $1 AND u.ativo FOR UPDATE OF p',
        [actor.id]
      )).rows[0];
      if (!professor) v.fail(403, 'Conta de professor indisponível.');
      const aluno = (await client.query(
        'SELECT a.*, u.nome, u.email FROM alunos a JOIN usuarios u ON u.id = a.usuario_id WHERE a.usuario_id = $1 AND u.ativo FOR UPDATE OF a',
        [alunoId]
      )).rows[0];
      if (!aluno || aluno.instituicao_id !== professor.instituicao_id) v.fail(404, 'Selecione um aluno da sua instituição.');
      if (!aluno.rg || aluno.rg.trim().length < 4) v.fail(422, 'O aluno precisa completar seu cadastro com o RG.');
      if (professor.saldo_moedas < quantidade) v.fail(409, 'Seu saldo é insuficiente para este envio.');
      if (aluno.saldo_moedas > 2147483647 - quantidade) v.fail(409, 'O saldo do aluno ultrapassaria o limite permitido.');
      const transacao = (await client.query("INSERT INTO transacoes (quantidade, tipo) VALUES ($1, 'TRANSFERENCIA') RETURNING id, data_hora", [quantidade])).rows[0];
      await client.query('INSERT INTO transferencias_moedas (transacao_id, professor_id, aluno_id, motivo) VALUES ($1, $2, $3, $4)', [transacao.id, actor.id, alunoId, motivo]);
      await client.query('UPDATE professores SET saldo_moedas = saldo_moedas - $1 WHERE usuario_id = $2', [quantidade, actor.id]);
      await client.query('UPDATE alunos SET saldo_moedas = saldo_moedas + $1 WHERE usuario_id = $2', [quantidade, alunoId]);
      await enfileirarEmail(client, {
        transacaoId: transacao.id, chave: 'transferencia:' + transacao.id, destinatario: aluno.email,
        assunto: 'Você recebeu ' + quantidade + ' moedas estudantis',
        texto: 'Olá, ' + aluno.nome + '!\n\n' + professor.nome + ' reconheceu seu mérito com ' + quantidade + ' moedas.\n\nMotivo: ' + motivo +
          '\n\nSeu saldo após este recebimento: ' + (aluno.saldo_moedas + quantidade) + ' moedas.\nAcesse sua conta para consultar o extrato.',
      });
      return { transacaoId: Number(transacao.id), quantidade, aluno: aluno.nome, motivo, saldoMoedas: professor.saldo_moedas - quantidade, dataHora: transacao.data_hora };
    });
  }

  async extrato(actor, antesDe) {
    if (!['ALUNO', 'PROFESSOR'].includes(actor.tipo)) v.fail(403, 'Extrato disponível para alunos e professores.');
    if (actor.tipo === 'PROFESSOR') await sincronizarCreditos(actor.id);
    const cursor = antesDe ? v.id(antesDe) : null;
    const table = actor.tipo === 'PROFESSOR' ? 'professores' : 'alunos';
    return withTransaction(async (client) => {
      await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY');
    const saldo = (await client.query('SELECT saldo_moedas FROM ' + table + ' WHERE usuario_id = $1', [actor.id])).rows[0]?.saldo_moedas;
    let sql;
    if (actor.tipo === 'PROFESSOR') {
      sql = "SELECT t.id, t.data_hora, t.tipo, t.quantidade, CASE WHEN t.tipo = 'CREDITO' THEN t.quantidade ELSE -t.quantidade END AS delta, tm.motivo, u.nome AS contraparte, c.semestre, NULL::text AS codigo_cupom FROM transacoes t LEFT JOIN transferencias_moedas tm ON tm.transacao_id = t.id LEFT JOIN usuarios u ON u.id = tm.aluno_id LEFT JOIN creditos_semestrais c ON c.transacao_id = t.id WHERE (tm.professor_id = $1 OR c.professor_id = $1) AND ($2::bigint IS NULL OR t.id < $2) ORDER BY t.id DESC LIMIT 51";
    } else {
      sql = "SELECT t.id, t.data_hora, t.tipo, t.quantidade, CASE WHEN t.tipo = 'RESGATE' THEN -t.quantidade ELSE t.quantidade END AS delta, COALESCE(tm.motivo, r.vantagem_nome, va.nome) AS motivo, COALESCE(prof.nome, r.empresa_nome, emp.nome) AS contraparte, NULL::text AS semestre, r.codigo_cupom FROM transacoes t LEFT JOIN transferencias_moedas tm ON tm.transacao_id = t.id LEFT JOIN usuarios prof ON prof.id = tm.professor_id LEFT JOIN resgates_vantagens r ON r.transacao_id = t.id LEFT JOIN vantagens va ON va.id = r.vantagem_id LEFT JOIN usuarios emp ON emp.id = va.empresa_id WHERE (tm.aluno_id = $1 OR r.aluno_id = $1) AND ($2::bigint IS NULL OR t.id < $2) ORDER BY t.id DESC LIMIT 51";
    }
    const { rows } = await client.query(sql, [actor.id, cursor]);
    return {
      saldoMoedas: saldo,
      transacoes: rows.slice(0, 50).map((row) => ({
        id: Number(row.id), dataHora: row.data_hora, tipo: row.tipo, quantidade: row.quantidade, delta: row.delta,
        motivo: row.motivo, contraparte: row.contraparte, semestre: row.semestre, codigoCupom: row.codigo_cupom,
      })),
      proximo: rows.length > 50 ? Number(rows[49].id) : null,
    };
    });
  }
}
