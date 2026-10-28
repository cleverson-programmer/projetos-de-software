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

/**
 * DAO responsável pela persistência da entidade `EmpresaParceira` (tabelas `usuarios` + `empresas_parceiras`).
 */
export class EmpresaParceiraDAO {
  /**
   * Lista todas as empresas parceiras cadastradas.
   * @returns {EmpresaParceira[]}
   */
  findAll() {
    const db = getDatabase();
    const rows = db.prepare(`${SELECT_EMPRESA_BASE} ORDER BY u.id ASC`).all();
    return rows.map((row) => EmpresaParceira.fromRow(row));
  }

  /**
   * Busca uma empresa parceira pelo seu ID de usuário.
   * @param {number} id
   * @returns {EmpresaParceira | null}
   */
  findById(id) {
    const db = getDatabase();
    const row = db
      .prepare(`${SELECT_EMPRESA_BASE} WHERE e.usuario_id = ?`)
      .get(Number(id));
    return EmpresaParceira.fromRow(row);
  }

  /**
   * Busca uma empresa parceira pelo CNPJ.
   * @param {string} cnpj
   * @returns {EmpresaParceira | null}
   */
  findByCnpj(cnpj) {
    const db = getDatabase();
    const row = db
      .prepare(`${SELECT_EMPRESA_BASE} WHERE e.cnpj = ?`)
      .get(cnpj);
    return EmpresaParceira.fromRow(row);
  }

  /**
   * Cria uma nova Empresa Parceira em transação atômica (insere em `usuarios` e em `empresas_parceiras`).
   */
  create({ nome, email, login, senha, senhaHash, cnpj, descricao = null }) {
    const hashFinal = senhaHash || Usuario.gerarHashSenha(senha);

    const novoId = withTransaction((db) => {
      const resultUsuario = db
        .prepare(
          `INSERT INTO usuarios (nome, email, login, senha_hash, tipo)
           VALUES (?, ?, ?, ?, 'EMPRESA')`
        )
        .run(nome, email, login, hashFinal);

      const usuarioId = Number(resultUsuario.lastInsertRowid);

      db.prepare(
        `INSERT INTO empresas_parceiras (usuario_id, cnpj, descricao)
         VALUES (?, ?, ?)`
      ).run(usuarioId, cnpj, descricao);

      return usuarioId;
    });

    return this.findById(novoId);
  }

  /**
   * Atualiza os dados de uma Empresa Parceira existente em transação atômica (`usuarios` + `empresas_parceiras`).
   */
  update(id, { nome, email, login, senha, cnpj, descricao }) {
    const usuarioId = Number(id);
    const existente = this.findById(usuarioId);
    if (!existente) {
      return null;
    }

    const novoNome = nome ?? existente.nome;
    const novoEmail = email ?? existente.email;
    const novoLogin = login ?? existente.login;
    const novaSenhaHash = senha ? Usuario.gerarHashSenha(senha) : existente.senhaHash;
    const novoCnpj = cnpj ?? existente.cnpj;
    const novaDescricao = descricao !== undefined ? descricao : existente.descricao;

    withTransaction((db) => {
      db.prepare(
        `UPDATE usuarios
         SET nome = ?, email = ?, login = ?, senha_hash = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND tipo = 'EMPRESA'`
      ).run(novoNome, novoEmail, novoLogin, novaSenhaHash, usuarioId);

      db.prepare(
        `UPDATE empresas_parceiras
         SET cnpj = ?, descricao = ?
         WHERE usuario_id = ?`
      ).run(novoCnpj, novaDescricao, usuarioId);
    });

    return this.findById(usuarioId);
  }

  /**
   * Indica se alguma vantagem da empresa já foi resgatada por um aluno.
   * @param {number} id
   * @returns {boolean}
   */
  possuiVantagemComResgate(id) {
    const db = getDatabase();
    const row = db
      .prepare(
        `SELECT EXISTS (
           SELECT 1
           FROM resgates_vantagens r
           INNER JOIN vantagens v ON v.id = r.vantagem_id
           WHERE v.empresa_id = ?
         ) AS possui`
      )
      .get(Number(id));
    return Number(row.possui) === 1;
  }

  /**
   * Remove uma Empresa Parceira pelo ID (exclui de `usuarios`, com CASCADE para suas vantagens).
   * Não apaga transações: se alguma vantagem foi resgatada, a FK `ON DELETE RESTRICT` impede a exclusão.
   * @param {number} id
   * @returns {boolean}
   */
  delete(id) {
    const usuarioId = Number(id);
    return withTransaction((db) => {
      const result = db
        .prepare("DELETE FROM usuarios WHERE id = ? AND tipo = 'EMPRESA'")
        .run(usuarioId);

      return result.changes > 0;
    });
  }
}

