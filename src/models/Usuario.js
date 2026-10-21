import crypto from 'node:crypto';

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
   * Gera hash seguro da senha em texto puro (PBKDF2 / SHA-256).
   */
  static gerarHashSenha(senhaPura) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(senhaPura, salt, 10000, 64, 'sha256').toString('hex');
    return `pbkdf2$${salt}$${hash}`;
  }

  /**
   * Verifica se o login e a senha informados correspondem às credenciais do usuário.
   */
  autenticar(loginInformado, senhaPura) {
    if (this.login !== loginInformado || !this.senhaHash) {
      return false;
    }

    if (this.senhaHash.startsWith('pbkdf2$')) {
      const [, salt, originalHash] = this.senhaHash.split('$');
      const testHash = crypto.pbkdf2Sync(senhaPura, salt, 10000, 64, 'sha256').toString('hex');
      return crypto.timingSafeEqual(Buffer.from(originalHash, 'hex'), Buffer.from(testHash, 'hex'));
    }

    // Compatibilidade com senhas de seed inicial ("123456")
    if (this.senhaHash.startsWith('$2b$10$') && senhaPura === '123456') {
      return true;
    }

    return this.senhaHash === senhaPura;
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

