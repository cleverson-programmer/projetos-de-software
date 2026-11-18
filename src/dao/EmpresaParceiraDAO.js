import { getDatabase, withTransaction } from '../config/database.js';
import { EmpresaParceira } from '../models/EmpresaParceira.js';
import { Usuario } from '../models/Usuario.js';

const SELECT_EMPRESA_BASE = `
  SELECT
    u.id,
    u.nome,
    u.email,
    u.login,
    u.senha_hash,
    u.tipo,
    u.created_at,
    u.updated_at,
    e.usuario_id,
    e.cnpj,
    e.descricao
  FROM empresas_parceiras e
  INNER JOIN usuarios u ON u.id = e.usuario_id
`;

export class EmpresaParceiraDAO {
  async findAll() {
    const { rows } = await getDatabase().query(SELECT_EMPRESA_BASE + ' ORDER BY u.id');
    return rows.map(EmpresaParceira.fromRow);
  }

  async findById(id) {
    const { rows } = await getDatabase().query(SELECT_EMPRESA_BASE + ' WHERE e.usuario_id = $1', [Number(id)]);
    return EmpresaParceira.fromRow(rows[0]);
  }

  async findByCnpj(cnpj) {
    const { rows } = await getDatabase().query(SELECT_EMPRESA_BASE + ' WHERE e.cnpj = $1', [cnpj]);
    return EmpresaParceira.fromRow(rows[0]);
  }

  async create({ nome, email, login, senha, senhaHash, cnpj, descricao = null }) {
    const hash = senhaHash || Usuario.gerarHashSenha(senha);
    return withTransaction(async (client) => {
      const { rows: users } = await client.query(
        "INSERT INTO usuarios (nome, email, login, senha_hash, tipo) VALUES ($1, $2, $3, $4, 'EMPRESA') RETURNING id",
        [nome, email, login, hash]
      );
      const id = users[0].id;
      await client.query('INSERT INTO empresas_parceiras (usuario_id, cnpj, descricao) VALUES ($1, $2, $3)', [id, cnpj, descricao]);
      const { rows } = await client.query(SELECT_EMPRESA_BASE + ' WHERE e.usuario_id = $1', [id]);
      return EmpresaParceira.fromRow(rows[0]);
    });
  }

  async update(id, dados) {
    return withTransaction(async (client) => {
      const { rows } = await client.query(SELECT_EMPRESA_BASE + ' WHERE e.usuario_id = $1 FOR UPDATE OF u, e', [Number(id)]);
      const atual = EmpresaParceira.fromRow(rows[0]);
      if (!atual) return null;
      await client.query(
        "UPDATE usuarios SET nome = $1, email = $2, login = $3, senha_hash = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $5 AND tipo = 'EMPRESA'",
        [dados.nome ?? atual.nome, dados.email ?? atual.email, dados.login ?? atual.login,
          dados.senha ? Usuario.gerarHashSenha(dados.senha) : atual.senhaHash, atual.id]
      );
      await client.query('UPDATE empresas_parceiras SET cnpj = $1, descricao = $2 WHERE usuario_id = $3',
        [dados.cnpj ?? atual.cnpj, dados.descricao !== undefined ? dados.descricao : atual.descricao, atual.id]);
      const result = await client.query(SELECT_EMPRESA_BASE + ' WHERE e.usuario_id = $1', [atual.id]);
      return EmpresaParceira.fromRow(result.rows[0]);
    });
  }

  async delete(id) {
    return withTransaction(async (client) => {
      const result = await client.query("UPDATE usuarios SET ativo = FALSE, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND tipo = 'EMPRESA' AND ativo", [Number(id)]);
      await client.query('UPDATE vantagens SET ativa = FALSE WHERE empresa_id = $1', [Number(id)]);
      await client.query('DELETE FROM sessoes WHERE usuario_id = $1', [Number(id)]);
      return result.rowCount > 0;
    });
  }
}
