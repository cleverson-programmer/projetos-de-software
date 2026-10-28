// ============================================================================
// Sessão do usuário (token + dados) em sessionStorage.
// O sessionStorage só é acessado dentro das funções, nunca em tempo de import.
// ============================================================================

const CHAVE_TOKEN = 'moeda.token';
const CHAVE_USUARIO = 'moeda.usuario';

export function salvar(token, usuario) {
  sessionStorage.setItem(CHAVE_TOKEN, token);
  sessionStorage.setItem(CHAVE_USUARIO, JSON.stringify(usuario));
}

export function obterToken() {
  return sessionStorage.getItem(CHAVE_TOKEN);
}

export function obterUsuario() {
  try {
    return JSON.parse(sessionStorage.getItem(CHAVE_USUARIO));
  } catch {
    return null;
  }
}

/** Mescla campos novos nos dados do usuário guardados. */
export function atualizarUsuario(parcial) {
  const atual = obterUsuario() || {};
  const novo = { ...atual, ...parcial };
  sessionStorage.setItem(CHAVE_USUARIO, JSON.stringify(novo));
  return novo;
}

export function atualizarSaldo(saldoMoedas) {
  return atualizarUsuario({ saldoMoedas: Number(saldoMoedas) });
}

export function limpar() {
  sessionStorage.removeItem(CHAVE_TOKEN);
  sessionStorage.removeItem(CHAVE_USUARIO);
}
