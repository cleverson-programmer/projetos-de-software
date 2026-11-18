export const TABLES = [
  'instituicoes_ensino', 'usuarios', 'alunos', 'professores', 'empresas_parceiras',
  'vantagens', 'transacoes', 'transferencias_moedas', 'creditos_semestrais', 'resgates_vantagens',
];

export async function databaseHasData(client) {
  for (const table of TABLES) {
    const result = await client.query('SELECT 1 FROM ' + table + ' LIMIT 1');
    if (result.rowCount) return true;
  }
  return false;
}

export async function updateSequences(client) {
  for (const table of ['instituicoes_ensino', 'usuarios', 'vantagens', 'transacoes']) {
    await client.query(
      "SELECT setval(pg_get_serial_sequence($1, 'id'), COALESCE((SELECT MAX(id) FROM " + table + '), 1), EXISTS (SELECT 1 FROM ' + table + '))',
      [table]
    );
  }
}
