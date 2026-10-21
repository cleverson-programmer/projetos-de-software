import { UsuarioDAO } from '../dao/UsuarioDAO.js';
import { AlunoDAO } from '../dao/AlunoDAO.js';
import { EmpresaParceiraDAO } from '../dao/EmpresaParceiraDAO.js';

export class AuthService {
  constructor(
    usuarioDAO = new UsuarioDAO(),
    alunoDAO = new AlunoDAO(),
    empresaDAO = new EmpresaParceiraDAO()
  ) {
    this.usuarioDAO = usuarioDAO;
    this.alunoDAO = alunoDAO;
    this.empresaDAO = empresaDAO;
  }

  autenticar(login, senha) {
    if (!login || !senha) {
      const error = new Error('Informe login e senha para autenticar.');
      error.statusCode = 400;
      throw error;
    }

    const usuario = this.usuarioDAO.findByLogin(login.trim());
    if (!usuario || !usuario.autenticar(login.trim(), senha)) {
      const error = new Error('Credenciais inválidas. Verifique seu login e senha.');
      error.statusCode = 401;
      throw error;
    }

    if (usuario.tipo === 'ALUNO') {
      return this.alunoDAO.findById(usuario.id);
    }
    if (usuario.tipo === 'EMPRESA') {
      return this.empresaDAO.findById(usuario.id);
    }

    return usuario;
  }
}

