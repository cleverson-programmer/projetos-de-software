import { getDatabase } from '../config/database.js';
import { sincronizarCreditos } from './CreditoService.js';
import { processarEmails, pararEmails } from './EmailService.js';

export function iniciarJobs() {
  let creditRun;
  const runCredits = () => {
    if (!creditRun) creditRun = sincronizarCreditos()
      .catch((error) => console.error('Crédito semestral pendente:', error.code || 'CREDIT_ERROR'))
      .finally(() => { creditRun = null; });
    return creditRun;
  };
  const runMail = () => processarEmails().catch((error) => console.error('Fila de emails:', error.code || 'EMAIL_ERROR'));
  const creditTimer = setInterval(runCredits, 60000);
  const mailTimer = setInterval(runMail, 15000);
  const cleanupTimer = setInterval(() => {
    getDatabase().query('DELETE FROM sessoes WHERE expira_em < NOW()').catch((error) => console.error('Limpeza de sessões:', error.code));
  }, 3600000);
  for (const timer of [creditTimer, mailTimer, cleanupTimer]) timer.unref();
  void runMail();
  return async () => {
    for (const timer of [creditTimer, mailTimer, cleanupTimer]) clearInterval(timer);
    await Promise.all([creditRun, pararEmails()]);
  };
}
