import { EmpresaParceiraDAO } from '../dao/EmpresaParceiraDAO.js';
import { UsuarioDAO } from '../dao/UsuarioDAO.js';

export class EmpresaParceiraService {
  constructor(
    empresaDAO = new EmpresaParceiraDAO(),
    usuarioDAO = new UsuarioDAO()
  ) {
    this.empresaDAO = empresaDAO;
    this.usuarioDAO = usuarioDAO;
  }

  listarEmpresas() {
    return this.empresaDAO.findAll();
  }

  buscarPorId(id) {
    const empresa = this.empresaDAO.findById(id);
    if (!empresa) {
      const error = new Error('Empresa parceira não encontrada.');
      error.statusCode = 404;
      throw error;
    }
    return empresa;
  }

  cadastrarEmpresa(dados) {
    const camposObrigatorios = [
      { campo: 'nome', label: 'Nome / Razão Social' },
      { campo: 'email', label: 'E-mail' },
      { campo: 'login', label: 'Login' },
      { campo: 'senha', label: 'Senha' },
      { campo: 'cnpj', label: 'CNPJ' },
    ];

    for (const { campo, label } of camposObrigatorios) {
      if (dados[campo] === undefined || dados[campo] === null || String(dados[campo]).trim() === '') {
        const error = new Error(`O campo "${label}" é obrigatório.`);
        error.statusCode = 400;
        throw error;
      }
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

    if (this.empresaDAO.findByCnpj(dados.cnpj.trim())) {
      const error = new Error('Já existe uma empresa parceira cadastrada com este CNPJ.');
      error.statusCode = 409;
      throw error;
    }

    return this.empresaDAO.create({
      nome: dados.nome.trim(),
      email: dados.email.trim(),
      login: dados.login.trim(),
      senha: dados.senha,
      cnpj: dados.cnpj.trim(),
      descricao: dados.descricao ? dados.descricao.trim() : null,
    });
  }

  atualizarEmpresa(id, dados) {
    const empresaAtual = this.buscarPorId(id);

    if (dados.email && dados.email.trim() !== empresaAtual.email) {
      const outroEmail = this.usuarioDAO.findByEmail(dados.email.trim());
      if (outroEmail && outroEmail.id !== empresaAtual.id) {
        const error = new Error('Já existe outro usuário cadastrado com este e-mail.');
        error.statusCode = 409;
        throw error;
      }
    }

    if (dados.login && dados.login.trim() !== empresaAtual.login) {
      const outroLogin = this.usuarioDAO.findByLogin(dados.login.trim());
      if (outroLogin && outroLogin.id !== empresaAtual.id) {
        const error = new Error('Este login já está em uso por outro usuário.');
        error.statusCode = 409;
        throw error;
      }
    }

    if (dados.cnpj && dados.cnpj.trim() !== empresaAtual.cnpj) {
      const outroCnpj = this.empresaDAO.findByCnpj(dados.cnpj.trim());
      if (outroCnpj && outroCnpj.id !== empresaAtual.id) {
        const error = new Error('Já existe outra empresa parceira cadastrada com este CNPJ.');
        error.statusCode = 409;
        throw error;
      }
    }

    return this.empresaDAO.update(empresaAtual.id, {
      nome: dados.nome !== undefined ? dados.nome.trim() : undefined,
      email: dados.email !== undefined ? dados.email.trim() : undefined,
      login: dados.login !== undefined ? dados.login.trim() : undefined,
      senha: dados.senha && String(dados.senha).trim() !== '' ? dados.senha : undefined,
      cnpj: dados.cnpj !== undefined ? dados.cnpj.trim() : undefined,
      descricao: dados.descricao !== undefined ? dados.descricao.trim() : undefined,
    });
  }

  excluirEmpresa(id) {
    this.buscarPorId(id);
    return this.empresaDAO.delete(id);
  }
}

