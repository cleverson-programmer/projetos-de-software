import crypto from 'node:crypto';

const ITERACOES_ATUAIS = 600000;
const ITERACOES_LEGADO = 10000;
const TAMANHO_HASH = 64;
const REGEX_HEX = /^[0-9a-f]+$/;

/**
 * Gera o hash PBKDF2-SHA256 da senha no formato `pbkdf2$600000$<salt hex>$<hash hex>`.
 */
export function gerarHashSenha(senhaPura) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto
    .pbkdf2Sync(String(senhaPura), salt, ITERACOES_ATUAIS, TAMANHO_HASH, 'sha256')
    .toString('hex');
  return `pbkdf2$${ITERACOES_ATUAIS}$${salt}$${hash}`;
}

/**
 * Verifica a senha contra o hash armazenado.
 * Aceita o formato atual e o legado `pbkdf2$<salt>$<hash>` (10000 iterações).
 * Qualquer outro formato (bcrypt, texto puro) é rejeitado.
 */
export function verificarSenha(senhaPura, armazenado) {
  if (typeof senhaPura !== 'string' || typeof armazenado !== 'string') return false;

  const partes = armazenado.split('$');
  let iteracoes;
  let salt;
  let hashOriginal;

  if (partes.length === 4 && partes[0] === 'pbkdf2' && partes[1] === String(ITERACOES_ATUAIS)) {
    iteracoes = ITERACOES_ATUAIS;
    [, , salt, hashOriginal] = partes;
  } else if (partes.length === 3 && partes[0] === 'pbkdf2') {
    iteracoes = ITERACOES_LEGADO;
    [, salt, hashOriginal] = partes;
  } else {
    return false;
  }

  if (!salt || !REGEX_HEX.test(hashOriginal) || hashOriginal.length !== TAMANHO_HASH * 2) {
    return false;
  }

  const esperado = Buffer.from(hashOriginal, 'hex');
  const calculado = crypto.pbkdf2Sync(senhaPura, salt, iteracoes, TAMANHO_HASH, 'sha256');
  return esperado.length === calculado.length && crypto.timingSafeEqual(esperado, calculado);
}

let hashFicticio = null;

/**
 * Executa uma verificação de senha contra um hash fictício, para que logins
 * inexistentes gastem tempo semelhante ao de logins existentes.
 */
export function consumirTempoDeHash(senhaPura) {
  if (!hashFicticio) {
    hashFicticio = gerarHashSenha(crypto.randomBytes(16).toString('hex'));
  }
  verificarSenha(typeof senhaPura === 'string' ? senhaPura : '', hashFicticio);
}
