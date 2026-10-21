import { AuthService } from '../services/AuthService.js';

export class AuthController {
  constructor(service = new AuthService()) {
    this.service = service;
  }

  login(req, res) {
    const { login, senha } = req.body || {};
    const usuario = this.service.autenticar(login, senha);
    res.sendJson(200, {
      message: 'Autenticação realizada com sucesso.',
      usuario,
    });
  }
}

