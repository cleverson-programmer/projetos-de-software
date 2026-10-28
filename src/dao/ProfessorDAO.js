import { getDatabase, withTransaction } from '../config/database.js';
import { Professor } from '../models/Professor.js';
import { Usuario } from '../models/Usuario.js';

const SELECT_PROFESSOR_BASE = `
  SELECT
    u.id,
    u.nome,
    u.email,
    u.login,
    u.senha_hash,
    u.tipo,
    u.created_at,
    u.updated_at,
    p.usuario_id,
    p.cpf,
    p.departamento,
    p.saldo_moedas,
    p.instituicao_id,
    i.nome AS instituicao_nome,
    i.endereco AS instituicao_endereco
  FROM professores p
  INNER JOIN usuarios u ON u.id = p.usuario_id
  INNER JOIN instituicoes_ensino i ON i.id = p.instituicao_id
`;

/**
 * DAO responsável pela persistência da entidade `Professor` (tabelas `usuarios` + `professores`).
 * Professores são pré-cadastrados: não há exclusão e o saldo só muda via TransacaoDAO.
 */
export class ProfessorDAO {
  /**
   * Lista todos os professores com sua instituição de ensino.
   * @returns {Professor[]}
   */
  findAll() {
    const db = getDatabase();
    const rows = db.prepare(`${SELECT_PROFESSOR_BASE} ORDER BY u.id ASC`).all();
    return rows.map((row) => Professor.fromRow(row));
  }

  /**
   * @param {number} id
   * @returns {Professor | null}
   */
  findById(id) {
    const db = getDatabase();
    const row = db.prepare(`${SELECT_PROFESSOR_BASE} WHERE p.usuario_id = ?`).get(Number(id));
    return Professor.fromRow(row);
  }

  /**
   * @param {string} cpf CPF na forma canônica
   * @returns {Professor | null}
   */
  findByCpf(cpf) {
    const db = getDatabase();
    const row = db.prepare(`${SELECT_PROFESSOR_BASE} WHERE p.cpf = ?`).get(cpf);
    return Professor.fromRow(row);
  }

  /**
   * Cria um Professor em transação atômica (insere em `usuarios` e em `professores`).
   */
  create({ nome, email, login, senha, senhaHash, cpf, departamento, instituicaoId, saldoMoedas = 0 }) {
    const hashFinal = senhaHash || Usuario.gerarHashSenha(senha);

    const novoId = withTransaction((db) => {
      const resultUsuario = db
        .prepare(
          `INSERT INTO usuarios (nome, email, login, senha_hash, tipo)
           VALUES (?, ?, ?, ?, 'PROFESSOR')`
        )
        .run(nome, email, login, hashFinal);

      const usuarioId = Number(resultUsuario.lastInsertRowid);

      db.prepare(
        `INSERT INTO professores (usuario_id, cpf, departamento, saldo_moedas, instituicao_id)
         VALUES (?, ?, ?, ?, ?)`
      ).run(usuarioId, cpf, departamento, Number(saldoMoedas), Number(instituicaoId));

      return usuarioId;
    });

    return this.findById(novoId);
  }

  /**
   * Atualiza dados cadastrais de um Professor (`usuarios` + `professores`). Não altera o saldo.
   */
  update(id, { nome, email, login, senha, cpf, departamento, instituicaoId }) {
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
    const novoDepartamento = departamento ?? existente.departamento;
    const novaInstituicaoId = instituicaoId !== undefined ? Number(instituicaoId) : existente.instituicaoId;

    withTransaction((db) => {
      db.prepare(
        `UPDATE usuarios
         SET nome = ?, email = ?, login = ?, senha_hash = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND tipo = 'PROFESSOR'`
      ).run(novoNome, novoEmail, novoLogin, novaSenhaHash, usuarioId);

      db.prepare(
        `UPDATE professores
         SET cpf = ?, departamento = ?, instituicao_id = ?
         WHERE usuario_id = ?`
      ).run(novoCpf, novoDepartamento, novaInstituicaoId, usuarioId);
    });

    return this.findById(usuarioId);
  }
}
