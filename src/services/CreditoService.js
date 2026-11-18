import { withTransaction } from '../config/database.js';

export function calendario(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: process.env.APP_TIMEZONE || 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return { ano: Number(values.year), semestre: Number(values.month) <= 6 ? 1 : 2, data: values.year + '-' + values.month + '-' + values.day };
}

function periodos(inicio, agora) {
  const ano = Number(inicio.slice(0, 4));
  const sem = Number(inicio.slice(5, 7)) <= 6 ? 1 : 2;
  const result = [];
  for (let index = ano * 2 + sem - 1; index <= agora.ano * 2 + agora.semestre - 1; index++) {
    result.push(Math.floor(index / 2) + '/' + (index % 2 + 1));
  }
  return result;
}

/** Crédito acumulável e idempotente; todos os comandos no mesmo cliente. */
export async function creditarNoCliente(client, date = new Date(), professorId = null) {
  const atual = calendario(date);
  const { rows } = await client.query(
    "SELECT p.usuario_id, to_char(p.inicio_creditos, 'YYYY-MM-DD') AS inicio FROM professores p JOIN usuarios u ON u.id = p.usuario_id WHERE u.ativo AND ($1::bigint IS NULL OR p.usuario_id = $1) ORDER BY p.usuario_id FOR UPDATE OF p", [professorId]
  );
  let creditados = 0;
  for (const professor of rows) {
    for (const semestre of periodos(professor.inicio, atual)) {
      const existing = await client.query('SELECT 1 FROM creditos_semestrais WHERE professor_id = $1 AND semestre = $2', [professor.usuario_id, semestre]);
      if (existing.rowCount) continue;
      const { rows: transacoes } = await client.query("INSERT INTO transacoes (quantidade, tipo) VALUES (1000, 'CREDITO') RETURNING id");
      await client.query('INSERT INTO creditos_semestrais (transacao_id, professor_id, semestre) VALUES ($1, $2, $3)', [transacoes[0].id, professor.usuario_id, semestre]);
      await client.query('UPDATE professores SET saldo_moedas = saldo_moedas + 1000 WHERE usuario_id = $1', [professor.usuario_id]);
      creditados++;
    }
  }
  return { creditados, semestre: atual.ano + '/' + atual.semestre };
}

export function sincronizarCreditos(professorId = null) {
  return withTransaction((client) => creditarNoCliente(client, new Date(), professorId));
}
