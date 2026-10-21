import { getDatabase } from '../config/database.js';
import { InstituicaoEnsino } from '../models/InstituicaoEnsino.js';

/**
 * DAO responsável pelo acesso aos dados da tabela `instituicoes_ensino`.
 */
export class InstituicaoEnsinoDAO {
  /**
   * Lista todas as instituições de ensino pré-cadastradas.
   * @returns {InstituicaoEnsino[]}
   */
  findAll() {
    const db = getDatabase();
    const rows = db
      .prepare('SELECT id, nome, endereco FROM instituicoes_ensino ORDER BY id ASC')
      .all();
    return rows.map((row) => InstituicaoEnsino.fromRow(row));
  }

  /**
   * Busca uma instituição de ensino pelo seu identificador.
   * @param {number} id
   * @returns {InstituicaoEnsino | null}
   */
  findById(id) {
    const db = getDatabase();
    const row = db
      .prepare('SELECT id, nome, endereco FROM instituicoes_ensino WHERE id = ?')
      .get(Number(id));
    return InstituicaoEnsino.fromRow(row);
  }
}

