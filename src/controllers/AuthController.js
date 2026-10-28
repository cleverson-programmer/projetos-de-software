import { AuthService } from '../services/AuthService.js';
import { loginThrottle } from '../middleware/loginThrottle.js';
import { assinarToken } from '../middleware/auth.js';
import { criarErro } from '../utils/erros.js';

export class AuthController {
  constructor(service = new AuthService(), throttle = loginThrottle) {
    this.service = service;
    this.throttle = throttle;
  }

  login(req, res) {
    const { login, senha } = req.body || {};
    const ip = req.socket?.remoteAddress;
    const contaChave = typeof login === 'string' && login.trim() !== '';

    if (contaChave) {
      this.throttle.verificarBloqueio(login, ip);
    }

    let usuario;
    try {
      usuario = this.service.autenticar(login, senha);
    } catch (error) {
      // Só falhas de credencial (401) contam para o bloqueio; erros de validação (400) não.
      if (error.statusCode === 401 && contaChave) {
        this.throttle.registrarFalha(login, ip);
      }
      throw error;
    }

    if (contaChave) {
      this.throttle.registrarSucesso(login, ip);
    }

    const token = assinarToken({ sub: usuario.id, tipo: usuario.tipo });
    res.sendJson(200, {
      message: 'Autenticação realizada com sucesso.',
      token,
      usuario,
    });
  }

  me(req, res) {
    const usuario = this.service.carregarPerfil(req.auth.id, req.auth.tipo);
    if (!usuario) {
      throw criarErro(401, 'Sessão inválida ou expirada. Faça login novamente.');
    }
    res.sendJson(200, { usuario });
  }
}
