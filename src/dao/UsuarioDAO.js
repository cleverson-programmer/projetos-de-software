import { getDatabase } from '../config/database.js';
import { Usuario } from '../models/Usuario.js';

const SELECT_USUARIO = 'SELECT id, nome, email, login, senha_hash, tipo, created_at, updated_at FROM usuarios';

function fromRow(row) {
  return row ? new Usuario({
    id: row.id, nome: row.nome, email: row.email, login: row.login,
    senhaHash: row.senha_hash, tipo: row.tipo, createdAt: row.created_at, updatedAt: row.updated_at,
  }) : null;
}

export class UsuarioDAO {
  async findById(id) {
    const { rows } = await getDatabase().query(SELECT_USUARIO + ' WHERE id = $1 AND ativo', [Number(id)]);
    return fromRow(rows[0]);
  }
  async findByLogin(login) {
    const { rows } = await getDatabase().query(SELECT_USUARIO + ' WHERE lower(login) = lower($1) AND ativo', [login]);
    return fromRow(rows[0]);
  }
  async findByEmail(email) {
    const { rows } = await getDatabase().query(SELECT_USUARIO + ' WHERE lower(email) = lower($1) AND ativo', [email]);
    return fromRow(rows[0]);
  }
}
