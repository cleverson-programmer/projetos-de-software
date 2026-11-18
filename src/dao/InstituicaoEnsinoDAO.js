import { getDatabase } from '../config/database.js';
import { InstituicaoEnsino } from '../models/InstituicaoEnsino.js';

export class InstituicaoEnsinoDAO {
  async findAll() {
    const { rows } = await getDatabase().query('SELECT id, nome, endereco FROM instituicoes_ensino ORDER BY id');
    return rows.map(InstituicaoEnsino.fromRow);
  }
  async findById(id) {
    const { rows } = await getDatabase().query('SELECT id, nome, endereco FROM instituicoes_ensino WHERE id = $1', [Number(id)]);
    return InstituicaoEnsino.fromRow(rows[0]);
  }
}
