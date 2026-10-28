import { EmpresaParceiraDAO } from '../dao/EmpresaParceiraDAO.js';
import { UsuarioDAO } from '../dao/UsuarioDAO.js';
import { criarErro } from '../utils/erros.js';
import { normalizarCnpj, somenteDigitos } from '../utils/documentos.js';
import { emailValido, textoObrigatorio } from '../utils/validacao.js';

export class EmpresaParceiraService {
  constructor(
    empresaDAO = new EmpresaParceiraDAO(),
    usuarioDAO = new UsuarioDAO()
  ) {
    this.empresaDAO = empresaDAO;
    this.usuarioDAO = usuarioDAO;
  }

  buscarPorId(id) {
    const empresa = this.empresaDAO.findById(id);
    if (!empresa) {
      throw criarErro(404, 'Empresa parceira não encontrada.');
    }
    return empresa;
  }

  cadastrarEmpresa(dados = {}) {
    const camposObrigatorios = [
      { campo: 'nome', label: 'Nome / Razão Social' },
      { campo: 'email', label: 'E-mail' },
      { campo: 'login', label: 'Login' },
      { campo: 'cnpj', label: 'CNPJ' },
    ];

    const limpos = {};
    for (const { campo, label } of camposObrigatorios) {
      const texto = textoObrigatorio(dados[campo]);
      if (texto === null) {
        throw criarErro(400, `O campo "${label}" é obrigatório.`);
      }
      limpos[campo] = texto;
    }

    if (typeof dados.senha !== 'string' || dados.senha.trim() === '') {
      throw criarErro(400, 'O campo "Senha" é obrigatório.');
    }

    if (!emailValido(limpos.email)) {
      throw criarErro(400, 'E-mail inválido.');
    }

    const cnpj = normalizarCnpj(limpos.cnpj);
    if (cnpj === null) {
      throw criarErro(400, 'CNPJ inválido.');
    }

    if (dados.descricao !== undefined && dados.descricao !== null && typeof dados.descricao !== 'string') {
      throw criarErro(400, 'A descrição deve ser um texto.');
    }

    if (this.usuarioDAO.findByEmail(limpos.email)) {
      throw criarErro(409, 'Já existe um usuário cadastrado com este e-mail.');
    }

    if (this.usuarioDAO.findByLogin(limpos.login)) {
      throw criarErro(409, 'Este login já está em uso por outro usuário.');
    }

    if (this.empresaDAO.findByCnpj(cnpj)) {
      throw criarErro(409, 'Já existe uma empresa parceira cadastrada com este CNPJ.');
    }

    return this.empresaDAO.create({
      nome: limpos.nome,
      email: limpos.email,
      login: limpos.login,
      senha: dados.senha,
      cnpj,
      descricao: dados.descricao ? dados.descricao.trim() : null,
    });
  }

  atualizarEmpresa(id, dados = {}) {
    const empresaAtual = this.buscarPorId(id);

    const textos = {};
    for (const [campo, label] of [
      ['nome', 'Nome / Razão Social'],
      ['email', 'E-mail'],
      ['login', 'Login'],
    ]) {
      if (dados[campo] !== undefined) {
        const texto = textoObrigatorio(dados[campo]);
        if (texto === null) {
          throw criarErro(400, `O campo "${label}" não pode ficar vazio.`);
        }
        textos[campo] = texto;
      }
    }

    if (textos.email !== undefined && textos.email !== empresaAtual.email && !emailValido(textos.email)) {
      throw criarErro(400, 'E-mail inválido.');
    }

    let senha;
    if (dados.senha !== undefined && dados.senha !== null && dados.senha !== '') {
      if (typeof dados.senha !== 'string') {
        throw criarErro(400, 'A senha deve ser um texto.');
      }
      senha = dados.senha.trim() !== '' ? dados.senha : undefined;
    }

    let descricao;
    if (dados.descricao !== undefined) {
      if (dados.descricao !== null && typeof dados.descricao !== 'string') {
        throw criarErro(400, 'A descrição deve ser um texto.');
      }
      descricao = dados.descricao ? dados.descricao.trim() : '';
    }

    if (textos.email !== undefined && textos.email !== empresaAtual.email) {
      const outroEmail = this.usuarioDAO.findByEmail(textos.email);
      if (outroEmail && outroEmail.id !== empresaAtual.id) {
        throw criarErro(409, 'Já existe outro usuário cadastrado com este e-mail.');
      }
    }

    if (textos.login !== undefined && textos.login !== empresaAtual.login) {
      const outroLogin = this.usuarioDAO.findByLogin(textos.login);
      if (outroLogin && outroLogin.id !== empresaAtual.id) {
        throw criarErro(409, 'Este login já está em uso por outro usuário.');
      }
    }

    // CNPJ só é validado/alterado se mudou (contas seed antigas continuam editáveis).
    let cnpj;
    if (dados.cnpj !== undefined) {
      if (typeof dados.cnpj !== 'string') {
        throw criarErro(400, 'CNPJ inválido.');
      }
      if (somenteDigitos(dados.cnpj) !== somenteDigitos(empresaAtual.cnpj)) {
        cnpj = normalizarCnpj(dados.cnpj);
        if (cnpj === null) {
          throw criarErro(400, 'CNPJ inválido.');
        }
        const outroCnpj = this.empresaDAO.findByCnpj(cnpj);
        if (outroCnpj && outroCnpj.id !== empresaAtual.id) {
          throw criarErro(409, 'Já existe outra empresa parceira cadastrada com este CNPJ.');
        }
      }
    }

    return this.empresaDAO.update(empresaAtual.id, {
      nome: textos.nome,
      email: textos.email,
      login: textos.login,
      senha,
      cnpj,
      descricao,
    });
  }

  excluirEmpresa(id) {
    this.buscarPorId(id);
    if (this.empresaDAO.possuiVantagemComResgate(id)) {
      throw criarErro(
        409,
        'Não é possível excluir a conta: a empresa possui vantagens já resgatadas por alunos.'
      );
    }
    return this.empresaDAO.delete(id);
  }
}
