import crypto from 'node:crypto';
import { getDatabase, withTransaction } from '../config/database.js';
import * as v from '../utils/validation.js';

function dto(row) {
  return { id: Number(row.id), empresaId: Number(row.empresa_id), empresa: row.empresa_nome, nome: row.nome, descricao: row.descricao, fotoUrl: row.foto_url, custoMoedas: row.custo_moedas, ativa: row.ativa };
}

async function campos(dados, actor, client) {
  const result = {
    nome: v.text(dados.nome, 'nome da vantagem', 150), descricao: v.text(dados.descricao, 'descrição da vantagem', 2000),
    fotoUrl: v.text(dados.fotoUrl, 'foto da vantagem', 500), custoMoedas: v.integer(dados.custoMoedas, 'Custo em moedas'),
    ativa: dados.ativa === undefined ? true : dados.ativa,
  };
  if (typeof result.ativa !== 'boolean') v.fail(400, 'Situação da vantagem inválida.');
  const upload = result.fotoUrl.match(/^\/api\/fotos\/([a-f0-9-]{36})$/i);
  if (upload) {
    v.uuid(upload[1]);
    if (!(await client.query('SELECT 1 FROM fotos_vantagens WHERE id = $1 AND empresa_id = $2', [upload[1], actor.id])).rowCount) v.fail(400, 'Selecione uma foto enviada pela sua empresa.');
  } else {
    let url;
    try { url = new URL(result.fotoUrl); } catch { v.fail(400, 'Informe uma URL HTTPS ou envie uma foto.'); }
    if (url.protocol !== 'https:' || url.username || url.password) v.fail(400, 'A foto externa deve usar uma URL HTTPS.');
  }
  return result;
}

export class VantagemService {
  async listar(actor, busca = '') {
    const term = typeof busca === 'string' ? busca.trim().slice(0, 100) : '';
    const { rows } = await getDatabase().query(
      'SELECT v.*, u.nome AS empresa_nome FROM vantagens v JOIN usuarios u ON u.id = v.empresa_id WHERE u.ativo AND (($1::boolean AND v.empresa_id = $2) OR (NOT $1::boolean AND v.ativa)) AND (v.nome ILIKE $3 OR v.descricao ILIKE $3 OR u.nome ILIKE $3) ORDER BY v.id DESC',
      [actor.tipo === 'EMPRESA', actor.id, '%' + term + '%']
    );
    return rows.map(dto);
  }

  async criar(actor, dados) {
    if (actor.tipo !== 'EMPRESA') v.fail(403, 'Somente empresas podem cadastrar vantagens.');
    return withTransaction(async (client) => {
      const fields = await campos(dados, actor, client);
      const row = (await client.query(
        'INSERT INTO vantagens (empresa_id, nome, descricao, foto_url, custo_moedas, ativa) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
        [actor.id, fields.nome, fields.descricao, fields.fotoUrl, fields.custoMoedas, fields.ativa]
      )).rows[0];
      return dto(row);
    });
  }

  async atualizar(actor, vantagemId, dados) {
    if (actor.tipo !== 'EMPRESA') v.fail(403, 'Somente empresas podem alterar vantagens.');
    return withTransaction(async (client) => {
      const row = (await client.query('SELECT * FROM vantagens WHERE id = $1 AND empresa_id = $2 FOR UPDATE', [v.id(vantagemId), actor.id])).rows[0];
      if (!row) v.fail(404, 'Vantagem não encontrada para sua empresa.');
      const fields = await campos({ ...dto(row), ...dados }, actor, client);
      const updated = (await client.query('UPDATE vantagens SET nome = $1, descricao = $2, foto_url = $3, custo_moedas = $4, ativa = $5 WHERE id = $6 RETURNING *',
        [fields.nome, fields.descricao, fields.fotoUrl, fields.custoMoedas, fields.ativa, row.id])).rows[0];
      return dto(updated);
    });
  }

  async desativar(actor, vantagemId) { return this.atualizar(actor, vantagemId, { ativa: false }); }

  async foto(actor, dados) {
    if (actor.tipo !== 'EMPRESA') v.fail(403, 'Somente empresas podem enviar fotos.');
    const mime = dados.mime;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(mime) || typeof dados.base64 !== 'string' ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(dados.base64) || dados.base64.length > 2796204) v.fail(400, 'Envie uma foto JPEG, PNG ou WebP de até 2 MB.');
    const content = Buffer.from(dados.base64, 'base64');
    if (!content.length || content.length > 2097152) v.fail(400, 'A foto deve ter até 2 MB.');
    const valid = mime === 'image/jpeg' ? content.subarray(0, 3).equals(Buffer.from([255, 216, 255])) :
      mime === 'image/png' ? content.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) :
        content.toString('ascii', 0, 4) === 'RIFF' && content.toString('ascii', 8, 12) === 'WEBP';
    if (!valid) v.fail(400, 'O conteúdo da foto não corresponde ao formato informado.');
    const fotoId = crypto.randomUUID();
    await getDatabase().query('INSERT INTO fotos_vantagens (id, empresa_id, conteudo, mime) VALUES ($1, $2, $3, $4)', [fotoId, actor.id, content, mime]);
    return { fotoUrl: '/api/fotos/' + fotoId };
  }

  async buscarFoto(fotoId) {
    v.uuid(fotoId);
    const row = (await getDatabase().query('SELECT conteudo, mime FROM fotos_vantagens WHERE id = $1', [fotoId])).rows[0];
    if (!row) v.fail(404, 'Foto não encontrada.');
    return row;
  }
}
