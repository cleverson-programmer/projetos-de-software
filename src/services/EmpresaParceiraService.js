import { EmpresaParceiraDAO } from '../dao/EmpresaParceiraDAO.js';
import { UsuarioDAO } from '../dao/UsuarioDAO.js';
import { UsuarioCredenciaisService } from './UsuarioCredenciaisService.js';
import { criarErro } from '../utils/erros.js';
import { normalizarCnpj, somenteDigitos } from '../utils/documentos.js';
import { textoObrigatorio } from '../utils/validacao.js';

export class EmpresaParceiraService {
  constructor(
    empresaDAO = new EmpresaParceiraDAO(),
    usuarioDAO = new UsuarioDAO(),
    credenciaisService = new UsuarioCredenciaisService(usuarioDAO)
  ) {
    this.empresaDAO = empresaDAO;
    this.usuarioDAO = usuarioDAO;
    this.credenciaisService = credenciaisService;
  }

  buscarPorId(id) {
    const empresa = this.empresaDAO.findById(id);
    if (!empresa) {
      throw criarErro(404, 'Empresa parceira não encontrada.');
    }
    return empresa;
  }

  cadastrarEmpresa(dados = {}) {
    const base = this.credenciaisService.validarParaCadastro(dados, { labelNome: 'Nome / Razão Social' });

    const cnpjLimpo = textoObrigatorio(dados.cnpj);
    if (cnpjLimpo === null) {
      throw criarErro(400, 'O campo "CNPJ" é obrigatório.');
    }

    const cnpj = normalizarCnpj(cnpjLimpo);
    if (cnpj === null) {
      throw criarErro(400, 'CNPJ inválido.');
    }

    if (dados.descricao !== undefined && dados.descricao !== null && typeof dados.descricao !== 'string') {
      throw criarErro(400, 'A descrição deve ser um texto.');
    }

    this.credenciaisService.garantirUnicidade({ email: base.email, login: base.login });

    if (this.empresaDAO.findByCnpj(cnpj)) {
      throw criarErro(409, 'Já existe uma empresa parceira cadastrada com este CNPJ.');
    }

    return this.empresaDAO.create({
      nome: base.nome,
      email: base.email,
      login: base.login,
      senha: base.senha,
      cnpj,
      descricao: dados.descricao ? dados.descricao.trim() : null,
    });
  }

  atualizarEmpresa(id, dados = {}) {
    const empresaAtual = this.buscarPorId(id);
    const base = this.credenciaisService.validarParaAtualizacao(empresaAtual, dados, {
      labelNome: 'Nome / Razão Social',
    });

    let descricao;
    if (dados.descricao !== undefined) {
      if (dados.descricao !== null && typeof dados.descricao !== 'string') {
        throw criarErro(400, 'A descrição deve ser um texto.');
      }
      descricao = dados.descricao ? dados.descricao.trim() : '';
    }

    this.credenciaisService.garantirUnicidade({
      email: base.email !== undefined && base.email !== empresaAtual.email ? base.email : undefined,
      login: base.login !== undefined && base.login !== empresaAtual.login ? base.login : undefined,
      ignorarUsuarioId: empresaAtual.id,
    });

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
      nome: base.nome,
      email: base.email,
      login: base.login,
      senha: base.senha,
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
