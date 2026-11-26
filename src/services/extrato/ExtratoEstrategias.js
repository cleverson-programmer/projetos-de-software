import { criarErro } from '../../utils/erros.js';

/**
 * Estratégias polimórficas de geração de extrato por perfil de usuário (GRASP: Polymorphism).
 * Cada perfil implementa a mesma interface `gerar(usuarioId)`.
 */
export function criarEstrategiasExtrato({ transacaoDAO, professorDAO, alunoDAO, empresaDAO }) {
  return {
    PROFESSOR: {
      gerar(usuarioId) {
        const professor = professorDAO.findById(usuarioId);
        if (!professor) throw criarErro(404, 'Professor não encontrado.');
        professor.transacoes = transacaoDAO.buscarExtratoProfessor(professor.id);
        return { tipo: 'PROFESSOR', ...professor.consultarExtrato() };
      },
    },
    ALUNO: {
      gerar(usuarioId) {
        const aluno = alunoDAO.findById(usuarioId);
        if (!aluno) throw criarErro(404, 'Aluno não encontrado.');
        aluno.transacoes = transacaoDAO.buscarExtratoAluno(aluno.id);
        return { tipo: 'ALUNO', ...aluno.consultarExtrato() };
      },
    },
    EMPRESA: {
      gerar(usuarioId) {
        const empresa = empresaDAO.findById(usuarioId);
        if (!empresa) throw criarErro(404, 'Empresa parceira não encontrada.');
        return { tipo: 'EMPRESA', transacoes: transacaoDAO.buscarResgatesDaEmpresa(empresa.id) };
      },
    },
  };
}
