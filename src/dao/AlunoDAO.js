import { getDatabase, withTransaction } from '../config/database.js';
import { Aluno } from '../models/Aluno.js';
import { Usuario } from '../models/Usuario.js';

const SELECT_ALUNO_BASE = `
  SELECT
    u.id,
    u.nome,
    u.email,
    u.login,
    u.senha_hash,
    u.tipo,
    u.created_at,
    u.updated_at,
    a.usuario_id,
    a.cpf,
    a.rg,
    a.endereco,
    a.curso,
    a.saldo_moedas,
    a.instituicao_id,
    i.nome AS instituicao_nome,
    i.endereco AS instituicao_endereco
  FROM alunos a
  INNER JOIN usuarios u ON u.id = a.usuario_id
  INNER JOIN instituicoes_ensino i ON i.id = a.instituicao_id
`;

export class AlunoDAO {
  async findAll() {
    const { rows } = await getDatabase().query(SELECT_ALUNO_BASE + ' ORDER BY u.id');
    return rows.map(Aluno.fromRow);
  }

  async findById(id) {
    const { rows } = await getDatabase().query(SELECT_ALUNO_BASE + ' WHERE a.usuario_id = $1', [Number(id)]);
    return Aluno.fromRow(rows[0]);
  }

  async findByCpf(cpf) {
    const { rows } = await getDatabase().query(SELECT_ALUNO_BASE + ' WHERE a.cpf = $1', [cpf]);
    return Aluno.fromRow(rows[0]);
  }

  async create({ nome, email, login, senha, senhaHash, cpf, rg, endereco, curso, instituicaoId, saldoMoedas = 0 }) {
    const hash = senhaHash || Usuario.gerarHashSenha(senha);
    return withTransaction(async (client) => {
      const { rows: users } = await client.query(
        "INSERT INTO usuarios (nome, email, login, senha_hash, tipo) VALUES ($1, $2, $3, $4, 'ALUNO') RETURNING id",
        [nome, email, login, hash]
      );
      const id = users[0].id;
      await client.query(
        'INSERT INTO alunos (usuario_id, cpf, rg, endereco, curso, saldo_moedas, instituicao_id) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [id, cpf, rg || null, endereco, curso, Number(saldoMoedas), Number(instituicaoId)]
      );
      const { rows } = await client.query(SELECT_ALUNO_BASE + ' WHERE a.usuario_id = $1', [id]);
      return Aluno.fromRow(rows[0]);
    });
  }

  async update(id, dados) {
    return withTransaction(async (client) => {
      const { rows } = await client.query(SELECT_ALUNO_BASE + ' WHERE a.usuario_id = $1 FOR UPDATE OF u, a', [Number(id)]);
      const atual = Aluno.fromRow(rows[0]);
      if (!atual) return null;
      await client.query(
        "UPDATE usuarios SET nome = $1, email = $2, login = $3, senha_hash = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $5 AND tipo = 'ALUNO'",
        [dados.nome ?? atual.nome, dados.email ?? atual.email, dados.login ?? atual.login,
          dados.senha ? Usuario.gerarHashSenha(dados.senha) : atual.senhaHash, atual.id]
      );
      await client.query(
        'UPDATE alunos SET cpf = $1, rg = $2, endereco = $3, curso = $4, instituicao_id = $5 WHERE usuario_id = $6',
        [dados.cpf ?? atual.cpf, dados.rg !== undefined ? dados.rg : atual.rg,
          dados.endereco ?? atual.endereco, dados.curso ?? atual.curso,
          dados.instituicaoId ?? atual.instituicaoId, atual.id]
      );
      const result = await client.query(SELECT_ALUNO_BASE + ' WHERE a.usuario_id = $1', [atual.id]);
      return Aluno.fromRow(result.rows[0]);
    });
  }

  // Preserva o comportamento anterior: exclusão também do histórico vinculado.
  async delete(id) {
    return withTransaction(async (client) => {
      const result = await client.query("UPDATE usuarios SET ativo = FALSE, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND tipo = 'ALUNO' AND ativo", [Number(id)]);

      await client.query('DELETE FROM sessoes WHERE usuario_id = $1', [Number(id)]);
      return result.rowCount > 0;
    });
  }
}
