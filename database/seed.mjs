// A carga inicial passou a ser parte das migrations e também ocorre em produção.
import { migrateDatabase } from './migrate.mjs';
import { isMain, runCommand } from './cli.mjs';

export async function seedDemoData() { await migrateDatabase(); }
if (isMain(import.meta.url)) await runCommand(async () => {
  await migrateDatabase();
  console.log('Cadastros iniciais garantidos pelas migrations; contas existentes não foram redefinidas.');
});
