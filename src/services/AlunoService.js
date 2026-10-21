import { AlunoDAO } from '../dao/AlunoDAO.js';
import { UsuarioDAO } from '../dao/UsuarioDAO.js';
import { InstituicaoEnsinoDAO } from '../dao/InstituicaoEnsinoDAO.js';

export class AlunoService {
  constructor(
    alunoDAO = new AlunoDAO(),
    usuarioDAO = new UsuarioDAO(),
    instituicaoDAO = new InstituicaoEnsinoDAO()
  ) {
    this.alunoDAO = alunoDAO;
    this.usuarioDAO = usuarioDAO;
    this.instituicaoDAO = instituicaoDAO;
  }

  listarAlunos() {
    return this.alunoDAO.findAll();
  }

  buscarPorId(id) {
    const aluno = this.alunoDAO.findById(id);
    if (!aluno) {
      const error = new Error('Aluno não encontrado.');
      error.statusCode = 404;
      throw error;
    }
    return aluno;
  }

  cadastrarAluno(dados) {
    const camposObrigatorios = [
      { campo: 'nome', label: 'Nome' },
      { campo: 'email', label: 'E-mail' },
      { campo: 'login', label: 'Login' },
      { campo: 'senha', label: 'Senha' },
      { campo: 'cpf', label: 'CPF' },
      { campo: 'endereco', label: 'Endereço' },
      { campo: 'curso', label: 'Curso' },
      { campo: 'instituicaoId', label: 'Instituição de Ensino' },
    ];

    for (const { campo, label } of camposObrigatorios) {
      if (dados[campo] === undefined || dados[campo] === null || String(dados[campo]).trim() === '') {
        const error = new Error(`O campo "${label}" é obrigatório.`);
        error.statusCode = 400;
        throw error;
      }
    }

    const rgLimpo = dados.rg ? String(dados.rg).trim() : null;
    if (rgLimpo && !/^[A-Z]{2}-\d{2}\.\d{3}\.\d{3}$/.test(rgLimpo)) {
      const error = new Error('O RG deve seguir o formato XX-99.999.999 (duas letras maiúsculas e oito números).');
      error.statusCode = 400;
      throw error;
    }

    const instituicao = this.instituicaoDAO.findById(dados.instituicaoId);
    if (!instituicao) {
      const error = new Error('A Instituição de Ensino selecionada não está cadastrada.');
      error.statusCode = 400;
      throw error;
    }

    if (this.usuarioDAO.findByEmail(dados.email.trim())) {
      const error = new Error('Já existe um usuário cadastrado com este e-mail.');
      error.statusCode = 409;
      throw error;
    }

    if (this.usuarioDAO.findByLogin(dados.login.trim())) {
      const error = new Error('Este login já está em uso por outro usuário.');
      error.statusCode = 409;
      throw error;
    }

    if (this.alunoDAO.findByCpf(dados.cpf.trim())) {
      const error = new Error('Já existe um aluno cadastrado com este CPF.');
      error.statusCode = 409;
      throw error;
    }

    return this.alunoDAO.create({
      nome: dados.nome.trim(),
      email: dados.email.trim(),
      login: dados.login.trim(),
      senha: dados.senha,
      cpf: dados.cpf.trim(),
      rg: rgLimpo,
      endereco: dados.endereco.trim(),
      curso: dados.curso.trim(),
      instituicaoId: Number(dados.instituicaoId),
    });
  }

  atualizarAluno(id, dados) {
    const alunoAtual = this.buscarPorId(id);

    if (dados.rg !== undefined) {
      const rgLimpo = dados.rg ? String(dados.rg).trim() : '';
      if (rgLimpo !== '' && !/^[A-Z]{2}-\d{2}\.\d{3}\.\d{3}$/.test(rgLimpo)) {
        const error = new Error('O RG deve seguir o formato XX-99.999.999 (duas letras maiúsculas e oito números).');
        error.statusCode = 400;
        throw error;
      }
    }

    if (dados.instituicaoId !== undefined) {
      const instituicao = this.instituicaoDAO.findById(dados.instituicaoId);
      if (!instituicao) {
        const error = new Error('A Instituição de Ensino selecionada não está cadastrada.');
        error.statusCode = 400;
        throw error;
      }
    }

    if (dados.email && dados.email.trim() !== alunoAtual.email) {
      const outroEmail = this.usuarioDAO.findByEmail(dados.email.trim());
      if (outroEmail && outroEmail.id !== alunoAtual.id) {
        const error = new Error('Já existe outro usuário cadastrado com este e-mail.');
        error.statusCode = 409;
        throw error;
      }
    }

    if (dados.login && dados.login.trim() !== alunoAtual.login) {
      const outroLogin = this.usuarioDAO.findByLogin(dados.login.trim());
      if (outroLogin && outroLogin.id !== alunoAtual.id) {
        const error = new Error('Este login já está em uso por outro usuário.');
        error.statusCode = 409;
        throw error;
      }
    }

    if (dados.cpf && dados.cpf.trim() !== alunoAtual.cpf) {
      const outroCpf = this.alunoDAO.findByCpf(dados.cpf.trim());
      if (outroCpf && outroCpf.id !== alunoAtual.id) {
        const error = new Error('Já existe outro aluno cadastrado com este CPF.');
        error.statusCode = 409;
        throw error;
      }
    }

    return this.alunoDAO.update(alunoAtual.id, {
      nome: dados.nome !== undefined ? dados.nome.trim() : undefined,
      email: dados.email !== undefined ? dados.email.trim() : undefined,
      login: dados.login !== undefined ? dados.login.trim() : undefined,
      senha: dados.senha && String(dados.senha).trim() !== '' ? dados.senha : undefined,
      cpf: dados.cpf !== undefined ? dados.cpf.trim() : undefined,
      rg: dados.rg !== undefined ? (dados.rg.trim() || null) : undefined,
      endereco: dados.endereco !== undefined ? dados.endereco.trim() : undefined,
      curso: dados.curso !== undefined ? dados.curso.trim() : undefined,
      instituicaoId: dados.instituicaoId !== undefined ? Number(dados.instituicaoId) : undefined,
    });
  }

  excluirAluno(id) {
    this.buscarPorId(id);
    return this.alunoDAO.delete(id);
  }
}

