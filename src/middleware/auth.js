import crypto from 'node:crypto';
import { TOKEN_TTL_SEGUNDOS } from '../config/regras.js';
import { UsuarioDAO } from '../dao/UsuarioDAO.js';
import { criarErro } from '../utils/erros.js';

const TIPOS_VALIDOS = ['ALUNO', 'PROFESSOR', 'EMPRESA'];
const REGEX_BASE64URL = /^[A-Za-z0-9_-]+$/;
const MSG_SESSAO_INVALIDA = 'Sessão inválida ou expirada. Faça login novamente.';

let segredoEmMemoria = null;

/**
 * Segredo de assinatura dos tokens: `AUTH_SECRET` ou, se ausente, um valor aleatório
 * gerado uma vez por processo (os tokens deixam de valer a cada reinício).
 */
export function obterSegredo() {
  const configurado = process.env.AUTH_SECRET;
  if (configurado && configurado !== '') return configurado;

  if (!segredoEmMemoria) {
    segredoEmMemoria = crypto.randomBytes(32).toString('hex');
    console.warn(
      '[Auth] AUTH_SECRET não definido: usando um segredo aleatório temporário. ' +
        'Os tokens perdem a validade a cada reinício do servidor.'
    );
  }
  return segredoEmMemoria;
}

function codificar(objeto) {
  return Buffer.from(JSON.stringify(objeto)).toString('base64url');
}

function assinar(conteudo, segredo) {
  return crypto.createHmac('sha256', segredo).update(conteudo).digest();
}

/**
 * Gera um token no formato `header.payload.assinatura` (HS256, base64url).
 * @param {{ sub: number, tipo: string }} dados
 * @param {{ segredo?: string, agora?: number, ttlSegundos?: number }} [opcoes]
 */
export function assinarToken({ sub, tipo }, { segredo = obterSegredo(), agora = Date.now(), ttlSegundos = TOKEN_TTL_SEGUNDOS } = {}) {
  const iat = Math.floor(agora / 1000);
  const header = codificar({ alg: 'HS256', typ: 'JWT' });
  const payload = codificar({ sub, tipo, iat, exp: iat + ttlSegundos });
  const assinatura = assinar(`${header}.${payload}`, segredo).toString('base64url');
  return `${header}.${payload}.${assinatura}`;
}

/**
 * Verifica assinatura, algoritmo e validade do token. Lança erro 401 se inválido.
 * @returns {{ sub: number, tipo: string, iat: number, exp: number }}
 */
export function verificarToken(token, { segredo = obterSegredo(), agora = Date.now() } = {}) {
  const invalido = () => criarErro(401, MSG_SESSAO_INVALIDA);

  if (typeof token !== 'string') throw invalido();
  const partes = token.split('.');
  if (partes.length !== 3 || !partes.every((p) => REGEX_BASE64URL.test(p))) throw invalido();

  const [headerB64, payloadB64, assinaturaB64] = partes;

  let header;
  try {
    header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf8'));
  } catch {
    throw invalido();
  }
  if (!header || header.alg !== 'HS256') throw invalido();

  const esperada = assinar(`${headerB64}.${payloadB64}`, segredo);
  const recebida = Buffer.from(assinaturaB64, 'base64url');
  if (recebida.length !== esperada.length || !crypto.timingSafeEqual(recebida, esperada)) {
    throw invalido();
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
  } catch {
    throw invalido();
  }

  if (
    !payload ||
    !Number.isSafeInteger(payload.sub) ||
    !TIPOS_VALIDOS.includes(payload.tipo) ||
    typeof payload.exp !== 'number' ||
    payload.exp <= Math.floor(agora / 1000)
  ) {
    throw invalido();
  }

  return payload;
}

/**
 * Autentica a requisição pelo cabeçalho `Authorization: Bearer <token>`.
 * Confirma que o usuário ainda existe e que o perfil do token confere com o banco.
 * Preenche `req.auth = { id, tipo }` e o retorna. Lança erro 401 em caso de falha.
 */
export function autenticarRequisicao(req, usuarioDAO = new UsuarioDAO()) {
  const cabecalho = req.headers.authorization;
  if (typeof cabecalho !== 'string') {
    throw criarErro(401, 'Autenticação necessária. Faça login para continuar.');
  }

  const correspondencia = /^Bearer ([^\s]+)$/.exec(cabecalho.trim());
  if (!correspondencia) {
    throw criarErro(401, 'Autenticação necessária. Faça login para continuar.');
  }

  const payload = verificarToken(correspondencia[1]);

  const usuario = usuarioDAO.findById(payload.sub);
  if (!usuario || usuario.tipo !== payload.tipo) {
    throw criarErro(401, MSG_SESSAO_INVALIDA);
  }

  req.auth = { id: usuario.id, tipo: usuario.tipo };
  return req.auth;
}

/**
 * Exige que o usuário autenticado tenha um dos perfis informados (senão 403).
 */
export function exigirPerfil(req, ...perfis) {
  if (!req.auth || !perfis.includes(req.auth.tipo)) {
    throw criarErro(403, 'Você não tem permissão para acessar este recurso.');
  }
}

/**
 * Exige que o recurso `id` pertença ao usuário autenticado, que deve ter o perfil `tipo` (senão 403).
 */
export function exigirProprietario(req, id, tipo) {
  if (!req.auth || req.auth.tipo !== tipo || Number(id) !== req.auth.id) {
    throw criarErro(403, 'Você só pode acessar os dados da sua própria conta.');
  }
}
