import crypto from 'node:crypto';
import { withTransaction } from '../config/database.js';
import { fail, uuid } from '../utils/validation.js';

/** Mesma chave + mesmo conteúdo devolvem o resultado anterior, sem novo débito/crédito. */
export function executarOperacao(actor, chave, acao, dados, callback) {
  uuid(chave);
  const assinatura = crypto.createHash('sha256').update(JSON.stringify({ acao, dados })).digest('hex');
  return withTransaction(async (client) => {
    const created = await client.query(
      'INSERT INTO operacoes_idempotentes (usuario_id, chave, acao, assinatura) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING RETURNING chave',
      [actor.id, chave, acao, assinatura]
    );
    if (!created.rowCount) {
      const previous = (await client.query('SELECT assinatura, resposta FROM operacoes_idempotentes WHERE usuario_id = $1 AND chave = $2', [actor.id, chave])).rows[0];
      if (previous.assinatura !== assinatura) fail(409, 'Esta operação já foi usada com outros dados. Atualize o formulário.');
      return previous.resposta;
    }
    const result = await callback(client);
    await client.query('UPDATE operacoes_idempotentes SET resposta = $3::jsonb WHERE usuario_id = $1 AND chave = $2',
      [actor.id, chave, JSON.stringify(result)]);
    return result;
  });
}
