import { UsuarioDAO } from '../dao/UsuarioDAO.js';
import { AlunoDAO } from '../dao/AlunoDAO.js';
import { ProfessorDAO } from '../dao/ProfessorDAO.js';
import { EmpresaParceiraDAO } from '../dao/EmpresaParceiraDAO.js';
import { criarErro } from '../utils/erros.js';
import { consumirTempoDeHash } from '../utils/senha.js';

export class AuthService {
  constructor(
    usuarioDAO = new UsuarioDAO(),
    alunoDAO = new AlunoDAO(),
    empresaDAO = new EmpresaParceiraDAO(),
    professorDAO = new ProfessorDAO()
  ) {
    this.usuarioDAO = usuarioDAO;
    this.alunoDAO = alunoDAO;
    this.empresaDAO = empresaDAO;
    this.professorDAO = professorDAO;
  }

  autenticar(login, senha) {
    if (typeof login !== 'string' || typeof senha !== 'string' || login.trim() === '' || senha === '') {
      throw criarErro(400, 'Informe login e senha para autenticar.');
    }

    const usuario = this.usuarioDAO.findByLogin(login.trim());
    if (!usuario) {
      // Gasta o mesmo tempo de uma verificação real para não revelar se o login existe.
      consumirTempoDeHash(senha);
      throw criarErro(401, 'Credenciais inválidas. Verifique seu login e senha.');
    }
    if (!usuario.autenticar(login.trim(), senha)) {
      throw criarErro(401, 'Credenciais inválidas. Verifique seu login e senha.');
    }

    return this.carregarPerfil(usuario.id, usuario.tipo) ?? usuario;
  }

  /**
   * Carrega o perfil completo (Aluno, Professor ou EmpresaParceira) de um usuário.
   * @returns {import('../models/Usuario.js').Usuario | null}
   */
  carregarPerfil(id, tipo) {
    if (tipo === 'ALUNO') return this.alunoDAO.findById(id);
    if (tipo === 'PROFESSOR') return this.professorDAO.findById(id);
    if (tipo === 'EMPRESA') return this.empresaDAO.findById(id);
    return null;
  }
}
