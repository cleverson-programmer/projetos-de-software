import { getDatabase } from '../config/database.js';
import { Usuario } from '../models/Usuario.js';

/**
 * DAO responsável pelas consultas transversais de credenciais na tabela `usuarios`.
 */
export class UsuarioDAO {
  findById(id) {
    const db = getDatabase();
    const row = db
      .prepare(
        `SELECT id, nome, email, login, senha_hash, tipo, created_at, updated_at
         FROM usuarios
         WHERE id = ?`
      )
      .get(Number(id));

    if (!row) return null;
    return new Usuario({
      id: row.id,
      nome: row.nome,
      email: row.email,
      login: row.login,
      senhaHash: row.senha_hash,
      tipo: row.tipo,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  findByLogin(login) {
    const db = getDatabase();
    const row = db
      .prepare(
        `SELECT id, nome, email, login, senha_hash, tipo, created_at, updated_at
         FROM usuarios
         WHERE login = ?`
      )
      .get(login);

    if (!row) return null;
    return new Usuario({
      id: row.id,
      nome: row.nome,
      email: row.email,
      login: row.login,
      senhaHash: row.senha_hash,
      tipo: row.tipo,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  findByEmail(email) {
    const db = getDatabase();
    const row = db
      .prepare(
        `SELECT id, nome, email, login, senha_hash, tipo, created_at, updated_at
         FROM usuarios
         WHERE email = ?`
      )
      .get(email);

    if (!row) return null;
    return new Usuario({
      id: row.id,
      nome: row.nome,
      email: row.email,
      login: row.login,
      senhaHash: row.senha_hash,
      tipo: row.tipo,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }
}

