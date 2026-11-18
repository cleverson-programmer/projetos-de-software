import crypto from 'node:crypto';
import { promisify } from 'node:util';
import bcrypt from 'bcryptjs';

const scrypt = promisify(crypto.scrypt);
const pbkdf2 = promisify(crypto.pbkdf2);

export class Usuario {
  constructor({ id = null, nome, email, login, senhaHash = null, tipo, createdAt = null, updatedAt = null }) {
    Object.assign(this, { id: id === null ? null : Number(id), nome, email, login, senhaHash, tipo, createdAt, updatedAt });
  }

  static gerarHashSenha(senha) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(senha, salt, 64).toString('hex');
    return 'scrypt$' + salt + '$' + hash;
  }

  static async verificarSenha(senha, stored) {
    if (typeof senha !== 'string' || senha.length > 128 || typeof stored !== 'string') return false;
    if (/^\$2[aby]\$/.test(stored)) {
      try { return await bcrypt.compare(senha, stored); } catch { return false; }
    }
    const [algorithm, salt, expected] = stored.split('$');
    if (!['scrypt', 'pbkdf2'].includes(algorithm) || !/^[a-f0-9]{32}$/.test(salt || '') || !/^[a-f0-9]{128}$/.test(expected || '')) return false;
    const actual = algorithm === 'scrypt'
      ? await scrypt(senha, salt, 64)
      : await pbkdf2(senha, salt, 10000, 64, 'sha256');
    return crypto.timingSafeEqual(actual, Buffer.from(expected, 'hex'));
  }

  async autenticar(login, senha) {
    return this.login === login && await Usuario.verificarSenha(senha, this.senhaHash);
  }

  toJSON() {
    return { id: this.id, nome: this.nome, email: this.email, login: this.login, tipo: this.tipo, createdAt: this.createdAt, updatedAt: this.updatedAt };
  }
}
