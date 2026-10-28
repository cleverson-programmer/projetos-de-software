import { getDatabase, withTransaction } from '../config/database.js';
import { Vantagem } from '../models/Vantagem.js';

const SELECT_VANTAGEM_BASE = `
  SELECT
    v.id,
    v.empresa_id,
    u.nome AS empresa_nome,
    v.nome,
    v.descricao,
    v.foto_url,
    v.custo_moedas,
    v.ativa,
    v.created_at
  FROM vantagens v
  INNER JOIN empresas_parceiras e ON e.usuario_id = v.empresa_id
  INNER JOIN usuarios u ON u.id = e.usuario_id
`;

/**
 * DAO responsável pela persistência da entidade `Vantagem` (tabela `vantagens`).
 */
export class VantagemDAO {
  /**
   * @param {number} id
   * @returns {Vantagem | null}
   */
  findById(id) {
    const db = getDatabase();
    const row = db.prepare(`${SELECT_VANTAGEM_BASE} WHERE v.id = ?`).get(Number(id));
    return Vantagem.fromRow(row);
  }

  /**
   * Lista as vantagens ativas (catálogo do aluno), opcionalmente de uma única empresa.
   * @param {{ empresaId?: number }} [filtro]
   * @returns {Vantagem[]}
   */
  findAtivas({ empresaId } = {}) {
    const db = getDatabase();
    const rows =
      empresaId === undefined || empresaId === null
        ? db.prepare(`${SELECT_VANTAGEM_BASE} WHERE v.ativa = 1 ORDER BY v.id ASC`).all()
        : db
            .prepare(`${SELECT_VANTAGEM_BASE} WHERE v.ativa = 1 AND v.empresa_id = ? ORDER BY v.id ASC`)
            .all(Number(empresaId));
    return rows.map((row) => Vantagem.fromRow(row));
  }

  /**
   * Lista todas as vantagens (ativas e inativas) de uma empresa.
   * @param {number} empresaId
   * @returns {Vantagem[]}
   */
  findByEmpresa(empresaId) {
    const db = getDatabase();
    const rows = db
      .prepare(`${SELECT_VANTAGEM_BASE} WHERE v.empresa_id = ? ORDER BY v.id ASC`)
      .all(Number(empresaId));
    return rows.map((row) => Vantagem.fromRow(row));
  }

  /**
   * @param {{ empresaId: number, nome: string, descricao: string, fotoUrl: string, custoMoedas: number }} dados
   * @returns {Vantagem}
   */
  create({ empresaId, nome, descricao, fotoUrl, custoMoedas }) {
    const novoId = withTransaction((db) => {
      const resultado = db
        .prepare(
          `INSERT INTO vantagens (empresa_id, nome, descricao, foto_url, custo_moedas, ativa)
           VALUES (?, ?, ?, ?, ?, 1)`
        )
        .run(Number(empresaId), nome, descricao, fotoUrl, Number(custoMoedas));
      return Number(resultado.lastInsertRowid);
    });
    return this.findById(novoId);
  }

  /**
   * @returns {Vantagem | null} a vantagem atualizada ou `null` se não existir
   */
  update(id, { nome, descricao, fotoUrl, custoMoedas }) {
    const vantagemId = Number(id);
    const resultado = withTransaction((db) =>
      db
        .prepare(
          `UPDATE vantagens
           SET nome = ?, descricao = ?, foto_url = ?, custo_moedas = ?
           WHERE id = ?`
        )
        .run(nome, descricao, fotoUrl, Number(custoMoedas), vantagemId)
    );
    return Number(resultado.changes) === 1 ? this.findById(vantagemId) : null;
  }

  /**
   * Ativa ou desativa uma vantagem.
   * @returns {Vantagem | null}
   */
  setAtiva(id, ativa) {
    const vantagemId = Number(id);
    const resultado = withTransaction((db) =>
      db.prepare('UPDATE vantagens SET ativa = ? WHERE id = ?').run(ativa ? 1 : 0, vantagemId)
    );
    return Number(resultado.changes) === 1 ? this.findById(vantagemId) : null;
  }

  /**
   * Remove a vantagem. Se houver resgates, a FK `ON DELETE RESTRICT` lança erro SQLite.
   * @returns {boolean}
   */
  delete(id) {
    return withTransaction((db) => {
      const resultado = db.prepare('DELETE FROM vantagens WHERE id = ?').run(Number(id));
      return Number(resultado.changes) > 0;
    });
  }

  /**
   * Quantidade de resgates já realizados da vantagem.
   * @returns {number}
   */
  contarResgates(id) {
    const db = getDatabase();
    const row = db
      .prepare('SELECT COUNT(*) AS total FROM resgates_vantagens WHERE vantagem_id = ?')
      .get(Number(id));
    return Number(row.total);
  }
}
