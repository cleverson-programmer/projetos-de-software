import crypto from 'node:crypto';
import { ProfessorDAO } from '../dao/ProfessorDAO.js';
import { UsuarioDAO } from '../dao/UsuarioDAO.js';
import { InstituicaoEnsinoDAO } from '../dao/InstituicaoEnsinoDAO.js';
import { criarErro, traduzirErroBanco } from '../utils/erros.js';
import { normalizarCpf } from '../utils/documentos.js';
import { emailValido, inteiroPositivo, textoObrigatorio } from '../utils/validacao.js';

export class ProfessorService {
  constructor(
    professorDAO = new ProfessorDAO(),
    usuarioDAO = new UsuarioDAO(),
    instituicaoDAO = new InstituicaoEnsinoDAO()
  ) {
    this.professorDAO = professorDAO;
    this.usuarioDAO = usuarioDAO;
    this.instituicaoDAO = instituicaoDAO;
  }

  listarProfessores() {
    return this.professorDAO.findAll();
  }

  buscarPorId(id) {
    const professor = this.professorDAO.findById(id);
    if (!professor) {
      throw criarErro(404, 'Professor não encontrado.');
    }
    return professor;
  }

  /**
   * Cadastra um professor (pré-cadastro enviado pela instituição).
   * Se a senha não for informada, gera uma senha inicial aleatória.
   * @returns {{ professor: import('../models/Professor.js').Professor, senhaInicial: string }}
   */
  cadastrarProfessor(dados = {}) {
    const campos = [
      { campo: 'nome', label: 'Nome' },
      { campo: 'email', label: 'E-mail' },
      { campo: 'login', label: 'Login' },
      { campo: 'cpf', label: 'CPF' },
      { campo: 'departamento', label: 'Departamento' },
    ];

    const limpos = {};
    for (const { campo, label } of campos) {
      const texto = textoObrigatorio(dados[campo]);
      if (texto === null) {
        throw criarErro(400, `O campo "${label}" é obrigatório.`);
      }
      limpos[campo] = texto;
    }

    if (!emailValido(limpos.email)) {
      throw criarErro(400, 'E-mail inválido.');
    }

    const cpf = normalizarCpf(limpos.cpf);
    if (cpf === null) {
      throw criarErro(400, 'CPF inválido.');
    }

    const instituicaoId = inteiroPositivo(dados.instituicaoId);
    if (instituicaoId === null || !this.instituicaoDAO.findById(instituicaoId)) {
      throw criarErro(400, 'A Instituição de Ensino informada não está cadastrada.');
    }

    let senhaInicial = dados.senha;
    if (senhaInicial === undefined || senhaInicial === null || senhaInicial === '') {
      senhaInicial = crypto.randomBytes(9).toString('base64url');
    } else if (typeof senhaInicial !== 'string') {
      throw criarErro(400, 'A senha deve ser um texto.');
    }

    if (this.usuarioDAO.findByEmail(limpos.email)) {
      throw criarErro(409, 'Já existe um usuário cadastrado com este e-mail.');
    }
    if (this.usuarioDAO.findByLogin(limpos.login)) {
      throw criarErro(409, 'Este login já está em uso por outro usuário.');
    }
    if (this.professorDAO.findByCpf(cpf)) {
      throw criarErro(409, 'Já existe um professor cadastrado com este CPF.');
    }

    const professor = this.professorDAO.create({
      nome: limpos.nome,
      email: limpos.email,
      login: limpos.login,
      senha: senhaInicial,
      cpf,
      departamento: limpos.departamento,
      instituicaoId,
    });

    return { professor, senhaInicial };
  }

  /**
   * Importa uma lista de professores. Um item inválido não impede os demais.
   * @param {object[]} lista
   * @returns {{ indice: number, ok: boolean, login?: string, professor?: object, senhaInicial?: string, erro?: string }[]}
   */
  importarProfessores(lista) {
    if (!Array.isArray(lista)) {
      throw criarErro(400, 'A lista de professores deve ser um array.');
    }

    return lista.map((item, indice) => {
      const login = item && typeof item.login === 'string' ? item.login : undefined;
      try {
        const { professor, senhaInicial } = this.cadastrarProfessor(item ?? {});
        return { indice, ok: true, login: professor.login, professor, senhaInicial };
      } catch (error) {
        const tratado = error.statusCode ? error : traduzirErroBanco(error);
        if (!tratado) throw error;
        return { indice, ok: false, login, erro: tratado.message };
      }
    });
  }
}
