import { getDatabase } from '../config/database.js';

export class ContaDAO {
  async perfil(id, client = getDatabase()) {
    const { rows } = await client.query(
      'SELECT u.id, u.nome, u.email, u.login, u.tipo, a.cpf AS aluno_cpf, a.rg, a.endereco, a.curso, a.saldo_moedas AS aluno_saldo, p.cpf AS professor_cpf, p.departamento, p.saldo_moedas AS professor_saldo, e.cnpj, e.descricao, COALESCE(a.instituicao_id, p.instituicao_id) AS instituicao_id, i.nome AS instituicao_nome, i.endereco AS instituicao_endereco FROM usuarios u LEFT JOIN alunos a ON a.usuario_id = u.id LEFT JOIN professores p ON p.usuario_id = u.id LEFT JOIN empresas_parceiras e ON e.usuario_id = u.id LEFT JOIN instituicoes_ensino i ON i.id = COALESCE(a.instituicao_id, p.instituicao_id) WHERE u.id = $1 AND u.ativo',
      [id]
    );
    const row = rows[0];
    if (!row) return null;
    const result = { id: Number(row.id), nome: row.nome, email: row.email, login: row.login, tipo: row.tipo };
    if (row.tipo === 'EMPRESA') return { ...result, cnpj: row.cnpj, descricao: row.descricao || '' };
    result.instituicaoId = Number(row.instituicao_id);
    result.instituicao = { id: Number(row.instituicao_id), nome: row.instituicao_nome, endereco: row.instituicao_endereco };
    if (row.tipo === 'PROFESSOR') return { ...result, cpf: row.professor_cpf, departamento: row.departamento, saldoMoedas: row.professor_saldo };
    return { ...result, cpf: row.aluno_cpf, rg: row.rg, endereco: row.endereco, curso: row.curso, saldoMoedas: row.aluno_saldo, cadastroCompleto: Boolean(row.rg && row.rg.trim().length >= 4) };
  }
}
