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

/**
 * DAO responsável pela persistência da entidade `Aluno` (tabelas `usuarios` + `alunos`).
 */
export class AlunoDAO {
  /**
   * Lista todos os alunos cadastrados com sua respectiva instituição de ensino.
   * @returns {Aluno[]}
   */
  findAll() {
    const db = getDatabase();
    const rows = db.prepare(`${SELECT_ALUNO_BASE} ORDER BY u.id ASC`).all();
    return rows.map((row) => Aluno.fromRow(row));
  }

  /**
   * Busca um aluno pelo seu ID de usuário.
   * @param {number} id
   * @returns {Aluno | null}
   */
  findById(id) {
    const db = getDatabase();
    const row = db
      .prepare(`${SELECT_ALUNO_BASE} WHERE a.usuario_id = ?`)
      .get(Number(id));
    return Aluno.fromRow(row);
  }

  /**
   * Busca um aluno pelo CPF.
   * @param {string} cpf
   * @returns {Aluno | null}
   */
  findByCpf(cpf) {
    const db = getDatabase();
    const row = db
      .prepare(`${SELECT_ALUNO_BASE} WHERE a.cpf = ?`)
      .get(cpf);
    return Aluno.fromRow(row);
  }

  /**
   * Cria um novo Aluno em transação atômica (insere em `usuarios` e em `alunos`).
   */
  create({ nome, email, login, senha, senhaHash, cpf, rg, endereco, curso, instituicaoId, saldoMoedas = 0 }) {
    const hashFinal = senhaHash || Usuario.gerarHashSenha(senha);

    const novoId = withTransaction((db) => {
      const resultUsuario = db
        .prepare(
          `INSERT INTO usuarios (nome, email, login, senha_hash, tipo)
           VALUES (?, ?, ?, ?, 'ALUNO')`
        )
        .run(nome, email, login, hashFinal);

      const usuarioId = Number(resultUsuario.lastInsertRowid);

      db.prepare(
        `INSERT INTO alunos (usuario_id, cpf, rg, endereco, curso, saldo_moedas, instituicao_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(usuarioId, cpf, rg || null, endereco, curso, Number(saldoMoedas), Number(instituicaoId));

      return usuarioId;
    });

    return this.findById(novoId);
  }

  /**
   * Atualiza os dados de um Aluno existente em transação atômica (`usuarios` + `alunos`).
   */
  update(id, { nome, email, login, senha, cpf, rg, endereco, curso, instituicaoId }) {
    const usuarioId = Number(id);
    const existente = this.findById(usuarioId);
    if (!existente) {
      return null;
    }

    const novoNome = nome ?? existente.nome;
    const novoEmail = email ?? existente.email;
    const novoLogin = login ?? existente.login;
    const novaSenhaHash = senha ? Usuario.gerarHashSenha(senha) : existente.senhaHash;
    const novoCpf = cpf ?? existente.cpf;
    const novoRg = rg !== undefined ? rg : existente.rg;
    const novoEndereco = endereco ?? existente.endereco;
    const novoCurso = curso ?? existente.curso;
    const novaInstituicaoId = instituicaoId !== undefined ? Number(instituicaoId) : existente.instituicaoId;

    withTransaction((db) => {
      db.prepare(
        `UPDATE usuarios
         SET nome = ?, email = ?, login = ?, senha_hash = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND tipo = 'ALUNO'`
      ).run(novoNome, novoEmail, novoLogin, novaSenhaHash, usuarioId);

      db.prepare(
        `UPDATE alunos
         SET cpf = ?, rg = ?, endereco = ?, curso = ?, instituicao_id = ?
         WHERE usuario_id = ?`
      ).run(novoCpf, novoRg, novoEndereco, novoCurso, novaInstituicaoId, usuarioId);
    });

    return this.findById(usuarioId);
  }

  /**
   * Remove um Aluno pelo ID (remove transações vinculadas se existirem e exclui de `usuarios` com CASCADE).
   * @param {number} id
   * @returns {boolean}
   */
  delete(id) {
    const usuarioId = Number(id);
    return withTransaction((db) => {
      // Remove eventuais resgates e transferências vinculados ao aluno antes de remover o usuário
      const transacoesIds = db
        .prepare(
          `SELECT transacao_id AS id FROM transferencias_moedas WHERE aluno_id = ?
           UNION
           SELECT transacao_id AS id FROM resgates_vantagens WHERE aluno_id = ?`
        )
        .all(usuarioId, usuarioId);

      const deleteTransacaoStmt = db.prepare('DELETE FROM transacoes WHERE id = ?');
      for (const t of transacoesIds) {
        deleteTransacaoStmt.run(t.id);
      }

      const result = db
        .prepare("DELETE FROM usuarios WHERE id = ? AND tipo = 'ALUNO'")
        .run(usuarioId);

      return result.changes > 0;
    });
  }
}

