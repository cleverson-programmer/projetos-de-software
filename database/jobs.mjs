import { sincronizarCreditos } from '../src/services/CreditoService.js';
import { processarEmails } from '../src/services/EmailService.js';
import { migrateDatabase } from './migrate.mjs';
import { isMain, runCommand } from './cli.mjs';

if (isMain(import.meta.url)) await runCommand(async () => {
  await migrateDatabase();
  console.log('Créditos semestrais:', await sincronizarCreditos());
  await processarEmails(100);
});
