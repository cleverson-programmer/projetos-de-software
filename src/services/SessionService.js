import crypto from 'node:crypto';
import { getDatabase } from '../config/database.js';
import { fail } from '../utils/validation.js';

const COOKIE = 'moeda_session';
const TTL = 7 * 24 * 60 * 60;
const digest = (token) => crypto.createHash('sha256').update(token).digest('hex');
const csrf = (token) => crypto.createHmac('sha256', token).update('moeda-csrf-v1').digest('hex');
const secureCookie = () => process.env.COOKIE_SECURE === undefined ? process.env.NODE_ENV === 'production' : process.env.COOKIE_SECURE === 'true';

function cookie(value, maxAge) {
  return COOKIE + '=' + value + '; HttpOnly; Path=/; SameSite=Lax; Max-Age=' + maxAge + (secureCookie() ? '; Secure' : '');
}
function readCookie(req) {
  const raw = (req.headers.cookie || '').split(';').map((part) => part.trim()).find((part) => part.startsWith(COOKIE + '='));
  return raw ? raw.slice(COOKIE.length + 1) : null;
}

export class SessionService {
  async criar(req, res, usuario) {
    const old = readCookie(req);
    if (old && /^[a-f0-9]{64}$/.test(old)) await getDatabase().query('DELETE FROM sessoes WHERE token_hash = $1', [digest(old)]);
    const token = crypto.randomBytes(32).toString('hex');
    await getDatabase().query("INSERT INTO sessoes (token_hash, usuario_id, expira_em) VALUES ($1, $2, NOW() + INTERVAL '7 days')", [digest(token), usuario.id]);
    res.setHeader('Set-Cookie', cookie(token, TTL));
    return { usuario, csrfToken: csrf(token) };
  }

  async autenticar(req) {
    const token = readCookie(req);
    if (!token || !/^[a-f0-9]{64}$/.test(token)) fail(401, 'Entre na sua conta para continuar.');
    const { rows } = await getDatabase().query(
      'SELECT u.id, u.tipo, s.token_hash FROM sessoes s JOIN usuarios u ON u.id = s.usuario_id WHERE s.token_hash = $1 AND s.expira_em > NOW() AND u.ativo',
      [digest(token)]
    );
    if (!rows.length) fail(401, 'Sua sessão expirou. Entre novamente.');
    req.user = { id: Number(rows[0].id), tipo: rows[0].tipo, sessionHash: rows[0].token_hash };
    req.csrfToken = csrf(token);
    return req.user;
  }

  verificarCSRF(req) {
    const candidate = req.headers['x-csrf-token'];
    if (typeof candidate !== 'string' || !/^[a-f0-9]{64}$/.test(candidate) ||
      !crypto.timingSafeEqual(Buffer.from(candidate), Buffer.from(req.csrfToken))) fail(403, 'Sessão de formulário inválida. Atualize a página.');
  }

  async sair(req, res) {
    if (req.user) await getDatabase().query('DELETE FROM sessoes WHERE token_hash = $1', [req.user.sessionHash]);
    this.limparCookie(res);
  }

  limparCookie(res) { res.setHeader('Set-Cookie', cookie('', 0)); }
}
