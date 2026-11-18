import path from 'node:path';
import { withTransaction } from '../src/config/database.js';
import { TABLES, databaseHasData, updateSequences } from './tables.mjs';
import { migrateDatabase } from './migrate.mjs';
import { isMain, runCommand } from './cli.mjs';

/** Importação explícita e atômica para destino vazio. Origem aberta só para leitura. */
export async function importSQLite(sourcePath) {
  const { DatabaseSync } = await import('node:sqlite');
  const source = new DatabaseSync(path.resolve(sourcePath), { readOnly: true });
  try {
    if (source.prepare('PRAGMA quick_check').get().quick_check !== 'ok') {
      throw new Error('O SQLite de origem não passou na verificação de integridade.');
    }
    return await withTransaction(async (client) => {
      await client.query('SELECT pg_advisory_xact_lock(7262026)');
      await client.query('LOCK TABLE ' + TABLES.join(', ') + ' IN ACCESS EXCLUSIVE MODE');
      if (await databaseHasData(client)) throw new Error('Importação recusada: PostgreSQL de destino não está vazio.');
      const counts = {};
      for (const table of TABLES) {
        const columns = source.prepare('PRAGMA table_info(' + table + ')').all().map((column) => column.name);
        if (!columns.length || columns.some((column) => !/^[a-z_][a-z0-9_]*$/.test(column))) {
          throw new Error('Estrutura SQLite inválida: ' + table);
        }
        const rows = source.prepare('SELECT * FROM ' + table).all();
        for (const row of rows) {
          const values = columns.map((column) => column === 'ativa' ? Boolean(row[column]) : row[column]);
          const placeholders = columns.map((_, index) => '$' + (index + 1));
          await client.query('INSERT INTO ' + table + ' (' + columns.join(', ') + ') VALUES (' + placeholders.join(', ') + ')', values);
        }
        counts[table] = rows.length;
      }
      await updateSequences(client);
      return counts;
    });
  } finally {
    source.close();
  }
}

if (isMain(import.meta.url)) await runCommand(async () => {
  await migrateDatabase({ includeBootstrap: false });
  const counts = await importSQLite(process.argv[2] || 'database/moeda_estudantil.db');
  await migrateDatabase();
  console.log('Importação concluída. Registros por tabela:', JSON.stringify(counts));
});
