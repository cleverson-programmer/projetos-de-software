// ============================================================================
// Cliente da API: anexa o token Bearer, serializa JSON e trata 401 (sessão expirada).
// ============================================================================
import * as sessao from './sessao.js';

export const MENSAGEM_SESSAO_EXPIRADA = 'Sessão expirada. Entre novamente.';

let aoSessaoExpirada = null;

/** Registra o que fazer quando uma chamada (exceto o login) responde 401. */
export function definirAoSessaoExpirada(callback) {
  aoSessaoExpirada = callback;
}

/**
 * Chama a API. `options.body` pode ser objeto (vira JSON). Erros lançam Error com
 * `statusCode` e a mensagem enviada pelo servidor (`data.error`).
 */
export async function apiRequest(url, options = {}) {
  const { body, headers: headersExtras, ...resto } = options;
  const headers = { ...headersExtras };

  const token = sessao.obterToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let corpo = body;
  if (body !== undefined && body !== null && typeof body !== 'string') {
    corpo = JSON.stringify(body);
  }
  if (corpo !== undefined && corpo !== null) headers['Content-Type'] = 'application/json';

  let resposta;
  try {
    resposta = await fetch(url, { ...resto, headers, body: corpo });
  } catch {
    throw new Error('Não foi possível conectar ao servidor. Verifique sua conexão.');
  }

  const dados = await resposta.json().catch(() => ({}));

  if (resposta.status === 401 && url !== '/api/auth/login') {
    sessao.limpar();
    const erro = new Error(MENSAGEM_SESSAO_EXPIRADA);
    erro.statusCode = 401;
    erro.sessaoExpirada = true;
    if (aoSessaoExpirada) aoSessaoExpirada();
    throw erro;
  }

  if (!resposta.ok) {
    const erro = new Error((dados && dados.error) || 'Erro na comunicação com o servidor.');
    erro.statusCode = resposta.status;
    throw erro;
  }
  return dados;
}
