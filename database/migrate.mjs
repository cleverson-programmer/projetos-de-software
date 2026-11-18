import fs from 'node:fs/promises';
import { withTransaction } from '../src/config/database.js';
import { isMain, runCommand } from './cli.mjs';

export async function migrateDatabase({ includeBootstrap = true } = {}) {
  const folder = new URL('./migrations/', import.meta.url);
  const migrations = (await fs.readdir(folder)).filter((name) => /^\d+_.*\.(sql|mjs)$/.test(name)).sort();
  await withTransaction(async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(7262026)');
    await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())');
    for (const name of migrations) {
      if (!includeBootstrap && ['003_dados_iniciais.mjs', '004_dados_exemplo_adicionais.mjs'].includes(name)) continue;
      const exists = await client.query('SELECT name FROM schema_migrations WHERE name = $1', [name]);
      if (exists.rowCount) continue;
      if (name.endsWith('.sql')) await client.query(await fs.readFile(new URL(name, folder), 'utf8'));
      else await (await import(new URL(name, folder).href)).up(client);
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [name]);
    }
  });
}

if (isMain(import.meta.url)) await runCommand(async () => {
  await migrateDatabase();
  console.log('Migrações e cadastros iniciais aplicados.');
});
