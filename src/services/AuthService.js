import { getDatabase } from '../config/database.js';
import { ContaDAO } from '../dao/ContaDAO.js';
import { Usuario } from '../models/Usuario.js';
import { fail, login as validateLogin } from '../utils/validation.js';

export class AuthService {
  async autenticar(login, senha) {
    const clean = validateLogin(login);
    if (typeof senha !== 'string' || !senha || senha.length > 128) fail(401, 'Login ou senha inválidos.');
    const { rows } = await getDatabase().query('SELECT id, senha_hash FROM usuarios WHERE lower(login) = $1 AND ativo', [clean]);
    if (!rows.length || !await Usuario.verificarSenha(senha, rows[0].senha_hash)) fail(401, 'Login ou senha inválidos.');
    return new ContaDAO().perfil(rows[0].id);
  }
}
