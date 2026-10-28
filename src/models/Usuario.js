import { gerarHashSenha, verificarSenha } from '../utils/senha.js';

/**
 * Superclasse Usuario conforme Diagrama de Classes da Sprint 1.
 * Centraliza dados de autenticação e identificação (id, nome, email, login, senhaHash).
 */
export class Usuario {
  constructor({
    id = null,
    nome,
    email,
    login,
    senhaHash = null,
    tipo,
    createdAt = null,
    updatedAt = null,
  }) {
    this.id = id;
    this.nome = nome;
    this.email = email;
    this.login = login;
    this.senhaHash = senhaHash;
    this.tipo = tipo;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  /**
   * Gera hash seguro da senha em texto puro (PBKDF2 / SHA-256, 600000 iterações).
   */
  static gerarHashSenha(senhaPura) {
    return gerarHashSenha(senhaPura);
  }

  /**
   * Verifica se o login e a senha informados correspondem às credenciais do usuário.
   */
  autenticar(loginInformado, senhaPura) {
    if (this.login !== loginInformado || !this.senhaHash) {
      return false;
    }
    return verificarSenha(senhaPura, this.senhaHash);
  }

  toJSON() {
    return {
      id: this.id,
      nome: this.nome,
      email: this.email,
      login: this.login,
      tipo: this.tipo,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

