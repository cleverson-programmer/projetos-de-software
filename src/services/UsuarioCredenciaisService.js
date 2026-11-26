import { UsuarioDAO } from '../dao/UsuarioDAO.js';
import { criarErro } from '../utils/erros.js';
import { emailValido, textoObrigatorio } from '../utils/validacao.js';

/**
 * Fabricação Pura (GRASP: Pure Fabrication) que centraliza a validação
 * e a verificação de unicidade dos atributos comuns de `Usuario`
 * (nome, e-mail, login e senha), evitando duplicação entre serviços especializados.
 */
export class UsuarioCredenciaisService {
  constructor(usuarioDAO = new UsuarioDAO()) {
    this.usuarioDAO = usuarioDAO;
  }

  validarParaCadastro(dados = {}, { labelNome = 'Nome' } = {}) {
    const nome = textoObrigatorio(dados.nome);
    if (nome === null) {
      throw criarErro(400, `O campo "${labelNome}" é obrigatório.`);
    }

    const email = textoObrigatorio(dados.email);
    if (email === null) {
      throw criarErro(400, 'O campo "E-mail" é obrigatório.');
    }

    const login = textoObrigatorio(dados.login);
    if (login === null) {
      throw criarErro(400, 'O campo "Login" é obrigatório.');
    }

    if (typeof dados.senha !== 'string' || dados.senha.trim() === '') {
      throw criarErro(400, 'O campo "Senha" é obrigatório.');
    }

    if (!emailValido(email)) {
      throw criarErro(400, 'E-mail inválido.');
    }

    return { nome, email, login, senha: dados.senha };
  }

  validarParaAtualizacao(usuarioAtual, dados = {}, { labelNome = 'Nome' } = {}) {
    const resultado = {};
    for (const [campo, label] of [
      ['nome', labelNome],
      ['email', 'E-mail'],
      ['login', 'Login'],
    ]) {
      if (dados[campo] !== undefined) {
        const texto = textoObrigatorio(dados[campo]);
        if (texto === null) {
          throw criarErro(400, `O campo "${label}" não pode ficar vazio.`);
        }
        resultado[campo] = texto;
      }
    }

    if (resultado.email !== undefined && resultado.email !== usuarioAtual.email && !emailValido(resultado.email)) {
      throw criarErro(400, 'E-mail inválido.');
    }

    let senha;
    if (dados.senha !== undefined && dados.senha !== null && dados.senha !== '') {
      if (typeof dados.senha !== 'string') {
        throw criarErro(400, 'A senha deve ser um texto.');
      }
      senha = dados.senha.trim() !== '' ? dados.senha : undefined;
    }

    return { ...resultado, senha };
  }

  garantirUnicidade({ email, login, ignorarUsuarioId = null }) {
    if (email !== undefined) {
      const outroEmail = this.usuarioDAO.findByEmail(email);
      if (outroEmail && outroEmail.id !== ignorarUsuarioId) {
        throw criarErro(
          409,
          ignorarUsuarioId
            ? 'Já existe outro usuário cadastrado com este e-mail.'
            : 'Já existe um usuário cadastrado com este e-mail.'
        );
      }
    }

    if (login !== undefined) {
      const outroLogin = this.usuarioDAO.findByLogin(login);
      if (outroLogin && outroLogin.id !== ignorarUsuarioId) {
        throw criarErro(409, 'Este login já está em uso por outro usuário.');
      }
    }
  }
}
