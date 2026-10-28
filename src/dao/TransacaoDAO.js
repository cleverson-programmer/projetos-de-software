import { getDatabase, withTransaction } from '../config/database.js';
import { TransferenciaMoedas } from '../models/TransferenciaMoedas.js';
import { CreditoSemestral } from '../models/CreditoSemestral.js';
import { ResgateVantagem } from '../models/ResgateVantagem.js';
import { Vantagem } from '../models/Vantagem.js';
import { criarErro } from '../utils/erros.js';

/** Tentativas de gerar um código de cupom inédito antes de desistir. */
const MAX_TENTATIVAS_CODIGO = 5;

function colisaoDeCodigoCupom(erro) {
  return (
    erro?.code === 'ERR_SQLITE_ERROR' &&
    (erro.errcode === 2067 || erro.errcode === 1555) &&
    String(erro.message).includes('codigo_cupom')
  );
}

function violacaoDeCreditoDuplicado(erro) {
  return (
    erro?.code === 'ERR_SQLITE_ERROR' &&
    (erro.errcode === 2067 || erro.errcode === 1555) &&
    String(erro.message).includes('creditos_semestrais')
  );
}

/** Mais recente primeiro: `dataHora` decrescente e, em empate, `id` decrescente. */
function maisRecentePrimeiro(a, b) {
  if (a.dataHora !== b.dataHora) return a.dataHora < b.dataHora ? 1 : -1;
  return b.id - a.id;
}

/**
 * DAO das transações de moedas (tabelas `transacoes`, `transferencias_moedas`,
 * `creditos_semestrais` e `resgates_vantagens`).
 *
 * Toda escrita é atômica (`withTransaction`). Os saldos são alterados com UPDATE condicional
 * (`saldo >= valor`) e conferência de `changes === 1`; o CHECK (saldo_moedas >= 0) do banco é a
 * última barreira. Nunca use `await` dentro dos callbacks de `withTransaction`.
 */
export class TransacaoDAO {
  /**
   * Envio de moedas de um professor a um aluno: debita o professor, credita o aluno e grava
   * `transacoes` + `transferencias_moedas`.
   * Lança 404 (professor/aluno inexistente) ou 409 ("Saldo insuficiente").
   *
   * @returns {{
   *   transferencia: TransferenciaMoedas,
   *   saldoProfessor: number,
   *   saldoAluno: number,
   *   professor: { id: number, nome: string },
   *   aluno: { id: number, nome: string, email: string }
   * }}
   */
  registrarTransferencia({ professorId, alunoId, quantidade, motivo }) {
    const idProfessor = Number(professorId);
    const idAluno = Number(alunoId);
    const valor = Number(quantidade);

    return withTransaction((db) => {
      const debito = db
        .prepare(
          `UPDATE professores
           SET saldo_moedas = saldo_moedas - ?
           WHERE usuario_id = ? AND saldo_moedas >= ?`
        )
        .run(valor, idProfessor, valor);
      if (Number(debito.changes) !== 1) {
        const existe = db.prepare('SELECT 1 FROM professores WHERE usuario_id = ?').get(idProfessor);
        throw existe ? criarErro(409, 'Saldo insuficiente') : criarErro(404, 'Professor não encontrado.');
      }

      const credito = db
        .prepare('UPDATE alunos SET saldo_moedas = saldo_moedas + ? WHERE usuario_id = ?')
        .run(valor, idAluno);
      if (Number(credito.changes) !== 1) {
        throw criarErro(404, 'Aluno não encontrado.');
      }

      const transacaoId = Number(
        db.prepare("INSERT INTO transacoes (quantidade, tipo) VALUES (?, 'TRANSFERENCIA')").run(valor)
          .lastInsertRowid
      );
      db.prepare(
        'INSERT INTO transferencias_moedas (transacao_id, professor_id, aluno_id, motivo) VALUES (?, ?, ?, ?)'
      ).run(transacaoId, idProfessor, idAluno, motivo);

      const row = db
        .prepare(
          `SELECT
             t.id, t.data_hora, t.quantidade,
             tm.professor_id, tm.aluno_id, tm.motivo,
             up.nome AS professor_nome,
             ua.nome AS aluno_nome, ua.email AS aluno_email,
             p.saldo_moedas AS saldo_professor,
             a.saldo_moedas AS saldo_aluno
           FROM transacoes t
           INNER JOIN transferencias_moedas tm ON tm.transacao_id = t.id
           INNER JOIN usuarios up ON up.id = tm.professor_id
           INNER JOIN usuarios ua ON ua.id = tm.aluno_id
           INNER JOIN professores p ON p.usuario_id = tm.professor_id
           INNER JOIN alunos a ON a.usuario_id = tm.aluno_id
           WHERE t.id = ?`
        )
        .get(transacaoId);

      return {
        transferencia: TransferenciaMoedas.fromRow(row),
        saldoProfessor: Number(row.saldo_professor),
        saldoAluno: Number(row.saldo_aluno),
        professor: { id: idProfessor, nome: row.professor_nome },
        aluno: { id: idAluno, nome: row.aluno_nome, email: row.aluno_email },
      };
    });
  }

  /**
   * Resgate de uma vantagem por um aluno: lê a vantagem e debita o saldo na mesma transação,
   * grava `transacoes` + `resgates_vantagens` com um código de cupom único.
   * Em colisão de `codigo_cupom` (UNIQUE) a transação é desfeita e repetida com um novo código
   * (até 5 tentativas, cada uma em transação própria).
   * Lança 404 (vantagem/aluno inexistente) ou 409 (vantagem inativa / "Saldo insuficiente").
   *
   * @param {{ alunoId: number, vantagemId: number, gerarCodigo?: () => string }} dados
   * @returns {{
   *   resgate: ResgateVantagem,
   *   vantagem: Vantagem,
   *   novoSaldo: number,
   *   aluno: { id: number, nome: string, email: string },
   *   empresa: { id: number, nome: string, email: string }
   * }}
   */
  registrarResgate({ alunoId, vantagemId, gerarCodigo = () => ResgateVantagem.gerarCodigo() }) {
    let ultimoErro = null;

    for (let tentativa = 0; tentativa < MAX_TENTATIVAS_CODIGO; tentativa += 1) {
      const codigo = gerarCodigo();
      try {
        return this.#resgatarUmaVez(Number(alunoId), Number(vantagemId), codigo);
      } catch (erro) {
        if (!colisaoDeCodigoCupom(erro)) throw erro;
        ultimoErro = erro;
      }
    }

    console.error('[Resgate] Não foi possível gerar um código de cupom único:', ultimoErro?.message);
    throw criarErro(500, 'Não foi possível gerar o código do cupom. Tente novamente.');
  }

  #resgatarUmaVez(idAluno, idVantagem, codigo) {
    return withTransaction((db) => {
      const vantagemRow = db
        .prepare(
          `SELECT
             v.id, v.empresa_id, v.nome, v.descricao, v.foto_url, v.custo_moedas, v.ativa, v.created_at,
             ue.nome AS empresa_nome, ue.email AS empresa_email
           FROM vantagens v
           INNER JOIN usuarios ue ON ue.id = v.empresa_id
           WHERE v.id = ?`
        )
        .get(idVantagem);
      if (!vantagemRow) {
        throw criarErro(404, 'Vantagem não encontrada.');
      }
      if (!vantagemRow.ativa) {
        throw criarErro(409, 'Esta vantagem não está mais disponível para resgate.');
      }
      const custo = Number(vantagemRow.custo_moedas);

      const debito = db
        .prepare(
          `UPDATE alunos
           SET saldo_moedas = saldo_moedas - ?
           WHERE usuario_id = ? AND saldo_moedas >= ?`
        )
        .run(custo, idAluno, custo);
      if (Number(debito.changes) !== 1) {
        const existe = db.prepare('SELECT 1 FROM alunos WHERE usuario_id = ?').get(idAluno);
        throw existe ? criarErro(409, 'Saldo insuficiente') : criarErro(404, 'Aluno não encontrado.');
      }

      const transacaoId = Number(
        db.prepare("INSERT INTO transacoes (quantidade, tipo) VALUES (?, 'RESGATE')").run(custo)
          .lastInsertRowid
      );
      db.prepare(
        'INSERT INTO resgates_vantagens (transacao_id, aluno_id, vantagem_id, codigo_cupom) VALUES (?, ?, ?, ?)'
      ).run(transacaoId, idAluno, idVantagem, codigo);

      const row = db
        .prepare(
          `SELECT
             t.id, t.data_hora, t.quantidade,
             rv.aluno_id, rv.vantagem_id, rv.codigo_cupom,
             ua.nome AS aluno_nome, ua.email AS aluno_email,
             a.saldo_moedas AS saldo_aluno
           FROM transacoes t
           INNER JOIN resgates_vantagens rv ON rv.transacao_id = t.id
           INNER JOIN usuarios ua ON ua.id = rv.aluno_id
           INNER JOIN alunos a ON a.usuario_id = rv.aluno_id
           WHERE t.id = ?`
        )
        .get(transacaoId);

      const resgate = ResgateVantagem.fromRow({
        ...row,
        vantagem_nome: vantagemRow.nome,
        empresa_nome: vantagemRow.empresa_nome,
      });

      return {
        resgate,
        vantagem: Vantagem.fromRow(vantagemRow),
        novoSaldo: Number(row.saldo_aluno),
        aluno: { id: idAluno, nome: row.aluno_nome, email: row.aluno_email },
        empresa: {
          id: Number(vantagemRow.empresa_id),
          nome: vantagemRow.empresa_nome,
          email: vantagemRow.empresa_email,
        },
      };
    });
  }

  /**
   * Crédito semestral de um professor, no máximo um por (professor, semestre).
   * Pré-checa a existência; a UNIQUE(professor_id, semestre) é a segunda barreira (corrida).
   * O valor é somado ao saldo corrente (acumulativo).
   *
   * @returns {{ credito: CreditoSemestral, saldoMoedas: number } | null} `null` se já creditado
   */
  registrarCredito({ professorId, semestre, quantidade }) {
    const idProfessor = Number(professorId);
    const valor = Number(quantidade);

    try {
      return withTransaction((db) => {
        const jaCreditado = db
          .prepare('SELECT 1 FROM creditos_semestrais WHERE professor_id = ? AND semestre = ?')
          .get(idProfessor, semestre);
        if (jaCreditado) return null;

        if (!db.prepare('SELECT 1 FROM professores WHERE usuario_id = ?').get(idProfessor)) {
          throw criarErro(404, 'Professor não encontrado.');
        }

        const transacaoId = Number(
          db.prepare("INSERT INTO transacoes (quantidade, tipo) VALUES (?, 'CREDITO')").run(valor)
            .lastInsertRowid
        );
        db.prepare(
          'INSERT INTO creditos_semestrais (transacao_id, professor_id, semestre) VALUES (?, ?, ?)'
        ).run(transacaoId, idProfessor, semestre);

        db.prepare('UPDATE professores SET saldo_moedas = saldo_moedas + ? WHERE usuario_id = ?').run(
          valor,
          idProfessor
        );

        const row = db
          .prepare(
            `SELECT t.id, t.data_hora, t.quantidade, cs.professor_id, cs.semestre,
                    p.saldo_moedas AS saldo_professor
             FROM transacoes t
             INNER JOIN creditos_semestrais cs ON cs.transacao_id = t.id
             INNER JOIN professores p ON p.usuario_id = cs.professor_id
             WHERE t.id = ?`
          )
          .get(transacaoId);

        return { credito: CreditoSemestral.fromRow(row), saldoMoedas: Number(row.saldo_professor) };
      });
    } catch (erro) {
      if (violacaoDeCreditoDuplicado(erro)) return null;
      throw erro;
    }
  }

  /**
   * Extrato do professor: envios de moedas e créditos semestrais, mais recentes primeiro.
   * @returns {(TransferenciaMoedas | CreditoSemestral)[]}
   */
  buscarExtratoProfessor(professorId) {
    const db = getDatabase();
    const id = Number(professorId);

    const envios = db
      .prepare(
        `SELECT t.id, t.data_hora, t.quantidade, tm.aluno_id, tm.motivo, ua.nome AS aluno_nome
         FROM transferencias_moedas tm
         INNER JOIN transacoes t ON t.id = tm.transacao_id
         INNER JOIN usuarios ua ON ua.id = tm.aluno_id
         WHERE tm.professor_id = ?`
      )
      .all(id)
      .map((row) => TransferenciaMoedas.fromRow(row));

    const creditos = db
      .prepare(
        `SELECT t.id, t.data_hora, t.quantidade, cs.semestre
         FROM creditos_semestrais cs
         INNER JOIN transacoes t ON t.id = cs.transacao_id
         WHERE cs.professor_id = ?`
      )
      .all(id)
      .map((row) => CreditoSemestral.fromRow(row));

    return [...envios, ...creditos].sort(maisRecentePrimeiro);
  }

  /**
   * Extrato do aluno: moedas recebidas e resgates, mais recentes primeiro.
   * @returns {(TransferenciaMoedas | ResgateVantagem)[]}
   */
  buscarExtratoAluno(alunoId) {
    const db = getDatabase();
    const id = Number(alunoId);

    const recebimentos = db
      .prepare(
        `SELECT t.id, t.data_hora, t.quantidade, tm.motivo, up.nome AS professor_nome
         FROM transferencias_moedas tm
         INNER JOIN transacoes t ON t.id = tm.transacao_id
         INNER JOIN usuarios up ON up.id = tm.professor_id
         WHERE tm.aluno_id = ?`
      )
      .all(id)
      .map((row) => TransferenciaMoedas.fromRow(row));

    const resgates = db
      .prepare(
        `SELECT t.id, t.data_hora, t.quantidade, rv.vantagem_id, rv.codigo_cupom,
                v.nome AS vantagem_nome, ue.nome AS empresa_nome
         FROM resgates_vantagens rv
         INNER JOIN transacoes t ON t.id = rv.transacao_id
         INNER JOIN vantagens v ON v.id = rv.vantagem_id
         INNER JOIN usuarios ue ON ue.id = v.empresa_id
         WHERE rv.aluno_id = ?`
      )
      .all(id)
      .map((row) => ResgateVantagem.fromRow(row));

    return [...recebimentos, ...resgates].sort(maisRecentePrimeiro);
  }

  /**
   * Resgates das vantagens de uma empresa (lista de conferência), mais recentes primeiro.
   * @returns {ResgateVantagem[]}
   */
  buscarResgatesDaEmpresa(empresaId) {
    const db = getDatabase();
    return db
      .prepare(
        `SELECT t.id, t.data_hora, t.quantidade, rv.vantagem_id, rv.codigo_cupom,
                v.nome AS vantagem_nome, ua.nome AS aluno_nome
         FROM resgates_vantagens rv
         INNER JOIN transacoes t ON t.id = rv.transacao_id
         INNER JOIN vantagens v ON v.id = rv.vantagem_id
         INNER JOIN usuarios ua ON ua.id = rv.aluno_id
         WHERE v.empresa_id = ?`
      )
      .all(Number(empresaId))
      .map((row) => ResgateVantagem.fromRow(row))
      .sort(maisRecentePrimeiro);
  }
}
